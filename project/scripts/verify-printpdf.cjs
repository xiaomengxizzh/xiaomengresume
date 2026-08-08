/**
 * verify-printpdf.cjs —— printToPDF 最小化直测（2026-08-08）
 * 核心问题：沙箱无 GPU 环境下 printToPDF 到底能不能产出 PDF？
 * 不依赖应用完整链路（跳过 ExportView/React 就绪轮询），
 * 只验证「隐藏窗口 + 中文 HTML + fonts.ready + printToPDF + 落盘」这个最小内核。
 * 产出 PDF 到 <temp>/xm-printpdf-probe.pdf，控制台输出 PROBE_RESULT JSON。
 * 用法：electron verify-printpdf.cjs [--swiftshader]
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const useSwiftshader = process.argv.includes('--swiftshader')
const outFile = path.join(os.tmpdir(), 'xm-printpdf-probe.pdf')

// HTML 含中文 + 一张底色块，模拟真实简历排版（检测乱码/空页）
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 18mm; }
  body { font-family: "Microsoft YaHei", "SimSun", sans-serif; font-size: 14px; color: #333; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .block { width: 100%; height: 120px; background: #eef2f7; border-radius: 8px; padding: 12px; }
</style></head><body>
  <h1>张三 · 简历导出验证</h1>
  <p>这是一份用于验证 printToPDF 中文渲染与输出的测试页面。</p>
  <div class="block">项目经历：负责跨部门协作与系统架构设计，输出文档 12 份。</div>
</body></html>`

async function main() {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  const tmp = path.join(os.tmpdir(), `xm-printpdf-probe-${Date.now()}.html`)
  fs.writeFileSync(tmp, html, 'utf8')
  try {
    await win.loadFile(tmp)
    // 铁律时序：等字体就绪（带 4s 超时，防无字体环境挂死）
    await Promise.race([
      win.webContents.executeJavaScript('document.fonts.ready.then(() => true)', true),
      new Promise((r) => setTimeout(r, 4000))
    ])
    const t0 = Date.now()
    const data = await Promise.race([
      win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('printToPDF 15s timeout')), 15000))
    ])
    const ms = Date.now() - t0
    fs.writeFileSync(outFile, data)
    const ok = data.length > 100 && data.subarray(0, 5).toString('ascii') === '%PDF-'
    console.log('PROBE_RESULT ' + JSON.stringify({
      ok, swiftshader: useSwiftshader,
      file: outFile, bytes: data.length,
      magic: data.subarray(0, 8).toString('ascii'),
      elapsedMs: ms
    }))
    app.exit(ok ? 0 : 1)
  } catch (err) {
    console.log('PROBE_RESULT ' + JSON.stringify({ ok: false, swiftshader: useSwiftshader, error: String(err) }))
    app.exit(1)
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* 忽略 */ }
  }
}

app.whenReady().then(() => setTimeout(main, 500))
