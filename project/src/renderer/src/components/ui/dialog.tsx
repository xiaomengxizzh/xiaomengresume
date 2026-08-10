/**
 * Dialog 模态框（shadcn 风格手写，UI 美化 P1）
 * 全受控自绘：遮罩 + 居中卡片 + Esc/点遮罩关闭；零依赖（不用原生 <dialog> 的 open 属性/::backdrop 怪癖）。
 * 走令牌（bg-surface/border-border/shadow-card-hover），禁硬编码颜色；文案（标题/关闭）由调用方传，走 i18n。
 */
import { useEffect } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'

interface DialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open?: boolean
  title?: ReactNode
  onClose?: () => void
  children?: ReactNode
}

export function Dialog({
  open = false,
  title,
  onClose,
  className = '',
  children,
  ...props
}: DialogProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-[min(90vw,560px)] overflow-y-auto rounded-card border border-border bg-surface p-0 text-foreground shadow-card-hover ${className}`}
        {...props}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-border/60 hover:text-foreground"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
