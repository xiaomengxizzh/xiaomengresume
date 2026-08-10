/**
 * Tooltip 提示（UI 美化 P1）
 * CSS ::after 方案（对齐 [data-rm-path]:hover::after 既有模式，零 JS/零依赖）；样式在 styles.css `.tooltip-wrap`。
 * 内容走 data-tooltip 属性；文案由调用方传（走 i18n）。
 */
import type { HTMLAttributes, ReactNode } from 'react'

interface TooltipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  content: string
  children?: ReactNode
}

export function Tooltip({
  content,
  className = '',
  children,
  ...props
}: TooltipProps): React.JSX.Element {
  return (
    <span className={`tooltip-wrap inline-flex ${className}`} data-tooltip={content} {...props}>
      {children}
    </span>
  )
}
