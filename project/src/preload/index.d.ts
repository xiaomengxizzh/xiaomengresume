import type { ElectronAPI } from './index'

declare global {
  interface Window {
    electronAPI: ElectronAPI
    /** M2 F5 D10：导出模式 React 就绪标志（打印窗口置位，主进程 waitForReact 轮询） */
    __exportReady?: boolean
  }
}

export {}
