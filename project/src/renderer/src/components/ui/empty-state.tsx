/**
 * EmptyState 空态/错误态（UI 美化 P1-5）
 * 内联 SVG 图标 + 标题 + 描述 + 操作按钮；走令牌，禁硬编码颜色；文案由调用方传（走 i18n）。
 * 按钮内联实现（不从 ./index 导入，避免 re-export 循环依赖）。
 */
import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** 状态标题（如"暂无简历"） */
  title: string
  /** 辅助描述 */
  desc?: string
  /** 主操作（如"新建空白"） */
  action?: { label: string; onClick: () => void }
  /** 次操作（如"重试"） */
  secondary?: { label: string; onClick: () => void }
  /** error 态（警示色 + 警示图标） */
  error?: boolean
  children?: ReactNode
}

const BTN =
  'inline-flex cursor-pointer select-none items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50'
const BTN_PRIMARY = 'bg-foreground text-surface hover:opacity-85'
const BTN_OUTLINE = 'border border-border text-foreground hover:bg-border/40'

export function EmptyState({ title, desc, action, secondary, error = false }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-[420px] flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface px-6 py-10 text-center shadow-card-press">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          error ? 'bg-danger-bg text-danger' : 'bg-border/50 text-foreground/50'
        }`}
        aria-hidden
      >
        {error ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <circle cx="12" cy="16.5" r="0.6" fill="currentColor" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v4h4" />
            <path d="M9 13h6M9 17h4" />
          </svg>
        )}
      </div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {desc ? <div className="max-w-[340px] text-xs leading-relaxed text-foreground/60">{desc}</div> : null}
      {action || secondary ? (
        <div className="mt-1 flex items-center gap-2">
          {action ? (
            <button type="button" className={`${BTN} ${BTN_PRIMARY}`} onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
          {secondary ? (
            <button type="button" className={`${BTN} ${BTN_OUTLINE}`} onClick={secondary.onClick}>
              {secondary.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
