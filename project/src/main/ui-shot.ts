/**
 * ui-shot —— 本地 UI 自检（XM_UI_SHOT=1 触发，2026-08-07）
 * 从主进程直接 capturePage 截图渲染页面（绕开 CDP origin 校验），并收集 console 错误。
 * 用法：XM_UI_SHOT=1 pnpm dev -- --in-process-gpu --disable-gpu
 * 输出：{project}/.workbuddy/tmp/ui-shot-*.png + UI_SHOT_RESULT JSON（stdout，自动退出）
 */
import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

const OUT = path.join(app.getAppPath(), '..', '.workbuddy', 'tmp')

async function execJs(win: BrowserWindow, code: string, timeoutMs = 8000): Promise<unknown> {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('execJs timeout')), timeoutMs))
  ])
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function shot(win: BrowserWindow, name: string): Promise<void> {
  try {
    // 2026-08-07 二次评估采纳：capturePage 无 GPU 环境可能永久挂起（沙箱假阳性）
    // → Promise.race 15s 超时，超时记为 SHOT_TIMEOUT 而非卡死整轮自检
    const img = await Promise.race([
      win.webContents.capturePage(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('capturePage timeout 15s')), 15000))
    ])
    const file = path.join(OUT, `ui-shot-${name}.png`)
    await fs.mkdir(OUT, { recursive: true })
    await fs.writeFile(file, img.toPNG())
    console.log('UI_SHOT_SAVED', name, file)
  } catch (e) {
    console.log('UI_SHOT_FAIL', name, String(e))
  }
}

export async function runUiShot(): Promise<void> {
  const win = BrowserWindow.getAllWindows().find((w) => w.isVisible()) ?? BrowserWindow.getAllWindows()[0]
  if (!win) {
    console.log('UI_SHOT_RESULT ' + JSON.stringify({ ok: false, step: 'no-window' }))
    app.exit(1)
    return
  }
  if (win.webContents.isLoading()) {
    await new Promise<void>((res) => win.webContents.once('did-finish-load', () => res()))
  }
  await sleep(1200)

  // 收集 console 错误/警告
  await execJs(
    win,
    "window.__errs=[];window.__warns=[];const _e=console.error.bind(console), _w=console.warn.bind(console);" +
    "console.error=(...a)=>{window.__errs.push(a.map(String).join(' '));_e(...a)};" +
    "console.warn=(...a)=>{window.__warns.push(a.map(String).join(' '));_w(...a)};"
  )
  await sleep(500)

  // 1. 首页（简历 5 卡）
  await shot(win, '1-home')
  const home = await execJs(win, `JSON.stringify({
    nav: !!document.querySelector('.navbar-v2'),
    brand: document.querySelector('.nav-brand')?.textContent,
    items: document.querySelectorAll('.nav-main-text').length,
    cards: document.querySelectorAll('.home-card').length,
    navW: document.querySelector('.navbar-v2')?.getBoundingClientRect().width,
    shell: getComputedStyle(document.querySelector('.editor-shell')).display,
    area: getComputedStyle(document.querySelector('.main-area')).display
  })`)
  console.log('UI_SHOT_HOME ' + home)

  // 2. 展开"简历"子功能
  await execJs(win, `document.querySelectorAll('.nav-main-toggle')[0]?.click()`)
  await sleep(400)
  await shot(win, '2-nav-expanded')
  const subs = await execJs(win, `JSON.stringify({
    subCount: document.querySelectorAll('.nav-sub').length,
    subFont: getComputedStyle(document.querySelector('.nav-sub')).fontSize,
    mainFont: getComputedStyle(document.querySelector('.nav-main-text')).fontSize
  })`)
  console.log('UI_SHOT_SUBS ' + subs)

  // 3. 点"新建空白"进编辑器
  await execJs(win, `(() => { for (const s of document.querySelectorAll('.nav-sub')) { if (s.textContent.includes('新建空白')) { s.click(); return true; } } return false; })()`)
  await sleep(1000)
  await shot(win, '3-editor-empty')
  const ed = await execJs(win, `JSON.stringify({
    workspace: !!document.querySelector('.workspace'),
    split: getComputedStyle(document.querySelector('.editor-pane')).width,
    previewW: document.querySelector('.preview-pane')?.getBoundingClientRect().width,
    layoutBar: !!document.querySelector('.layout-bar')
  })`)
  console.log('UI_SHOT_EDITOR ' + ed)

  // 4. 打开示例（Ctrl+Shift+O）
  await execJs(win, `window.dispatchEvent(new KeyboardEvent('keydown',{key:'o',ctrlKey:true,shiftKey:true,bubbles:true}))`)
  await sleep(1200)
  await shot(win, '4-sample')
  const sp = await execJs(win, `JSON.stringify({
    paper: !!document.querySelector('.preview-paper'),
    name: document.querySelector('.preview-paper h1')?.textContent,
    img: !!document.querySelector('.preview-paper img'),
    infoIcons: document.querySelectorAll('.preview-paper [data-rm-path="basics"] svg').length,
    infoValues: [...document.querySelectorAll('[data-rm-path="basics"] span')].map(e=>e.textContent).filter(t=>t&&t.length>0&&t.length<20).slice(0,8)
  })`)
  console.log('UI_SHOT_SAMPLE ' + sp)

  // 5. console 错误/警告
  const errs = await execJs(win, 'JSON.stringify(window.__errs)')
  const warns = await execJs(win, 'JSON.stringify(window.__warns)')
  console.log('UI_SHOT_CONSOLE ' + JSON.stringify({ errs: JSON.parse(String(errs)), warns: JSON.parse(String(warns)) }))

  console.log('UI_SHOT_RESULT ' + JSON.stringify({ ok: true }))
  win.close()
  setTimeout(() => app.exit(0), 8000)
}
