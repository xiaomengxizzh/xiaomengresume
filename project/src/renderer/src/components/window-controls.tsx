/**
 * window-controls.tsx —— M5 D4 无边框窗口自绘三按钮（最小化 / 最大化还原 / 关闭→托盘）
 * 位置：App 根 fixed 右上（top:12 / right:12，F18 §3.15.1 定案参数），no-drag 可点击；
 * 图标内联 SVG 零依赖；最大化态经 onMaximized 广播切换（win maximize/unmaximize）。
 */
import { useEffect, useState } from 'react'

function MinimizeIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M1 6.5h10" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  )
}

function MaximizeIcon({ restore }: { restore: boolean }): React.JSX.Element {
  return restore ? (
    // 还原（两个错位方块）
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.5" y="3.5" width="7" height="7" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M4 1.5h6.5V8" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  ) : (
    // 最大化（单方块）
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  )
}

function CloseIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  )
}

export function WindowControls(): React.JSX.Element {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => window.electronAPI.window.onMaximized(setMaximized), [])

  const btn =
    'flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-selected/60 hover:text-foreground'
  return (
    <div className="window-controls" aria-label="窗口控制" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <button type="button" className={btn} title="最小化" aria-label="最小化" onClick={() => window.electronAPI.window.minimize()}>
        <MinimizeIcon />
      </button>
      <button
        type="button"
        className={btn}
        title={maximized ? '还原' : '最大化'}
        aria-label={maximized ? '还原' : '最大化'}
        onClick={() => window.electronAPI.window.maximizeToggle()}
      >
        <MaximizeIcon restore={maximized} />
      </button>
      <button type="button" className={`${btn} hover:bg-red-500/80 hover:text-white`} title="关闭" aria-label="关闭" onClick={() => window.electronAPI.window.close()}>
        <CloseIcon />
      </button>
    </div>
  )
}
