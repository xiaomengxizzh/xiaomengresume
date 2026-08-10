/**
 * Slider 滑杆（shadcn 风格手写，UI 美化 P1）
 * 原生 range 样式化（accent-color 走 --foreground，对齐 .layout-bar-item input[type=range] 既有用法）；禁硬编码颜色。
 */
import type { InputHTMLAttributes } from 'react'

export function Slider({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      type="range"
      className={`h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground ${className}`}
      {...props}
    />
  )
}
