/**
 * Badge 徽标（shadcn 风格手写，UI 美化 P1）
 * 变体对齐语义色令牌（default/success/warning/danger/outline，同 .status-badge 语义）；禁硬编码颜色。
 */
import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'outline'

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-border text-foreground',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  outline: 'border border-border text-foreground'
}

export function Badge({
  className = '',
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
