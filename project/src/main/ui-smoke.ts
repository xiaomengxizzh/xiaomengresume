/**
 * ui-smoke —— UI 级走查（XM_UI_SMOKE=1 时由 index.ts 触发；G.3 双轨制 UI 轨）
 * 目标：防「IPC 级冒烟测不出的接线遗漏」（如 useAutoSave 定义了没人挂载的 P0-1）。
 * 走真实用户旅程：点卡片 → 受控输入编辑 → 500ms 防抖自动保存 → 读盘验证
 *   → app.relaunch() 真重启 → 新进程启动恢复（useAppBootstrap recent[0]）
 *   → UI 断言数据还在 + 磁盘确认 → 清理退出。
 *
 * 与 M0 冒烟的区别：M0 用 executeJavaScript 直调 electronAPI（绕开 UI/React），
 * 本脚本操作真实 DOM 事件（click / 原生 value setter + input），
 * 只有 React 组件树完整接线（事件 → store → useAutoSave → IPC → 落盘）才会通过。
 *
 * 双阶段 + marker 文件（userData/ui-smoke-phase2.json）：
 *   阶段 1：新建→编辑→保存→读盘→写 marker→relaunch（退出码由阶段 2 决定）
 *   阶段 2：重启后启动恢复→UI/磁盘双确认→恢复存储设置→清理→退出
 * 存储隔离：临时目录（app.getPath('temp')/xm-ui-smoke-*），不污染用户数据。
 */
import { app, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import Store from 'electron-store'
import type { Settings } from '../shared/schema/settings'

const TEST_NAME = 'UI走查·重启恢复'
const MARKER_FILE = (): string => path.join(app.getPath('userData'), 'ui-smoke-phase2.json')

/** Windows 杀软/句柄占用下 electron-store 原子写 rename 偶发 EPERM → 退避重试（resume-store 同款对策） */
async function storeSetWithRetry(
  store: Store<Settings>,
  key: 'storage.folderPath',
  value: string | undefined
): Promise<void> {
  const RETRY_CODES = new Set(['EPERM', 'EBUSY'])
  const DELAYS = [150, 300, 600, 1200]
  let lastErr: unknown
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    try {
      if (value === undefined) store.delete(key)
      else store.set(key, value)
      return
    } catch (err) {
      lastErr = err
      const code = (err as NodeJS.ErrnoException | undefined)?.code
      if (!code || !RETRY_CODES.has(code) || attempt === DELAYS.length) break
      await new Promise((r) => setTimeout(r, DELAYS[attempt]))
    }
  }
  throw lastErr
}

interface Marker {
  tmpDir: string
  prevStorage?: string
  name: string
  phase1At: number
}

/** 单步执行 JS，带超时（渲染进程未就绪时防挂死） */
async function execJs(win: BrowserWindow, code: string, timeoutMs = 15000): Promise<unknown> {
  return await Promise.race([
    win.webContents.executeJavaScript(code, true),
    new Promise((_, rej) => setTimeout(() => rej(new Error('executeJavaScript timeout')), timeoutMs))
  ])
}

/** 轮询等待 renderer 中条件成立（code 求值为 truthy） */
async function waitFor(
  win: BrowserWindow,
  code: string,
  what: string,
  timeoutMs = 15000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = await execJs(win, `Boolean(${code})`, 5000).catch(() => false)
    if (v) return
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`waitFor timeout: ${what}`)
}

/** 直接扫存储目录（不经过 resume-store 的 electron-store 缓存），找名字匹配的简历 */
async function findResumeOnDisk(dir: string, name: string): Promise<string | null> {
  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    return null
  }
  for (const f of files) {
    if (!f.endsWith('.json') || f.includes('.bak.') || f.endsWith('.tmp')) continue
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')) as {
        basics?: { name?: string }
      }
      if (raw.basics?.name === name) return f
    } catch {
      /* 单份损坏跳过 */
    }
  }
  return null
}

/** 阶段 1：新建 → 编辑 → 保存 → 读盘验证 → 写 marker → relaunch */
async function runPhase1(win: BrowserWindow): Promise<void> {
  const store = new Store<Settings>()
  const prevStorage = store.get('storage.folderPath')
  const tmpDir = path.join(app.getPath('temp'), `xm-ui-smoke-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  await storeSetWithRetry(store, 'storage.folderPath', tmpDir)

  // 1) 等首页卡片渲染 → 点「新建空白」（ResumesHome items[0]，.home-card 第一个）
  await waitFor(win, "document.querySelector('.home-card') !== null", 'home card', 15000)
  await execJs(win, "document.querySelector('.home-card').click()")

  // 2) 等编辑器顶栏出现（TopBar 简历名输入框）
  await waitFor(win, "document.querySelector('.topbar input') !== null", 'editor topbar', 15000)

  // 3) React 受控输入模拟（原生 setter + input 事件，触发 onChange → setField）
  await execJs(
    win,
    `(() => {
      const input = document.querySelector('.topbar input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(TEST_NAME)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return input.value
    })()`
  )

  // 4) 等 500ms 防抖 + 自动保存落盘（轮询读盘，最多 8s）
  const deadline = Date.now() + 8000
  let onDisk: string | null = null
  while (Date.now() < deadline) {
    onDisk = await findResumeOnDisk(tmpDir, TEST_NAME)
    if (onDisk) break
    await new Promise((r) => setTimeout(r, 300))
  }
  if (!onDisk) throw new Error('phase1: edited resume never reached disk (auto-save wiring broken?)')

  // 5) 写阶段 2 marker（含存储目录路径 + 期望名字 + 原设置，供重启后恢复）
  const marker: Marker = { tmpDir, name: TEST_NAME, phase1At: Date.now() }
  if (prevStorage !== undefined) marker.prevStorage = prevStorage
  await fs.writeFile(MARKER_FILE(), JSON.stringify(marker), 'utf-8')

  console.log(`UI_SMOKE_RESULT ${JSON.stringify({ phase: 1, ok: true, file: onDisk, relaunching: true })}`)
  app.relaunch()
  app.exit(0)
}

/** 阶段 2（重启后）：启动恢复 → UI/磁盘双确认 → 清理 → 退出 */
async function runPhase2(win: BrowserWindow): Promise<void> {
  const marker = JSON.parse(await fs.readFile(MARKER_FILE(), 'utf-8')) as Marker

  // 1) 存储目录未串位：settings 应仍指向临时目录
  const store = new Store<Settings>()
  if (store.get('storage.folderPath') !== marker.tmpDir) {
    throw new Error(`phase2: storage folder mismatch, got ${store.get('storage.folderPath')}`)
  }

  // 2) 启动恢复链路（useAppBootstrap → recent[0] → open → loadResume）完成后，
  //    UI 上简历名应显示 marker.name（受控 input.value）
  const deadline = Date.now() + 15000
  let uiOk = false
  while (Date.now() < deadline) {
    uiOk = (await execJs(
      win,
      `document.querySelector('.topbar input')?.value === ${JSON.stringify(marker.name)}`,
      5000
    ).catch(() => false)) as boolean
    if (uiOk) break
    await new Promise((r) => setTimeout(r, 300))
  }

  // 3) 磁盘确认：临时目录里名字匹配的简历仍在
  const diskFile = await findResumeOnDisk(marker.tmpDir, marker.name)

  // 4) 清理：删 marker、恢复原存储设置、删临时目录
  await fs.unlink(MARKER_FILE()).catch(() => {})
  await storeSetWithRetry(store, 'storage.folderPath', marker.prevStorage)
  await fs.rm(marker.tmpDir, { recursive: true, force: true }).catch(() => {})

  console.log(
    `UI_SMOKE_RESULT ${JSON.stringify({
      phase: 2,
      ok: Boolean(uiOk && diskFile),
      uiRestored: uiOk,
      disk: diskFile,
      name: marker.name
    })}`
  )
  app.exit(uiOk && diskFile ? 0 : 1)
}

export async function runUiSmoke(): Promise<void> {
  const win =
    BrowserWindow.getAllWindows().find((w) => w.isVisible() && !w.webContents.isOffscreen()) ??
    BrowserWindow.getAllWindows()[0]
  if (!win) {
    console.log('UI_SMOKE_RESULT ' + JSON.stringify({ ok: false, phase: 'window', error: 'no window' }))
    app.exit(1)
    return
  }
  console.log(
    `UI_SMOKE_START ${JSON.stringify({ phase: await fs.access(MARKER_FILE()).then(() => '2').catch(() => '1'), loading: win.webContents.isLoading() })}`
  )
  // 等渲染进程加载完（带超时兜底：isLoading 竞态或沙箱慢加载都不得挂死）
  if (win.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      const done = (): void => resolve()
      win.webContents.once('did-finish-load', done)
      setTimeout(done, 5000)
    })
  }
  await new Promise((r) => setTimeout(r, 1000))

  try {
    const markerExists = await fs
      .access(MARKER_FILE())
      .then(() => true)
      .catch(() => false)
    if (markerExists) await runPhase2(win)
    else await runPhase1(win)
  } catch (err) {
    console.log('UI_SMOKE_RESULT ' + JSON.stringify({ ok: false, error: String(err) }))
    app.exit(1)
  }
}
