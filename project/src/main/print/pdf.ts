import { BrowserWindow, app } from 'electron'
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * printToPDF 服务（M0 端到端验证）
 * 时序铁律（《项目规范.md》4.1）：打印前必须 await document.fonts.ready 再调 printToPDF，
 * 否则中文乱码 / 排版错位。M0 用含中文字体的 HTML 验证。
 */

let pdfWindow: BrowserWindow | null = null

/** 创建（或复用）隐藏打印窗口，避免每次打印重建 */
export function createPdfWindow(): BrowserWindow {
  if (pdfWindow && !pdfWindow.isDestroyed()) return pdfWindow
  pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
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

/** 关闭打印窗口（退出时清理） */
export function destroyPdfWindow(): void {
  if (pdfWindow && !pdfWindow.isDestroyed()) {
    pdfWindow.destroy()
    pdfWindow = null
  }
}

app.on('before-quit', destroyPdfWindow)
