import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import Store from 'electron-store'
import { createEmptyResume } from '../shared/schema/resume'
import type { Settings } from '../shared/schema/settings'

/**
 * M0 自动冒烟（XM_M0_SMOKE=1 时由 index.ts 触发）
 * 走真实链路：renderer(preload electronAPI) → IPC → main handler
 * 验证：① 窗口打开 ② IPC 通信 ③ 中文 PDF 导出 ④ AI 流式 ⑤ M1 保存链路（三件套）⑥ 内置示例链路
 * 结果 JSON 打到 stdout，进程自动退出；供沙箱/CI/用户本机一键验收。
 * 2026-08-10 实证修订：printToPDF 无 GPU 挂起定案（2026-08-08）已推翻——Chromium PDF 合成 = CPU
 * Skia（无 GPU 依赖），Electron 43.3.0 disableHardwareAcceleration 下实测正常完成；沙箱可用 xvfb 兜底。
 */

/** 单步执行 JS，带超时，避免渲染进程未就绪时挂死 */
async function execJs(win: BrowserWindow, code: string, timeoutMs = 15000): Promise<unknown> {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('executeJavaScript timeout')), timeoutMs))
  ])
}

/** ⑤ M1 保存链路：resume:save → open → recent → delete（临时存储目录，不污染用户数据） */
async function runM1SaveLink(
  win: BrowserWindow,
  report: Record<string, unknown>
): Promise<void> {
  const store = new Store<Settings>()
  const tmpDir = path.join(app.getPath('temp'), `xm-m1-smoke-${Date.now()}`)
  const prevStorage = store.get('storage.folderPath')
  try {
    await fs.mkdir(tmpDir, { recursive: true })
    store.set('storage.folderPath', tmpDir)

    const id = crypto.randomUUID()
    const resume = createEmptyResume()
    resume.basics.name = 'M1 Smoke'
    const saved = (await execJs(
      win,
      `window.electronAPI.resumes.save(${JSON.stringify(id)}, ${JSON.stringify(resume)})`
    )) as { basics?: { name?: string } }
    const opened = (await execJs(
      win,
      `window.electronAPI.resumes.open(${JSON.stringify(id)})`
    )) as { basics?: { name?: string }; meta?: { lastOpenedAt?: string } }
    const recent = (await execJs(win, 'window.electronAPI.resumes.recent()')) as unknown[]
    const recovery = (await execJs(win, 'window.electronAPI.resumes.scanRecovery()')) as unknown[]
    const del = (await execJs(
      win,
      `window.electronAPI.resumes.remove(${JSON.stringify(id)})`
    )) as boolean

    // ⑥ 内置示例链路（M1 补口）：resume:create-sample → 返回宋哈娜示例（写临时目录，不污染用户数据）
    const sample = (await execJs(
      win,
      'window.electronAPI.resumes.createSample()'
    )) as { id?: string; resume?: { basics?: { name?: string } } }

    report.m1Save = {
      ok:
        saved?.basics?.name === 'M1 Smoke' &&
        opened?.basics?.name === 'M1 Smoke' &&
        Boolean(opened?.meta?.lastOpenedAt) &&
        Array.isArray(recent) &&
        recent.length > 0 &&
        Array.isArray(recovery) &&
        del === true
    }
    report.sampleLink = {
      ok: Boolean(sample?.id) && sample?.resume?.basics?.name === '宋哈娜'
    }
  } catch (err) {
    report.m1Save = { ok: false, error: String(err) }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    if (prevStorage === undefined) store.delete('storage.folderPath')
    else store.set('storage.folderPath', prevStorage)
  }
}

export async function runM0Smoke(): Promise<void> {
  // 选可见主窗口（排除隐藏的 offscreen PDF 窗口）
  const win =
    BrowserWindow.getAllWindows().find((w) => w.isVisible() && !w.webContents.isOffscreen()) ??
    BrowserWindow.getAllWindows()[0]
  if (!win) {
    console.log('M0_SMOKE_RESULT ' + JSON.stringify({ ok: false, step: 'window', error: 'no window' }))
    app.exit(1)
    return
  }

  // 等渲染进程真正加载完（did-finish-load 后再等一帧）
  if (win.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => resolve())
    })
  }
  await new Promise((r) => setTimeout(r, 800))

  const report: Record<string, unknown> = { window: 'open' }

  try {
    // ② IPC 通信（renderer → preload → main → renderer 往返）
    const ping = (await execJs(win, 'window.electronAPI.app.ping()')) as { pong?: boolean; at?: number }
    report.ipc = { ok: Boolean(ping?.pong), at: ping?.at }
  } catch (err) {
    report.ipc = { ok: false, error: String(err) }
  }

  try {
    // ③ 中文 PDF 导出端到端（含中文字体 HTML；真实链路 renderer → IPC → main）
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page { size: A4; margin: 20mm; }
      body { font-family: "Microsoft YaHei","PingFang SC",sans-serif; }
    </style></head><body><h1>中文简历导出验证</h1><p>字体子集嵌入 · 标点符号。——</p></body></html>`
    const pdf = (await execJs(win, `window.electronAPI.print.pdf(${JSON.stringify(html)})`, 45000)) as {
      data?: Uint8Array
      mimeType?: string
    }
    const bytes = pdf?.data ? new Uint8Array(pdf.data).length : 0
    report.pdf = { ok: bytes > 1000, bytes, mime: pdf?.mimeType }
  } catch (err) {
    report.pdf = { ok: false, error: String(err) }
  }

  try {
    // ④ AI 流式链路（mock 流：验证 IPC chunk 通道）
    const ai = (await execJs(win, 'window.electronAPI.ai.streamTest()')) as { ok?: boolean; full?: string }
    report.ai = { ok: Boolean(ai?.ok), full: ai?.full }
  } catch (err) {
    report.ai = { ok: false, error: String(err) }
  }

  // ⑤ M1 保存链路（F11 三件套，临时目录）
  await runM1SaveLink(win, report)

  const ipcOk = (report.ipc as { ok?: boolean } | undefined)?.ok === true
  const pdfOk = (report.pdf as { ok?: boolean } | undefined)?.ok === true
  const aiOk = (report.ai as { ok?: boolean } | undefined)?.ok === true
  const m1Ok = (report.m1Save as { ok?: boolean } | undefined)?.ok === true
  const sampleOk = (report.sampleLink as { ok?: boolean } | undefined)?.ok === true
  const ok = Boolean(ipcOk && pdfOk && aiOk && m1Ok && sampleOk)
  console.log('M0_SMOKE_RESULT ' + JSON.stringify({ ok, ...report }))
  // 通过「真实关闭主窗口」触发退出（closed → app.quit 生命周期），
  // 验证关闭软件后所有进程（含隐藏 PDF 窗口）都被清理，而不是 app.exit 强制退出。
  win.close()
  // 兜底：15s 后仍未自然退出则强制退出（防生命周期回归死锁）
  setTimeout(() => app.exit(ok ? 0 : 1), 15000)
}

