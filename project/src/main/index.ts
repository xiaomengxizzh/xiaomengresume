import { app, shell, BrowserWindow } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Store from 'electron-store'
import { registerIpc } from './ipc/register'
import { runM0Smoke } from './smoke'
import { runUiSmoke } from './ui-smoke'
import { runUiShot } from './ui-shot'
import { runExportVerify } from './verify-export'
import type { Settings } from '../shared/schema/settings'
import icon from '../../resources/icon.png?asset'

const __dirname = dirname(fileURLToPath(import.meta.url))

const store = new Store<Settings>()

// dev 调试辅助：允许外部 CDP 连接（配合 --remote-debugging-port 使用；生产无端口即无效）
// 必须在 app ready 前调用（Chromium switch 在启动早期生效）
app.commandLine.appendSwitch('remote-allow-origins', '*')

/** F18 首帧注入（M4a 前置 2026-08-09）：读取当前外观 → 经 additionalArguments 传 preload
 *  → preload 同步写 <html data-theme>，防首帧 FOUC（令牌 CSS 骨架已就绪，仅差注入） */
function themeArg(): string {
  const theme = store.get('appearance') ?? 'light'
  return `--xm-theme=${theme}`
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'xiaomengresume',
    icon, // 窗口图标（标题栏/任务栏/Alt-Tab）；打包后 exe 图标由 electron-builder build/icon.png 生成
    // 2026-08-07 导航中枢 + 预览缩放：默认回到 1280×800；预览面板纸张 transform: scale
    // 自适应完整展示，窗口不再需要 1900px 满足 50/50 + 纸张最小宽
    width: 1280,
    height: 800,
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

  win.on('ready-to-show', () => {
    win.show()
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

  // 主窗口关闭 → 非 macOS 立即退出。
  // 注意：隐藏的 PDF 打印窗口会让「window-all-closed」永不触发（它算一个活窗口），
  // 因此退出必须挂在这里，而不是依赖 window-all-closed（否则关闭软件后进程残留）。
  win.on('closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.xiaomengresume.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createMainWindow()
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
    if (!hasVisible) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
