/**
 * ui_capture_editor.cjs —— 编辑器界面 + 补采截图（AI 开发期工具，2026-08-11 Batch2 O1/O3 收编）
 * 覆盖 ui_capture_full.cjs 缺失的：编辑器真实界面（欢迎页→新建→编辑器）+ 05 导出弹窗 + 13 AI 设置。
 * 输出 {repo}/ui_screenshots_full/。前提：已 `pnpm build`。
 * 用法：cd project && node_modules\electron\dist\electron.exe ..\scripts\ui_capture_editor.cjs
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const REPO = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO, 'ui_screenshots_full')
const PRELOAD = path.join(REPO, 'project', 'out', 'preload', 'index.mjs')
const INDEX = path.join(REPO, 'project', 'out', 'renderer', 'index.html')
app.setPath('userData', path.join(app.getPath('temp'), `xm-ui-ed-${Date.now()}`))

let win = null
const log = (j) => console.log('UI_ED ' + JSON.stringify(j))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function execJs(code, timeoutMs = 9000) {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('exec timeout')), timeoutMs)),
  ])
}
/** 文案优先匹配，失败按 title/aria-label 关键字定位（图标按钮无文字场景） */
const CLICK_JS = (txt) => `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, '').trim();
  const all = [...document.querySelectorAll('button,a,[role=button],[role=menuitem]')];
  const hit = all.find(e => norm(e.textContent) === ${JSON.stringify(txt)})
    || all.find(e => norm(e.textContent).includes(${JSON.stringify(txt)}))
    || all.find(e => (norm(e.getAttribute('title')) + norm(e.getAttribute('aria-label'))).includes(${JSON.stringify(txt)}));
  if (!hit) return false; hit.click(); return true;
})()`
async function shot(name) {
  try {
    const img = await win.webContents.capturePage()
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), img.toPNG())
    log({ event: 'shot-ok', name })
    return true
  } catch (e) { log({ event: 'shot-fail', name, error: String(e) }); return false }
}

app.whenReady().then(async () => {
  win = new BrowserWindow({ width: 1280, height: 900, show: true, webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: false } })
  await win.loadFile(INDEX)
  await sleep(3000)

  // 欢迎页 → 新建简历 → 新建空白 → 编辑器
  for (const label of ['新建简历', '新建']) { if (await execJs(CLICK_JS(label))) break }
  await sleep(1500)
  for (const label of ['新建空白', '新建空白简历']) { if (await execJs(CLICK_JS(label))) break }
  await execJs(`new Promise((res) => { const t0 = Date.now(); const iv = setInterval(() => { if (document.querySelector('.editor-pane')) { clearInterval(iv); res(true) } else if (Date.now() - t0 > 12000) { clearInterval(iv); res(false) } }, 200) })`, 16000)
  await sleep(1000)
  await shot('ed_editor_full')

  // 05 导出弹窗：编辑器 TopBar 导出按钮（图标，按 title/aria-label 定位）
  if (await execJs(CLICK_JS('导出'))) { await sleep(1200); await shot('ed_export_dialog') }
  else log({ event: '05-notfound' })

  // 13 AI 设置：导航 AI 主项 → 设置子项 → AI 设置分类卡（进入表单页）
  if (await execJs(CLICK_JS('AI'))) {
    await sleep(800)
    if (await execJs(CLICK_JS('设置'))) {
      await sleep(1000)
      if (await execJs(CLICK_JS('AI设置'))) { await sleep(1500); await shot('ed_ai_settings_form') }
      else log({ event: '13-card-notfound' })
    } else log({ event: '13-sub-notfound' })
  } else log({ event: '13-notfound' })

  log({ event: 'done' })
  app.exit(0)
})
