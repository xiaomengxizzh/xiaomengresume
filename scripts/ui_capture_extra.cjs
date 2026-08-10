/**
 * ui_capture_extra.cjs —— 补跑 10-13 功能区截图（AI 开发期工具，2026-08-09）
 * 10 管理多份 / 11 岗位目录 / 12 AI 语法纠正 / 13 AI 设置；带点击结果与视图状态日志。
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const REPO = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO, 'ui_screenshots_full')
const PRELOAD = path.join(REPO, 'project', 'out', 'preload', 'index.mjs')
const INDEX = path.join(REPO, 'project', 'out', 'renderer', 'index.html')
app.setPath('userData', path.join(app.getPath('temp'), `xm-ui-extra-${Date.now()}`))

let win = null
const log = (j) => console.log('UI_CAP ' + JSON.stringify(j))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function execJs(code, timeoutMs = 8000) {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('execJs timeout')), timeoutMs)),
  ])
}
async function capture(name, label) {
  for (let a = 0; a < 3; a++) {
    try {
      const img = await win.webContents.capturePage()
      const file = path.join(OUT_DIR, `${name}.png`)
      fs.mkdirSync(OUT_DIR, { recursive: true })
      fs.writeFileSync(file, img.toPNG())
      log({ event: 'shot-ok', name, label, attempt: a })
      return true
    } catch (e) { if (a < 2) { await sleep(1500); continue } log({ event: 'shot-fail', name, error: String(e) }); return false }
  }
  return false
}
const CLICK_JS = (txt) => `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, '').trim();
  const targets = [...document.querySelectorAll('button,a,[role=button],[role=menuitem]')];
  const hit = targets.find(e => norm(e.textContent) === ${JSON.stringify(txt)}) ||
              targets.find(e => norm(e.textContent).includes(${JSON.stringify(txt)})) ||
              targets.find(e => norm(e.title) === ${JSON.stringify(txt)});
  if (!hit) return false; hit.click(); return true;
})()`
const TOGGLE_JS = (n) => `(() => { const t = document.querySelectorAll('.nav-main-toggle')[${n}]; if (!t) return false; t.click(); return true; })()`

async function main() {
  win = new BrowserWindow({ width: 1440, height: 900, show: true, webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: false } })
  await win.loadFile(INDEX)
  await sleep(2500)

  // 展开简历子项 → 管理多份 / 岗位目录
  log({ event: 'toggle0', ok: await execJs(TOGGLE_JS(0)) })
  await sleep(500)
  log({ event: 'click-manage', ok: await execJs(CLICK_JS('管理多份')) })
  await sleep(1200)
  log({ event: 'view-manage', view: await execJs(`document.body.innerText.slice(0,80)`) })
  await capture('10_manage_list', '管理多份（简历列表）')
  log({ event: 'click-jobs', ok: await execJs(CLICK_JS('岗位目录')) })
  await sleep(1200)
  log({ event: 'view-jobs', view: await execJs(`document.body.innerText.slice(0,80)`) })
  await capture('11_jobs_home', '岗位目录（F19）')

  // AI 子项 → 语法纠正
  log({ event: 'toggle1', ok: await execJs(TOGGLE_JS(1)) })
  await sleep(500)
  log({ event: 'click-grammar', ok: await execJs(CLICK_JS('语法纠正')) })
  await sleep(1500)
  log({ event: 'view-ai', view: await execJs(`document.body.innerText.slice(0,100)`) })
  await capture('12_ai_grammar', 'AI 语法纠正屏')

  // 设置子项 → AI 设置
  log({ event: 'toggle2', ok: await execJs(TOGGLE_JS(2)) })
  await sleep(500)
  log({ event: 'click-aisettings', ok: await execJs(CLICK_JS('AI 设置')) })
  await sleep(1500)
  log({ event: 'view-settings', view: await execJs(`document.body.innerText.slice(0,100)`) })
  await capture('13_ai_settings', 'AI 设置屏')

  win.close()
  setTimeout(() => app.exit(0), 3000)
}
app.whenReady().then(main).catch((e) => { log({ event: 'fatal', error: String(e) }); app.exit(1) })
