/**
 * ui_capture_full.cjs —— UI 全审查截图扩展版（AI 开发期工具，2026-08-09）
 * 覆盖原 ui_capture.cjs 的 7 类 + 新增 6 个可交互功能区：
 *   08 导航展开态 / 09 打开或最近 / 10 管理多份 / 11 岗位目录 / 12 AI 语法纠正 / 13 AI 设置
 * 复用 capturePage + crop + CLICK_JS 方案；输出 {repo}/ui_screenshots_full/。
 * 前提：已 `pnpm build`。用法：cd project && node_modules\electron\dist\electron.exe ..\scripts\ui_capture_full.cjs
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const REPO = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO, 'ui_screenshots_full')
const PRELOAD = path.join(REPO, 'project', 'out', 'preload', 'index.mjs')
const INDEX = path.join(REPO, 'project', 'out', 'renderer', 'index.html')

app.setPath('userData', path.join(app.getPath('temp'), `xm-ui-full-${Date.now()}`))

const results = []
let win = null
function log(j) { console.log('UI_CAP ' + JSON.stringify(j)) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function execJs(code, timeoutMs = 8000) {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('execJs timeout')), timeoutMs)),
  ])
}

async function capture(name, label) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const img = await Promise.race([
        win.webContents.capturePage(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capturePage timeout 15s')), 15000)),
      ])
      const file = path.join(OUT_DIR, `${name}.png`)
      fs.mkdirSync(OUT_DIR, { recursive: true })
      fs.writeFileSync(file, img.toPNG())
      log({ event: 'shot-ok', name, label, attempt })
      results.push({ name, label, ok: true, path: file })
      return img
    } catch (e) {
      if (attempt < 2) { await sleep(1500); continue }
      log({ event: 'shot-fail', name, label, error: String(e) })
      results.push({ name, label, ok: false, error: String(e) })
      return null
    }
  }
  return null
}

async function captureRegion(name, label, selector) {
  const rect = await execJs(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })()`)
  if (!rect) {
    log({ event: 'shot-fail', name, label, error: `selector not found: ${selector}` })
    results.push({ name, label, ok: false, error: `selector not found: ${selector}` })
    return
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const img = await Promise.race([
        win.webContents.capturePage(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('capturePage timeout 15s')), 15000)),
      ])
      const winSize = win.getContentSize()
      const scaleX = img.getSize().width / winSize[0]
      const scaleY = img.getSize().height / winSize[1]
      const cropped = img.crop({
        x: Math.round(rect.left * scaleX),
        y: Math.round(rect.top * scaleY),
        width: Math.round(rect.width * scaleX),
        height: Math.round(rect.height * scaleY),
      })
      const file = path.join(OUT_DIR, `${name}.png`)
      fs.mkdirSync(OUT_DIR, { recursive: true })
      fs.writeFileSync(file, cropped.toPNG())
      log({ event: 'shot-ok', name, label, attempt })
      results.push({ name, label, ok: true, path: file })
      return
    } catch (e) {
      if (attempt < 2) { await sleep(1500); continue }
      log({ event: 'shot-fail', name, label, error: String(e) })
      results.push({ name, label, ok: false, error: String(e) })
      return
    }
  }
}

const CLICK_JS = (txt) => `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, '').trim();
  const targets = [...document.querySelectorAll('button,a,[role=button],[role=menuitem]')];
  const hit = targets.find(e => norm(e.textContent) === ${JSON.stringify(txt)}) ||
              targets.find(e => norm(e.textContent).includes(${JSON.stringify(txt)})) ||
              targets.find(e => norm(e.title) === ${JSON.stringify(txt)});
  if (!hit) return false;
  hit.click(); return true;
})()`

// 点击第 n 个主项 ▾ 展开（0 简历 / 1 AI / 2 设置）
const TOGGLE_JS = (n) => `(() => {
  const t = document.querySelectorAll('.nav-main-toggle')[${n}];
  if (!t) return false; t.click(); return true;
})()`

async function main() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: false },
  })
  if (!fs.existsSync(PRELOAD)) log({ event: 'warn', msg: `preload missing: ${PRELOAD}` })
  await win.loadFile(INDEX)
  await sleep(2500)
  await execJs(`window.__errs=[];const _e=console.error.bind(console);console.error=(...a)=>{window.__errs.push(a.map(String).join(' '));_e(...a)};void 0`)
  await sleep(400)

  // 1. 完整首页
  await capture('01_home_full', '完整首页（简历卡片列表）')

  // 2-4. 编辑器三视图（新建空白 + 轮询就绪）
  for (const label of ['新建空白', '新建']) { if (await execJs(CLICK_JS(label))) break }
  await execJs(`new Promise((res) => {
    const t0 = Date.now(); const iv = setInterval(() => {
      if (document.querySelector('.editor-pane')) { clearInterval(iv); res(true); }
      else if (Date.now() - t0 > 8000) { clearInterval(iv); res(false); }
    }, 200);
  })`, 12000)
  await sleep(600)
  await capture('02_editor_full', '完整编辑器（左编辑面板 + 右实时预览）')
  await captureRegion('03_editor_left_panel', '左侧编辑面板（模块卡片列表）', '.editor-pane')
  await captureRegion('04_preview_right', '右侧实时预览区域', '.preview-pane')

  // 5. 导出弹窗（轮询弹窗出现再截图；用「取消」关闭——Escape 关不掉 ExportDialog 已知坑）
  if (await execJs(CLICK_JS('导出'))) {
    await execJs(`new Promise((res) => {
      const t0 = Date.now(); const iv = setInterval(() => {
        if (document.querySelector('[role="dialog"]')) { clearInterval(iv); res(true); }
        else if (Date.now() - t0 > 8000) { clearInterval(iv); res(false); }
      }, 200);
    })`, 12000)
    await sleep(500)
    await capture('05_export_dialog', '导出弹窗')
    await execJs(CLICK_JS('取消'))
    await sleep(500)
  } else {
    results.push({ name: '05_export_dialog', label: '导出弹窗', ok: false, error: '未找到导出按钮' })
  }

  // 6. 隐私模式（Ctrl+Shift+P 开 → 截图 → 关）
  await execJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true, bubbles: true }))`)
  await sleep(700)
  await capture('06_privacy_mode', '隐私打码模式')
  await execJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true, bubbles: true }))`)
  await sleep(400)

  // 7. 导入功能区（点「简历」主项切回首页 → 点导入子项）
  // 注：切首页不能点 .nav-brand（div 无 onClick），须点第一个 .nav-main-text（简历主项 → resumes-home）
  await execJs(`(() => { const t = document.querySelectorAll('.nav-main-text')[0]; if (t) t.click(); })()`)
  await sleep(1200)
  if (await execJs(CLICK_JS('导入'))) { await sleep(1000); await capture('07_import_dialog', '导入功能区（格式选择）') }
  else results.push({ name: '07_import_dialog', label: '导入功能区', ok: false, error: '导入按钮点击失败' })

  // 8. 导航展开态（简历主项 ▾）
  await execJs(TOGGLE_JS(0)); await sleep(600)
  await capture('08_nav_expanded', '导航展开态（简历子项列表）')

  // 9-11. 简历子项 + AI 主页（2026-08-09 T8：打开简历 / 简历管理 / 岗位管理 / AI 主页）
  for (const [label, name, desc] of [
    ['打开简历', '09_open_recent', '打开简历（最近列表）'],
    ['简历管理', '10_resumes_manage', '简历管理'],
    ['岗位管理', '11_jobs_manage', '岗位管理'],
  ]) {
    if (await execJs(CLICK_JS(label))) { await sleep(900); await capture(name, desc) }
    else results.push({ name, label, ok: false, error: `未找到按钮: ${label}` })
  }

  // 12. AI 语法纠正（AI 主项 ▾ → 语法纠正）
  await execJs(TOGGLE_JS(1)); await sleep(600)
  if (await execJs(CLICK_JS('语法纠正'))) { await sleep(1200); await capture('12_ai_grammar', 'AI 语法纠正屏') }
  else results.push({ name: '12_ai_grammar', label: 'AI 语法纠正屏', ok: false, error: '语法纠正按钮点击失败' })

  // 13. AI 设置（设置主项 ▾ → AI 设置）
  await execJs(TOGGLE_JS(2)); await sleep(600)
  if (await execJs(CLICK_JS('AI 设置'))) { await sleep(1200); await capture('13_ai_settings', 'AI 设置屏') }
  else results.push({ name: '13_ai_settings', label: 'AI 设置屏', ok: false, error: 'AI 设置按钮点击失败' })

  let errs = []
  try { errs = JSON.parse(String(await execJs('JSON.stringify(window.__errs)'))) } catch {}
  log({ event: 'console-errors', errs })
  log({ event: 'done', summary: results })
  win.close()
  setTimeout(() => app.exit(0), 3000)
}

app.whenReady().then(main).catch((e) => { log({ event: 'fatal', error: String(e) }); app.exit(1) })
