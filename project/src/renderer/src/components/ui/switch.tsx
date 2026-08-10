/**
 * Switch 开关（shadcn 风格手写，UI 美化 P1）
 * 原生 button role=switch；走令牌（bg-foreground/bg-border/bg-surface），禁硬编码颜色。
 */
import type { ButtonHTMLAttributes } from 'react'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function Switch({
  className = '',
  checked = false,
  onCheckedChange,
  type = 'button',
  disabled,
  ...props
}: SwitchProps): React.JSX.Element {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 disabled:pointer-events-none disabled:opacity-50 ${
        checked ? 'bg-foreground' : 'bg-border'
      } ${className}`}
      {...props}
    >
      <span
        aria-hidden
        className={`block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}
