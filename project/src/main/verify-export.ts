/**
 * verify-export —— PDF 导出全链路实测（XM_EXPORT_SMOKE=1 时由 index.ts 触发）
 *
 * 目的：防「smoke 绕开 UI 层」复发（M0 smoke 只测 legacy print.pdf，从不点导出按钮）。
 * 本脚本走真实 export:run 链路：
 *   createSample() 造示例简历 → window.electronAPI.export.run({format:'textPdf'})
 *   → 校验 PDF 落盘 + %PDF- 魔数 + 非空。
 *
 * 存储隔离：临时目录（app.getPath('temp')/xm-export-smoke-*），跑完恢复原设置 + 清理。
 * 结果以单行 JSON（EXPORT_SMOKE_RESULT ...）输出，退出码 0=PDF 产出成功。
 */
import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import Store from 'electron-store'
import type { Settings } from '../shared/schema/settings'

/** 调用渲染进程代码并等待结果（含超时兜底，防 renderer 未就绪/永挂） */
async function callRenderer<T>(win: BrowserWindow, code: string, timeoutMs = 45000): Promise<T> {
  return (await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('renderer call timeout')), timeoutMs))
  ])) as T
}

export async function runExportVerify(): Promise<void> {
  const win =
    BrowserWindow.getAllWindows().find((w) => w.isVisible()) ?? BrowserWindow.getAllWindows()[0]
  if (!win) {
    console.log('EXPORT_SMOKE_RESULT ' + JSON.stringify({ ok: false, error: 'no window' }))
    app.exit(1)
    return
  }

  const store = new Store<Settings>()
  const prevStorage = store.get('storage.folderPath')
  const tmpDir = path.join(app.getPath('temp'), `xm-export-smoke-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  store.set('storage.folderPath', tmpDir)

  let exitCode = 1
  try {
    // 等渲染进程就绪（preload 注入 electronAPI + DOM 挂载）
    const deadline = Date.now() + 20000
    let ready = false
    while (Date.now() < deadline) {
      ready = await callRenderer<boolean>(
        win,
        'Boolean(window.electronAPI && window.electronAPI.export && document.body)',
        5000
      ).catch(() => false)
      if (ready) break
      await new Promise((r) => setTimeout(r, 300))
    }
    if (!ready) throw new Error('renderer never ready')

    // 1) 造示例简历（写入临时存储目录）
    const sample = await callRenderer<{ id: string; resume: unknown }>(
      win,
      'window.electronAPI.resumes.createSample()',
      15000
    )
    const resumeId = sample?.id
    if (!resumeId) throw new Error('createSample returned no id')

    // 2) 走真实 export:run 链路（textPdf → printToPDF 单引擎 → 落盘，2026-08-10 B 档）
    //    注意：主进程 export:run 内已有 30s 构建超时（见 run.ts textPdf 分支）；
    //    此处外层 45s 再兜一层。此前的 printToPDF 路线已退役（GPU 依赖）。
    const result = await callRenderer<{ canceled: boolean; filePath?: string; error?: string }>(
      win,
      `window.electronAPI.export.run(${JSON.stringify({
        format: 'textPdf',
        resumeId,
        folderPath: tmpDir,
        pages: 'all'
      })})`,
      45000
    )

    if (result?.error) {
      console.log(
        'EXPORT_SMOKE_RESULT ' + JSON.stringify({ ok: false, error: result.error, resumeId, tmpDir })
      )
      return
    }

    // 3) 校验 PDF：落盘存在 + %PDF- 魔数 + 非空
    const filePath = result?.filePath as string | undefined
    if (!filePath) throw new Error('export:run returned no filePath')
    const data = await fs.readFile(filePath)
    const pdfOk = data.length > 100 && data.subarray(0, 5).toString('ascii') === '%PDF-'
    console.log(
      'EXPORT_SMOKE_RESULT ' +
        JSON.stringify({ ok: pdfOk, filePath, bytes: data.length, magic: data.subarray(0, 8).toString('ascii'), resumeId })
    )
    exitCode = pdfOk ? 0 : 1
  } catch (err) {
    console.log('EXPORT_SMOKE_RESULT ' + JSON.stringify({ ok: false, error: String(err), tmpDir }))
  } finally {
    // 恢复原存储设置 + 清理临时目录
    if (prevStorage !== undefined) store.set('storage.folderPath', prevStorage)
    else store.delete('storage.folderPath')
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    app.exit(exitCode)
  }
}
