/**
 * ui_capture.cjs —— UI 启动 + 全功能区截图（AI 开发期工具，2026-08-09 实测验证）
 * 独立 Electron 主进程：加载已构建 renderer（project/out/renderer/index.html）+
 * preload（project/out/preload/index.mjs），capturePage + nativeImage.crop 完成 7 类截图。
 * 零新增依赖（复用项目自带 electron 二进制）；userData 指向临时目录防污染真实数据。
 *
 * 前提：已 `pnpm build`（产出 out/）或等价构建。
 * 用法：
 *   cd project
 *   node_modules\electron\dist\electron.exe ..\scripts\ui_capture.cjs
 * 输出：{repo}/ui_screenshots/{01..07}_*.png + stdout UI_CAP JSON 结果
 *
 * 细节档案见 file/detail/ai-capabilities.md；本脚本为 AI 开发期辅助，非产品代码。
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const REPO = path.resolve(__dirname, '..')
const OUT_DIR = path.join(REPO, 'ui_screenshots')
const PRELOAD = path.join(REPO, 'project', 'out', 'preload', 'index.mjs')
const INDEX = path.join(REPO, 'project', 'out', 'renderer', 'index.html')

// 隔离用户数据（临时目录，不落真实 userData）
app.setPath('userData', path.join(app.getPath('temp'), `xm-ui-cap-${Date.now()}`))

const results = [] // {name, label, ok, path?, error?}
let win = null

function log(j) { console.log('UI_CAP ' + JSON.stringify(j)) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function execJs(code, timeoutMs = 8000) {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('execJs timeout')), timeoutMs)),
  ])
}

// 全窗口截图；UnknownVizError（窗口首帧未合成）等 GPU 瞬态失败重试最多 2 次
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
      log({ event: 'shot-ok', name, label, file, attempt })
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

// 截图窗口内某 CSS 选择器子区域（按 DPR 换算物理像素；单次 capturePage + crop）
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
      log({ event: 'shot-ok', name, label, file, attempt })
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

// 点击按钮：精确文本 → 包含匹配 → title 匹配
const CLICK_JS = (txt) => `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, '').trim();
  const targets = [...document.querySelectorAll('button,a,[role=button],[role=menuitem]')];
  const hit = targets.find(e => norm(e.textContent) === ${JSON.stringify(txt)}) ||
              targets.find(e => norm(e.textContent).includes(${JSON.stringify(txt)})) ||
              targets.find(e => norm(e.title) === ${JSON.stringify(txt)});
  if (!hit) return false;
  hit.click(); return true;
})()`

async function main() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    show: true,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: true,
    },
  })

  if (!fs.existsSync(PRELOAD)) log({ event: 'warn', msg: `preload missing: ${PRELOAD}` })
  await win.loadFile(INDEX)
  await sleep(2500)
  await execJs(
    `window.__errs=[];const _e=console.error.bind(console);console.error=(...a)=>{window.__errs.push(a.map(String).join(' '));_e(...a)};void 0`
  )
  await sleep(400)

  // 1. 完整首页
  await capture('01_home_full', '完整首页（简历卡片列表）')

  // 2. 进入编辑器（点击"新建空白"）
  let entered = false
  for (const label of ['新建空白', '新建']) {
    if (await execJs(CLICK_JS(label))) { entered = true; break }
  }
  if (!entered) {
    await execJs(`(() => { const el = document.querySelector('.home-card') || document.querySelector('.nav-sub'); if (el) el.click(); })()`)
    entered = true
  }
  // 轮询等待编辑器就绪（.editor-pane 出现，最多 8s），避免截到首页
  await execJs(`new Promise((res) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (document.querySelector('.editor-pane')) { clearInterval(iv); res(true); }
      else if (Date.now() - t0 > 8000) { clearInterval(iv); res(false); }
    }, 200);
  })`, 12000)
  await sleep(600)
  await capture('02_editor_full', '完整编辑器（左侧编辑面板 + 右侧实时预览）')

  // 3. 左侧编辑面板 / 4. 右侧实时预览
  await captureRegion('03_editor_left_panel', '左侧编辑面板（模块卡片列表）', '.editor-pane')
  await captureRegion('04_preview_right', '右侧实时预览区域', '.preview-pane')

  // 5. 导出弹窗
  if (await execJs(CLICK_JS('导出'))) {
    await sleep(900)
    await capture('05_export_dialog', '导出弹窗（可展开功能区）')
    await execJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
    await sleep(500)
  } else {
    log({ event: 'shot-fail', name: '05_export_dialog', label: '导出弹窗', error: '未找到导出按钮' })
    results.push({ name: '05_export_dialog', label: '导出弹窗', ok: false, error: '未找到导出按钮' })
  }

  // 6. 隐私模式状态栏（Ctrl+Shift+P）
  await execJs(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true, bubbles: true }))`)
  await sleep(700)
  await capture('06_privacy_mode', '隐私打码模式（预览脱敏 + 状态栏提示）')

  // 7. 导入功能区（回到首页点"导入"）
  const backHome = await execJs(`(() => {
    const h = document.querySelector('.navbar-v2 a, .nav-brand, [data-view="home"]');
    if (h) { h.click(); return true }
    return false;
  })()`)
  await sleep(1200)
  const importClicked = await execJs(CLICK_JS('导入'))
  if (backHome && importClicked) {
    await sleep(1000)
    await capture('07_import_dialog', '导入功能区（格式选择）')
  } else {
    log({ event: 'shot-fail', name: '07_import_dialog', label: '导入功能区', error: `backHome=${backHome} importClicked=${importClicked}` })
    results.push({ name: '07_import_dialog', label: '导入功能区', ok: false, error: `返回首页=${backHome}，导入按钮点击=${importClicked}` })
  }

  let errs = []
  try { errs = JSON.parse(String(await execJs('JSON.stringify(window.__errs)'))) } catch {}
  log({ event: 'console-errors', errs })
  log({ event: 'done', summary: results })
  win.close()
  setTimeout(() => app.exit(0), 3000)
}

app.whenReady().then(main).catch((e) => {
  log({ event: 'fatal', error: String(e) })
  app.exit(1)
})
