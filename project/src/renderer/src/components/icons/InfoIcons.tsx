/**
 * InfoIcons —— 基础信息图标（2026-08-07 UI 重构 · 2026-08-10 架构收敛批）
 * 零依赖手画 SVG（lucide 风格）：24×24 / stroke 2 / currentColor / 圆角线帽。
 * 2026-08-10：SVG 元素数据收敛至 shared/templates/layout.ts INFO_ICON_ELEMENTS
 * （与 PDF 端 PdfIcon 同源引用，杜绝双份 path 漂移）；本组件负责 DOM/SVG 适配渲染。
 * InfoIconId 来自 shared/constants/info-icons（与 schema 共享字面量源）。
 */
import type { CSSProperties } from 'react'
import type { InfoIconId } from '@shared/constants/info-icons'
import { INFO_ICON_ELEMENTS } from '@shared/templates/layout'

export { INFO_ICON_IDS } from '@shared/constants/info-icons'
export type { InfoIconId } from '@shared/constants/info-icons'

interface IconProps {
  size?: number
  style?: CSSProperties
  className?: string
}

const base = (size = 14): { width: number; height: number; viewBox: string } => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24'
})

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
}

export function InfoIcon({ id, size, style, className }: { id: InfoIconId } & IconProps): React.JSX.Element {
  const s = base(size ?? 14)
  const els = INFO_ICON_ELEMENTS[id]
  return (
    <svg {...s} style={style} className={className} {...common}>
      {(els ?? []).map((el, i) => {
        if (el.kind === 'rect') return <rect key={i} {...(el.props as Record<string, number>)} />
        if (el.kind === 'circle') return <circle key={i} {...(el.props as Record<string, number>)} />
        return <path key={i} d={el.props.d as string} />
      })}
    </svg>
  )
}
