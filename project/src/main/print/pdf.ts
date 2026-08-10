import { BrowserWindow, app } from 'electron'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PDFDocument } from 'pdf-lib'
import type { Language } from '@shared/schema/settings'

/**
 * printToPDF 服务（M0 端到端验证 + B 档导出 2026-08-10）
 * 时序铁律（《项目规范.md》4.1）：打印前必须 await document.fonts.ready 再调 printToPDF，
 * 否则中文乱码 / 排版错位。M0 用含中文字体的 HTML 验证。
 *
 * 2026-08-10 B 档迁移（实证修订 2026-08-08 定案）：textPdf 导出回归本服务——
 * Chromium PDF 合成 = CPU Skia（PrintCompositor，无 GPU 依赖）；Electron 43.3.0
 * 无 GPU 环境（disableHardwareAcceleration）实测 printToPDF 1.9s 正常完成。
 */

let pdfWindow: BrowserWindow | null = null

/** 创建（或复用）隐藏打印窗口，避免每次打印重建 */
export function createPdfWindow(): BrowserWindow {
  if (pdfWindow && !pdfWindow.isDestroyed()) return pdfWindow
  pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.mjs'),
      // 2026-08-10 修复：B 档 printAppToPdf 加载完整应用 export 模式，需 preload 暴露
      // electronAPI（useAppBootstrap → resumes.open）；缺 preload 致 electronAPI undefined
      // → 简历加载静默失败 → __exportReady 永不置位 → 30s 就绪超时（实测复现）。
      // ⚠️ electron-vite 主进程为单 bundle，__dirname 运行时 = out/main（非源码目录），
      // 故与 main/index.ts 同为 ../preload/index.mjs（out/main/../preload = out/preload）
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  return pdfWindow
}

export interface PdfResult {
  data: Buffer
  mimeType: string
}

/** 渲染 HTML → PDF（矢量）。HTML 先落临时文件再 loadFile（data: URL 在部分环境受限） */
export async function printHtmlToPdf(html: string): Promise<PdfResult> {
  const win = createPdfWindow()

  const tmpDir = join(tmpdir(), 'xiaomengresume-print')
  mkdirSync(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`)
  writeFileSync(tmpFile, html, 'utf8')

  try {
    // 等页面真正加载完成（隐藏窗口在部分环境加载较慢）
    const loadDone = new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()))
    await win.loadFile(tmpFile)
    await loadDone

    // 铁律时序：等字体就绪，防中文乱码（带超时，避免无字体环境挂死）
    await Promise.race([
      win.webContents.executeJavaScript(`document.fonts.ready.then(() => true)`, true),
      new Promise((r) => setTimeout(r, 4000))
    ])

    const data = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    })

    return { data, mimeType: 'application/pdf' }
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch {
      /* 临时文件清理失败不阻塞打印 */
    }
  }
}

export interface PrintAppOptions {
  /** 'all' 全部（默认）；'first' 仅第一页（export 模式 print-first-page-only CSS 截断） */
  pages: 'all' | 'first'
  privacyMode: boolean
  language: Language
}

export interface PrintAppResult {
  data: Buffer
  /** 真实页数（pdf-lib 解析；替代 D12 高度估算） */
  pageCount: number
}

const EXPORT_READY_TIMEOUT_MS = 30_000
const PRINT_TIMEOUT_MS = 30_000

/** 轮询渲染进程 __exportReady（M2 D10 信号：简历数据加载完成 + React 渲染后置位） */
async function waitForExportReady(win: BrowserWindow, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const ready = await win.webContents
      .executeJavaScript('window.__exportReady === true', true)
      .catch(() => false)
    if (ready) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

/**
 * B 档（2026-08-10）：textPdf 导出主管线——
 * 隐藏窗口加载同源应用 export 模式（App.tsx D10 分支：真实模板 + data-redact）→ printToPDF。
 * 与预览同一 bundle/同一模板（"模板=打印"由构造保证，双引擎漂移作废）。
 */
export async function printAppToPdf(resumeId: string, opts: PrintAppOptions): Promise<PrintAppResult> {
  const win = createPdfWindow()
  try {
    if (process.env['ELECTRON_RENDERER_URL']) {
      // dev：Vite dev server（与主窗口同一加载方式）
      const url = new URL(process.env['ELECTRON_RENDERER_URL'])
      url.searchParams.set('export', '1')
      url.searchParams.set('resumeId', resumeId)
      url.searchParams.set('pages', opts.pages)
      url.searchParams.set('privacyMode', opts.privacyMode ? '1' : '0')
      url.searchParams.set('language', opts.language)
      await win.loadURL(url.toString())
    } else {
      // prod：构建产物（⚠️ electron-vite 单 bundle，__dirname 运行时 = out/main，
      // 故与 main/index.ts 同为 ../renderer → out/renderer；初版误写 ../../renderer
      // 解析到 project/renderer（缺 out/ 层）致 ERR_FILE_NOT_FOUND）
      await win.loadFile(join(__dirname, '../renderer/index.html'), {
        query: {
          export: '1',
          resumeId,
          pages: opts.pages,
          privacyMode: opts.privacyMode ? '1' : '0',
          language: opts.language
        }
      })
    }

    const ready = await waitForExportReady(win, EXPORT_READY_TIMEOUT_MS)
    if (!ready) throw new Error('export: 渲染就绪超时（__exportReady 未置位）')

    // 铁律时序：等字体就绪，防中文乱码（3s 兜底）
    await Promise.race([
      win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true),
      new Promise((r) => setTimeout(r, 4000))
    ])

    // 30s 超时兜底（防打印管线异常永久 pending；2026 调研：Electron 43.3.0 已修复队列卡死 #51174，双保险）
    const data = await Promise.race([
      win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`export: printToPDF 超时 (>${PRINT_TIMEOUT_MS / 1000}s)`)), PRINT_TIMEOUT_MS)
      })
    ])

    const pageCount = (await PDFDocument.load(data)).getPageCount()
    return { data: Buffer.from(data), pageCount }
  } catch (err) {
    // 失败重建窗口：防打印队列污染（一次失败后单例队列可能卡死后续调用）
    destroyPdfWindow()
    throw err
  }
}

/** 关闭打印窗口（退出时清理） */
export function destroyPdfWindow(): void {
  if (pdfWindow && !pdfWindow.isDestroyed()) {
    pdfWindow.destroy()
    pdfWindow = null
  }
}

app.on('before-quit', destroyPdfWindow)
