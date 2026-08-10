/**
 * Progress 进度条（shadcn 风格手写，UI 美化 P1）；走令牌，禁硬编码颜色。
 */
import type { HTMLAttributes } from 'react'

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value?: number
}

export function Progress({
  value = 0,
  className = '',
  ...props
}: ProgressProps): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-border ${className}`}
      {...props}
    >
      <div
        className="h-full rounded-full bg-foreground transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
