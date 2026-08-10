/**
 * ui-smoke —— UI 级走查（XM_UI_SMOKE=1 时由 index.ts 触发；G.3 双轨制 UI 轨）
 * 目标：防「IPC 级冒烟测不出的接线遗漏」（如 useAutoSave 定义了没人挂载的 P0-1）。
 * 走真实用户旅程：点卡片 → 受控输入编辑 → 500ms 防抖自动保存 → 读盘验证
 *   → 【M2 F5 导出轨：顶栏导出按钮 → 模态 → runExport → textPdf 落盘验证】
 *   → app.relaunch() 真重启 → 新进程启动恢复（useAppBootstrap recent[0]）
 *   → UI 断言数据还在 + 磁盘确认 → 清理退出。
 *
 * 与 M0 冒烟的区别：M0 用 executeJavaScript 直调 electronAPI（绕开 UI/React），
 * 本脚本操作真实 DOM 事件（click / 原生 value setter + input），
 * 只有 React 组件树完整接线（事件 → store → useAutoSave → IPC → 落盘）才会通过。
 *
 * 双阶段 + marker 文件（userData/ui-smoke-phase2.json）：
 *   阶段 1：新建→编辑→保存→读盘验证→导出验证→写 marker→relaunch（退出码由阶段 2 决定）
 *   阶段 2：重启后启动恢复→UI/磁盘双确认→恢复存储设置→清理→退出
 * 存储隔离：临时目录（app.getPath('temp')/xm-ui-smoke-*），不污染用户数据；
 * 导出轨同样把 export.lastFolder 指到临时目录（防记忆目录把 PDF 写到别处），清理时恢复。
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
  key: 'storage.folderPath' | 'export.lastFolder',
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
  prevLastFolder?: string
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

/** 阶段 1：新建 → 编辑 → 保存 → 读盘验证 → 导出轨验证 → 写 marker → relaunch */
async function runPhase1(win: BrowserWindow): Promise<void> {
  const store = new Store<Settings>()
  const prevStorage = store.get('storage.folderPath')
  const prevLastFolder = store.get('export.lastFolder')
  const tmpDir = path.join(app.getPath('temp'), `xm-ui-smoke-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  await storeSetWithRetry(store, 'storage.folderPath', tmpDir)
  // 导出轨验证：显式把导出目录指到临时目录，避免 memory 的 lastFolder 把 PDF 写到别处
  await storeSetWithRetry(store, 'export.lastFolder', tmpDir)

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

  // 4.5) 导出轨验证（2026-08-08 C3：防「导出接线遗漏」复发，P0-1 同款教训）：
  //      真实 DOM 事件走 顶栏导出按钮 → ExportDialog 模态 → runExport → textPdf 落盘
  await verifyExportViaUi(win, tmpDir, TEST_NAME)

  // 5) 写阶段 2 marker（含存储目录路径 + 期望名字 + 原设置，供重启后恢复）
  const marker: Marker = { tmpDir, name: TEST_NAME, phase1At: Date.now() }
  if (prevStorage !== undefined) marker.prevStorage = prevStorage
  if (prevLastFolder !== undefined) marker.prevLastFolder = prevLastFolder
  await fs.writeFile(MARKER_FILE(), JSON.stringify(marker), 'utf-8')

  console.log(`UI_SMOKE_RESULT ${JSON.stringify({ phase: 1, ok: true, file: onDisk, relaunching: true })}`)
  app.relaunch()
  app.exit(0)
}

/** 导出轨 UI 级走查：点顶栏「导出」→ ExportDialog → 点「导出」主按钮 → 轮询 textPdf 落盘（%PDF- 魔数） */
async function verifyExportViaUi(win: BrowserWindow, dir: string, name: string): Promise<void> {
  // 1) 点顶栏「导出」按钮（ExportDialog 打开，EditorView onExport → setExportOpen(true)）
  const clicked = await execJs(
    win,
    `(() => {
      const btn = [...document.querySelectorAll('.topbar button')].find(
        (b) => (b.textContent ?? '').trim() === ${JSON.stringify('导出')}
      )
      if (!btn) return false
      btn.click()
      return true
    })()`
  )
  if (!clicked) throw new Error('phase1: export button not found in topbar')

  // 2) 等 ExportDialog 模态出现（role=dialog；aria-label 由 i18n export.title 提供）
  await waitFor(win, "document.querySelector('[role=dialog]') !== null", 'export dialog', 15000)

  // 3) 点主按钮「导出」（ExportDialog 内唯一文本===导出 的 button；文本走 i18n export.run）
  const runClicked = await execJs(
    win,
    `(() => {
      const dlg = document.querySelector('[role=dialog]')
      if (!dlg) return false
      const btn = [...dlg.querySelectorAll('button')].find(
        (b) => (b.textContent ?? '').trim() === ${JSON.stringify('导出')}
      )
      if (!btn) return false
      btn.click()
      return true
    })()`
  )
  if (!runClicked) throw new Error('phase1: export run button not found in dialog')

  // 4) 等 textPdf 落盘（B 档 2026-08-10：主进程 export 模式真实模板 → printToPDF 单引擎；90s 兜底）
  const deadline = Date.now() + 90_000
  let pdfOk = false
  while (Date.now() < deadline) {
    try {
      const files = await fs.readdir(dir)
      const pdf = files.find((f) => f.endsWith('.pdf'))
      if (pdf) {
        const buf = await fs.readFile(path.join(dir, pdf))
        // %PDF- 魔数 + 非空（与 build.test.ts 同判据）
        pdfOk = buf.length > 100 && buf.subarray(0, 5).toString('ascii') === '%PDF-'
        if (pdfOk) break
      }
    } catch {
      /* 目录尚未出现/文件正在写 → 继续轮询 */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!pdfOk) throw new Error('phase1: textPdf never landed on disk (export wiring broken?)')
  console.log(`UI_SMOKE_EXPORT ${JSON.stringify({ ok: true, name })}`)
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

  // 4) 清理：删 marker、恢复原存储设置、恢复导出记忆目录、删临时目录
  await fs.unlink(MARKER_FILE()).catch(() => {})
  await storeSetWithRetry(store, 'storage.folderPath', marker.prevStorage)
  await storeSetWithRetry(store, 'export.lastFolder', marker.prevLastFolder)
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
