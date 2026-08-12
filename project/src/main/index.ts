import { app, shell, BrowserWindow, Tray, Menu, nativeImage, ipcMain, protocol, session, nativeTheme, net, dialog } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import Store from 'electron-store'
import { registerIpc } from './ipc/register'
import { runM0Smoke } from './smoke'
import { runUiSmoke } from './ui-smoke'
import { runUiShot } from './ui-shot'
import { runExportVerify } from './verify-export'
import type { Settings } from '../shared/schema/settings'
import { IPC } from '../shared/ipc-channels'
import { getWindowState, trackWindowState, applyMaximized } from './files/window-state'
import { getFontsDir, ensureFontsDir } from './files/font-store'
import icon from '../../resources/icon.png?asset'

// 2026-08-09 真机修复（用户报告：编辑区文本框鼠标点击无反应/光标不出现，稳定复现于 dev 模式）。
// 双模式诊断（build 产物 + dev/StrictMode）代码层均无法复现（elementFromPoint 无遮挡、
// sendInputEvent 真实点击聚焦正常、富文本 ProseMirror 正常）——症状符合 Chromium GPU 合成层
// 未更新聚焦态（DevTools 开关会改变合成路径可验证）。禁用硬件加速走软件合成（可逆；影响：
// 渲染走 CPU，桌面表单类应用可接受；printToPDF 为软件路径不受影响）。若用户验证无效可删除此行回退。
app.disableHardwareAcceleration()

// M5 D5：font:// 自定义协议（导入字体服务）——privileges 必须在 app ready 前注册（仅一次）
// standard：相对路径解析；stream：流式响应（@font-face 期望）；bypassCSP：字体不受 CSP 拦
protocol.registerSchemesAsPrivileged([
  { scheme: 'font', privileges: { standard: true, stream: true, bypassCSP: true, supportFetchAPI: true } }
])

const __dirname = dirname(fileURLToPath(import.meta.url))

const store = new Store<Settings>()

// M5 D4 窗口/托盘（2026-08-12）：模块级持引用防 GC 图标消失；isQuitting 区分「关窗→托盘」与「真退出」
let isQuitting = false
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
/** 关窗→托盘：给渲染层 saveNow 落盘留出时间（beforeunload 不触发于 hide，见 D7） */
const HIDE_SAVE_DELAY_MS = 80

/** M5 D4：托盘（方案 A：关窗→托盘驻留；菜单「打开/退出」，图标 = 品牌 logo 与打包 icon 同源） */
function createTray(win: BrowserWindow): void {
  const image = nativeImage.createFromPath(icon)
  tray = new Tray(image)
  tray.setToolTip('xiaomengresume')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开', click: () => { win.show(); win.focus() } },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
  )
}

// 真退出（托盘「退出」/ 系统退出）放行 close；否则 close = 托盘驻留
app.on('before-quit', () => {
  isQuitting = true
})

// dev 调试辅助：允许外部 CDP 连接（配合 --remote-debugging-port 使用；生产无端口即无效）
// 必须在 app ready 前调用（Chromium switch 在启动早期生效）
app.commandLine.appendSwitch('remote-allow-origins', '*')

/** F18 首帧注入（M4a 前置 2026-08-09）：读取当前外观 → 经 additionalArguments 传 preload
 *  → preload 同步写 <html data-theme>，防首帧 FOUC（令牌 CSS 骨架已就绪，仅差注入）。
 *  M5-4 完善：dark + 跟随系统时按 nativeTheme 实际深浅注入（首帧即反映系统） */
function themeArg(): string {
  const appearance = store.get('appearance') ?? 'light'
  const mode = store.get('appearanceMode') ?? 'fixed'
  const theme =
    mode === 'system' && appearance === 'dark'
      ? nativeTheme.shouldUseDarkColors
        ? 'dark'
        : 'light'
      : appearance
  return `--xm-theme=${theme}`
}

async function createMainWindow(): Promise<BrowserWindow> {
  // M5 D4：窗口状态记忆（位置/尺寸/最大化，多屏校验；独立 window-state.json 不碰 SettingsSchema）
  const saved = await getWindowState({ width: 1280, height: 800 })
  const win = new BrowserWindow({
    title: 'xiaomengresume',
    icon, // 窗口图标（标题栏/任务栏/Alt-Tab）；打包后 exe 图标由 electron-builder build/icon.png 生成
    // M5 D4 无边框：自绘三按钮（最小化/最大化/关闭）+ 顶部拖拽区（App 根 window-drag-region）
    frame: false,
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#F5F5F5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // F18 首帧注入：外观经 additionalArguments 同步传给 preload（防 FOUC）
      additionalArguments: [themeArg()]
    }
  })
  mainWindow = win
  // 恢复最大化（ready-to-show 后 maximize，先 max 后 show 防闪跳）
  applyMaximized(win, saved.isMaximized === true)
  // 窗口状态防抖保存（resize/move → 500ms 落盘；close 前 flush）
  trackWindowState(win)

  win.on('ready-to-show', () => {
    win.show()
  })

  // M5 D4 + 2026-08-12：关窗行为——settings.closeBehavior 决定托盘驻留 / 直接关闭；
  // 未设置（首次关窗）弹原生选择框（最小化托盘 / 直接关闭 + 下次不再询问）。
  // 中文文案豁免：主进程无 i18n 资源（与 SECTION_TITLES 同类 CH4 豁免），按 settings.language 双语分支。
  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    void (async (): Promise<void> => {
      let behavior = store.get('closeBehavior')
      if (!behavior) {
        const isZh = (store.get('language') ?? 'zh-CN') === 'zh-CN'
        const r = await dialog.showMessageBox(win, {
          type: 'question',
          title: 'xiaomengresume',
          message: isZh ? '关闭窗口时，希望应用如何运行？' : 'When closing the window, how should the app behave?',
          buttons: isZh ? ['最小化到托盘', '直接关闭'] : ['Minimize to tray', 'Close window'],
          checkboxLabel: isZh ? '下次不再询问' : "Don't ask again",
          defaultId: 0,
          cancelId: 1
        })
        behavior = r.response === 0 ? 'tray' : 'quit'
        if (r.checkboxChecked) store.set('closeBehavior', behavior)
      }
      if (behavior === 'tray') {
        win.webContents.send('window:before-hide')
        setTimeout(() => {
          if (!win.isDestroyed()) win.hide()
        }, HIDE_SAVE_DELAY_MS)
      } else {
        isQuitting = true
        win.close() // 放行（isQuitting 已置，不再次拦截）
      }
    })()
  })
  // 最大化态广播（渲染层按钮图标切换）
  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))
  win.on('closed', () => {
    mainWindow = null
    tray?.destroy()
    tray = null
  })

  // 外部链接一律走系统浏览器，不在应用内开窗
  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createTray(win)
  return win
}

/** M5 D4：窗口控制 IPC（单向 send，无返回值） */
function registerWindowControls(): void {
  ipcMain.on(IPC.Window.Minimize, () => mainWindow?.minimize())
  ipcMain.on(IPC.Window.MaximizeToggle, () => {
    const w = mainWindow
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on(IPC.Window.Close, () => mainWindow?.close())
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.xiaomengresume.app')

  // M5 D5：font:// 协议服务 userData/fonts/ 文件（path.resolve + 前缀校验防越出目录）
  protocol.handle('font', async (req) => {
    try {
      const url = new URL(req.url)
      const fontsDir = resolve(getFontsDir())
      const filePath = resolve(fontsDir, url.pathname.replace(/^\//, ''))
      if (!filePath.startsWith(fontsDir + '\\') && !filePath.startsWith(fontsDir + '/')) {
        return new Response('forbidden', { status: 403 })
      }
      await ensureFontsDir()
      return net.fetch(pathToFileURL(filePath).toString())
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
  // M5 D5：Local Font Access API（queryLocalFonts 系统字体枚举）——只放行 local-fonts 权限
  // （Electron Permission 类型枚举未含 local-fonts，按字符串比对）
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback((permission as string) === 'local-fonts')
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  void createMainWindow()
  registerWindowControls()
  // PDF 打印窗口按需懒创建（printHtmlToPdf 首次调用时建立），避免隐藏窗阻塞退出生命周期
  registerIpc()

  // M0 自动冒烟：XM_M0_SMOKE=1 时跑完四条链路自动退出（供沙箱/CI/本机验收）
  if (process.env.XM_M0_SMOKE === '1') {
    setTimeout(() => void runM0Smoke(), 2500)
  }

  // UI 级走查（G.3 双轨制 UI 轨 · 2026-08-08）：XM_UI_SMOKE=1 时走真实用户旅程
  // 新建→编辑→自动保存→relaunch 重启→启动恢复→确认数据还在（防 P0-1 类接线遗漏）
  if (process.env.XM_UI_SMOKE === '1') {
    setTimeout(() => void runUiSmoke(), 2500)
  }

  // UI 自检：XM_UI_SHOT=1 时截图渲染页面 + 收集 console 错误（本地检查用）
  if (process.env.XM_UI_SHOT === '1') {
    setTimeout(() => void runUiShot(), 2500)
  }

  // PDF 导出全链路实测（2026-08-08）：XM_EXPORT_SMOKE=1 时走真实 export:run 链路
  // createSample → 导出窗口 → printToPDF → 落盘校验（防 M0 smoke 只测 legacy print.pdf 的盲区）
  if (process.env.XM_EXPORT_SMOKE === '1') {
    setTimeout(() => void runExportVerify(), 2500)
  }

  app.on('activate', () => {
    // 以「可见窗口」判断重建：隐藏的 PDF 打印窗口不应阻止主窗口重建（macOS 惯例）
    const hasVisible = BrowserWindow.getAllWindows().some((w) => w.isVisible())
    if (!hasVisible) void createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
