/**
 * Label 表单标签（shadcn 风格手写，UI 美化 P1）；走令牌，禁硬编码颜色。
 */
import type { LabelHTMLAttributes } from 'react'

export function Label({
  className = '',
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>): React.JSX.Element {
  return (
    <label className={`text-[13px] font-medium leading-none text-foreground ${className}`} {...props} />
  )
}
