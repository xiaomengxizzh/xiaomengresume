/**
 * export/run.ts —— M2 F5 导出管线（2026-08-08 重构：纯代码生成路线）
 * textPdf：@react-pdf/renderer 纯代码矢量生成（文字可选、零 GPU——任何环境可跑）。
 * json：ResumeSchema 序列化含 schemaVersion 落盘。
 * 「仅第一页」（D13）：pdf-lib 裁剪（旧 CSS 截断已随 printToPDF 退役）。
 * 目标目录优先级：folderPath > settings.export.lastFolder > storage.folderPath > 下载目录。
 *
 * 历史（2026-08-08 评审定案）：旧 textPdf 走「隐藏窗口 + loadURL + printToPDF」，
 * 依赖 GPU 合成——无 GPU 机器（RDP/VM/Linux 无显示/混合显卡）printToPDF 永不 resolve
 * （实测 FATAL/timeout）。print/pdf.ts（print:pdf 冒烟通道）保留未删，供冒烟与 imagePdf v1.1。
 */
import { app, ipcMain } from 'electron'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'
import {
  IPC,
  type ExportRunArgs,
  type ExportRunResult,
  type ExportProgress
} from '../../shared/ipc-channels'
import { ResumeSchema } from '../../shared/schema/resume'
import type { Settings } from '../../shared/schema/settings'
import { openResume } from '../files/resume-store'
import { buildTextPdf } from './pdf/build'

const store = new Store<Settings>()

/** 通知渲染进程导出进度（主进程经 export:progress 回传） */
function emitProgress(sender: Electron.WebContents | null, phase: ExportProgress['phase'], ratio: number): void {
  if (sender && !sender.isDestroyed()) {
    sender.send('export:progress', { phase, ratio } satisfies ExportProgress)
  }
}

/** 解析目标目录：folderPath > export.lastFolder > storage.folderPath > 下载目录 */
export function resolveExportDir(folderPath?: string): string {
  if (typeof folderPath === 'string' && folderPath.length > 0) return path.resolve(folderPath)
  const last = store.get('export.lastFolder')
  if (typeof last === 'string' && last.length > 0) return path.resolve(last)
  const storage = store.get('storage.folderPath')
  if (typeof storage === 'string' && storage.length > 0) return path.resolve(storage)
  return app.getPath('downloads')
}

/** 记忆上次导出目录（#22） */
function rememberLastFolder(dir: string): void {
  store.set('export.lastFolder', dir)
}

/** 安全文件名：简历名清洗（Windows 非法字符 → _；控制字符按码点剔除） */
function safeFileName(name: string): string {
  return (name || 'resume')
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((c) => (c.charCodeAt(0) < 0x20 ? '_' : c))
    .join('')
    .slice(0, 80)
}

async function readResumeOrThrow(resumeId: string): Promise<unknown> {
  return openResume(resumeId)
}

/**
 * export:run 主处理器。
 * 注意：打印窗口加载应用后，模板渲染 + printToPDF 全部在打印窗口内完成
 * （同源 bundle；隐私 data-redact 由打印窗口读取自身 store，无需 IPC 传参）。
 */
export function registerExportIpc(): void {
  ipcMain.handle(
    IPC.Export.Run,
    async (event, args: ExportRunArgs): Promise<ExportRunResult> => {
      const sender = event.sender
      try {
        if (!args || typeof args.format !== 'string') {
          return { canceled: false, error: 'export: bad args' }
        }
        const { format, folderPath, pages } = args

        if (format === 'json') {
          emitProgress(sender, 'write', 0.9)
          const dir = path.resolve(resolveExportDir(folderPath))
          await fs.mkdir(dir, { recursive: true })
          // 渲染进程传 resumeId
          const resumeId = args.resumeId
          if (!resumeId) return { canceled: false, error: 'export: missing resumeId' }
          const raw = await readResumeOrThrow(resumeId)
          const parsed = ResumeSchema.parse(raw)
          const fileName = `${safeFileName(parsed.title || parsed.basics.name || 'resume')}.json`
          const filePath = path.resolve(dir, fileName)
          // 路径穿越纵深防御：最终路径必须仍在目标目录内（目录参数/文件名注入兜底）
          if (path.relative(dir, filePath).startsWith('..')) return { canceled: false, error: 'export: invalid output path' }
          await fs.writeFile(
            filePath,
            JSON.stringify({ ...parsed, schemaVersion: parsed.schemaVersion }, null, 2),
            'utf-8'
          )
          rememberLastFolder(dir)
          emitProgress(sender, 'write', 1)
          return { canceled: false, filePath }
        }

        if (format === 'textPdf') {
          // 2026-08-08 重构：文字版 PDF = @react-pdf/renderer 纯代码生成（矢量、文字可选、零 GPU）。
          // 旧路径（隐藏窗口 + printToPDF）已退役：printToPDF 依赖 GPU 合成，无 GPU 机器（RDP/VM/Linux
          // 无显示/混合显卡）100% 失败（实测 FATAL/timeout）。保留 exportWindow/print/pdf.ts 供
          // print:pdf 冒烟与 imagePdf v1.1 使用，textPdf 不再走该链路。
          emitProgress(sender, 'render', 0.1)
          const resumeId = args.resumeId
          if (!resumeId) return { canceled: false, error: 'export: missing resumeId' }
          // 预读简历校验存在性 + 取 layout/语言/隐私（主进程生成，无需打印窗口）
          const raw = await readResumeOrThrow(resumeId)
          const parsed = ResumeSchema.parse(raw)

          const language = (store.get('language') ?? 'zh-CN') as 'zh-CN' | 'en'
          const privacyMode = args.privacyMode ?? false
          // P1 修复（2026-08-08）：主进程侧超时兜底——renderToBuffer 挂起（超大简历 + CJK 字体内嵌）
          // 时拒绝并**不写盘**。原实现渲染端 30s race 只解 UI 冻结，主进程任务继续运行并写文件
          // （僵尸写盘），超时后再次导出并发双写同一路径。
          const buildPromise = buildTextPdf(parsed, {
            language,
            privacyMode,
            pages: pages === 'first' ? 'first' : 'all'
          })
          const BUILD_TIMEOUT_MS = 30_000
          let timer: ReturnType<typeof setTimeout> | null = null
          let pdfData: Buffer
          let warnings: string[]
          // 2026-08-10：真实页数需透传至返回处（try 块外）——改为块外声明
          let pageCount = 1
          try {
            const buildResult = await Promise.race([
              buildPromise,
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('export: pdf build timed out (>30s)')), BUILD_TIMEOUT_MS)
              })
            ])
            pdfData = buildResult.buffer
            warnings = buildResult.warnings
            pageCount = buildResult.pageCount
          } finally {
            if (timer) clearTimeout(timer)
          }
          for (const w of warnings) console.warn(`[Export] ${w}`)
          emitProgress(sender, 'write', 0.9)

          const dir = path.resolve(resolveExportDir(folderPath))
          await fs.mkdir(dir, { recursive: true })
          const fileName = `${safeFileName(parsed.title || parsed.basics.name || 'resume')}.pdf`
          const filePath = path.resolve(dir, fileName)
          // 路径穿越纵深防御（同 JSON 导出）
          if (path.relative(dir, filePath).startsWith('..')) return { canceled: false, error: 'export: invalid output path' }
          await fs.writeFile(filePath, pdfData)
          rememberLastFolder(dir)
          emitProgress(sender, 'write', 1)
          // 2026-08-10：透传真实页数（导出对话框展示，替代估算）
          return { canceled: false, filePath, pageCount }
        }

        // imagePdf / image：v1.1（pdf-lib 候选，见《技术栈.md》§3.18）
        return { canceled: false, error: `export: format ${format} coming in v1.1` }
      } catch (err) {
        return { canceled: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
