/**
 * export/run.ts —— M2 F5 导出管线（2026-08-10 B 档迁移修订）
 * textPdf：隐藏窗口加载 export 模式真实模板 → printToPDF（单引擎，导出=预览）。
 * json：ResumeSchema 序列化含 schemaVersion 落盘。
 * 「仅第一页」（D13）：export 模式 print-first-page-only CSS 截断。
 * 目标目录优先级：folderPath > settings.export.lastFolder > storage.folderPath > 下载目录。
 *
 * 历史修订（2026-08-10 实证）：2026-08-08 定案"printToPDF 依赖 GPU 合成、无 GPU 机器 100% 失败"
 * 经网络调研（Chromium PrintCompositor = CPU Skia，无 GPU 依赖）+ 本地实测（Electron 43.3.0
 * disableHardwareAcceleration 下 printToPDF 1.9s 正常完成）推翻；@react-pdf 纯代码（双引擎）退役。
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
import { openResume, getStorageDir } from '../files/resume-store'
import { readPhotoFile } from '../files/photo-store'
import { printAppToPdf } from '../print/pdf'

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
          // B3（2026-08-11 photo 转存）：JSON 导出重组内嵌照片——photo 引用读回 dataURL，
          // 导出自包含（再导入恢复照片，不破坏"便于再导入"承诺）；缺失则原样（空/avatar 特判）
          const photo = parsed.basics.photo
          if (typeof photo === 'string' && photo.startsWith('photos/')) {
            const dataUrl = await readPhotoFile(getStorageDir(), photo)
            if (dataUrl) parsed.basics.photo = dataUrl
          }
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
          // 2026-08-10 B 档：隐藏窗口加载 export 模式真实模板 → printToPDF（单引擎，导出=预览）。
          // 原 @react-pdf 纯代码（2026-08-08 定案）依据"printToPDF 依赖 GPU"经实证推翻，
          // 见本文件头注释；print/pdf.ts printAppToPdf 内含就绪轮询/字体/超时/失败重建。
          emitProgress(sender, 'render', 0.1)
          const resumeId = args.resumeId
          if (!resumeId) return { canceled: false, error: 'export: missing resumeId' }
          // 预读简历校验存在性 + 取文件名（简历不存在快速失败，避免打印窗口空转）
          const raw = await readResumeOrThrow(resumeId)
          const parsed = ResumeSchema.parse(raw)

          const language = (store.get('language') ?? 'zh-CN') as 'zh-CN' | 'en'
          const privacyMode = args.privacyMode ?? false
          const { data: pdfData, pageCount } = await printAppToPdf(resumeId, {
            pages: pages === 'first' ? 'first' : 'all',
            privacyMode,
            language
          })
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
          // 真实页数（pdf-lib 解析导出缓冲；导出对话框展示）
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
