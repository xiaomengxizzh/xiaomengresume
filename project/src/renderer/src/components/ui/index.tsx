/**
 * ui 基础组件（shadcn 风格手写，D1 拍板：M1 引入 Tailwind v4）
 * 全部走令牌（bg-surface / text-foreground / border-border），禁硬编码颜色。
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'ghost' | 'outline' | 'danger'

const BTN_VARIANTS: Record<Variant, string> = {
  default: 'bg-foreground text-surface hover:opacity-85',
  ghost: 'text-foreground hover:bg-border/50',
  outline: 'border border-border text-foreground hover:bg-border/40',
  danger: 'bg-danger text-white hover:opacity-85'
}

export function Button({
  className = '',
  variant = 'default',
  size = 'md',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }): React.JSX.Element {
  const sizes = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-1.5 text-[13px]' }
  return (
    <button
      className={`inline-flex cursor-pointer select-none items-center justify-center gap-1 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${BTN_VARIANTS[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={`w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-foreground/50 focus:ring-2 focus:ring-foreground/10 ${className}`}
      {...props}
    />
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return (
    <textarea
      className={`w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground/40 focus:border-foreground/50 focus:ring-2 focus:ring-foreground/10 ${className}`}
      {...props}
    />
  )
}

export function Select({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children?: ReactNode }): React.JSX.Element {
  return (
    <select
      className={`w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-foreground/50 focus:ring-2 focus:ring-foreground/10 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

/* ── UI 美化 P1：新增组件（分文件，shadcn 风格手写，零 Radix 依赖）────── */
export { Switch } from './switch'
export { Dialog } from './dialog'
export { Slider } from './slider'
export { Badge } from './badge'
export { Tooltip } from './tooltip'
export { Label } from './label'
export { Progress } from './progress'
export { EmptyState } from './empty-state'
