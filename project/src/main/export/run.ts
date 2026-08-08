/**
 * export/run.ts —— M2 F5 导出管线（D10：同源应用路线）
 * 打印窗口加载与渲染进程同源的应用（?export=1&resumeId=<id>&pages=...），
 * App 检测 export 模式 → 只渲染模板（含 data-redact 隐私）→ React 就绪轮询 → printToPDF。
 * textPdf：矢量、文字可选、与预览一致（同源 bundle = 天然同源）。
 * json：ResumeSchema 序列化含 schemaVersion 落盘。
 * 「仅第一页」（D13）：打印前注入 print-first-page-only 类（CSS overflow 截断）。
 * 目标目录优先级：folderPath > settings.export.lastFolder > storage.folderPath > 下载目录。
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'
import { is } from '@electron-toolkit/utils'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  IPC,
  type ExportRunArgs,
  type ExportRunResult,
  type ExportProgress
} from '../../shared/ipc-channels'
import { ResumeSchema } from '../../shared/schema/resume'
import type { Settings } from '../../shared/schema/settings'
import { openResume } from '../files/resume-store'

const store = new Store<Settings>()
const __dirname = dirname(fileURLToPath(import.meta.url))

/** 打印超时（2026-08-08 P1 根治）：GPU 不可用环境 printToPDF 永不 resolve（Chromium known issue）→ 必须 race 兜底 */
const PRINT_TIMEOUT_MS = 15_000
/** 页面加载超时：loadURL 卡死时 did-finish-load 永不触发，不能裸等 */
const LOAD_TIMEOUT_MS = 8_000

/** 打印窗口单例（懒创建；退出时由 main/index before-quit 清理） */
let exportWindow: BrowserWindow | null = null

export function getExportWindow(): BrowserWindow {
  if (exportWindow && !exportWindow.isDestroyed()) return exportWindow
  exportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  return exportWindow
}

export function destroyExportWindow(): void {
  if (exportWindow && !exportWindow.isDestroyed()) {
    exportWindow.destroy()
    exportWindow = null
  }
}

/** 渲染进程地址（dev = vite dev server；prod = 打包产物） */
function rendererUrl(query: string): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}${query}`
  }
  return `${join(__dirname, '../renderer/index.html')}${query}`
}

/** 等待 React 就绪（did-finish-load 不代表 React 渲染完 → 轮询 __exportReady） */
async function waitForReact(win: BrowserWindow, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  // 页面在 did-finish-load 前不轮询；加载本身带超时保护（loadURL 卡死时 did-finish-load 永不触发）
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('export: page load timeout')), LOAD_TIMEOUT_MS)
    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', () => {
        clearTimeout(timer)
        resolve()
      })
    } else {
      clearTimeout(timer)
      resolve()
    }
  })
  while (Date.now() < deadline) {
    const ready = await win.webContents
      .executeJavaScript('window.__exportReady === true', true)
      .catch(() => false)
    if (ready) return
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error('export: renderer not ready (timeout)')
}

/** 通知渲染进程导出进度（主进程经 export:progress 回传） */
function emitProgress(sender: Electron.WebContents | null, phase: ExportProgress['phase'], ratio: number): void {
  if (sender && !sender.isDestroyed()) {
    sender.send('export:progress', { phase, ratio } satisfies ExportProgress)
  }
}

/** 解析目标目录：folderPath > export.lastFolder > storage.folderPath > 下载目录 */
export function resolveExportDir(folderPath?: string): string {
  if (typeof folderPath === 'string' && folderPath.length > 0) return folderPath
  const last = store.get('export.lastFolder')
  if (typeof last === 'string' && last.length > 0) return last
  const storage = store.get('storage.folderPath')
  if (typeof storage === 'string' && storage.length > 0) return storage
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
          const dir = resolveExportDir(folderPath)
          await fs.mkdir(dir, { recursive: true })
          // 渲染进程传 resumeId（隐藏窗口模式下渲染进程仍需自行序列化）
          const resumeId = (args as unknown as { resumeId?: string }).resumeId
          if (!resumeId) return { canceled: false, error: 'export: missing resumeId' }
          const raw = await readResumeOrThrow(resumeId)
          const parsed = ResumeSchema.parse(raw)
          const fileName = `${safeFileName(parsed.basics.name || 'resume')}.json`
          const filePath = path.join(dir, fileName)
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
          emitProgress(sender, 'render', 0.1)
          const resumeId = (args as unknown as { resumeId?: string }).resumeId
          if (!resumeId) return { canceled: false, error: 'export: missing resumeId' }
          // 预读简历校验存在性（避免隐藏窗口加载后才发现文件缺失）
          await readResumeOrThrow(resumeId)

          const query = new URLSearchParams({ export: '1', resumeId, pages: pages ?? 'all' }).toString()
          const win = getExportWindow()
          await win.loadURL(rendererUrl(`?${query}`))
          await waitForReact(win)
          emitProgress(sender, 'print', 0.4)

          // 字体就绪（3s 竞速兜底，防中文乱码；超时不阻塞——回退系统字体）
          await Promise.race([
            win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true),
            new Promise((r) => setTimeout(r, 3000))
          ])

          // printToPDF 在 GPU 不可用环境永不 resolve（Chromium known issue）→ race 超时兜底（P1 2026-08-08）
          const data = await Promise.race([
            win.webContents.printToPDF({
              printBackground: true,
              preferCSSPageSize: true
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('export: printToPDF timeout (GPU unavailable?)')), PRINT_TIMEOUT_MS)
            )
          ])
          emitProgress(sender, 'write', 0.9)

          const dir = resolveExportDir(folderPath)
          await fs.mkdir(dir, { recursive: true })
          const raw = await readResumeOrThrow(resumeId)
          const parsed = ResumeSchema.parse(raw)
          const fileName = `${safeFileName(parsed.basics.name || 'resume')}.pdf`
          const filePath = path.join(dir, fileName)
          await fs.writeFile(filePath, data)
          rememberLastFolder(dir)
          emitProgress(sender, 'write', 1)
          return { canceled: false, filePath }
        }

        // imagePdf / image：v1.1（pdf-lib 候选，见《技术栈.md》§3.18）
        return { canceled: false, error: `export: format ${format} coming in v1.1` }
      } catch (err) {
        // 打印窗口单例：任何失败都销毁窗口，防「中毒」窗口让后续导出续挂（P1 2026-08-08）
        destroyExportWindow()
        return { canceled: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}

app.on('before-quit', destroyExportWindow)
