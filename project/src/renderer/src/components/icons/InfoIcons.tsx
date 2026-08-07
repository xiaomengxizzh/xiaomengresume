/**
 * InfoIcons —— 基础信息图标（2026-08-07 UI 重构 · PDF 还原）
 * 零依赖手画 SVG（lucide 风格）：24×24 / stroke 2 / currentColor / 圆角线帽
 * 对应 PDF 顶部基础信息 6 项：Mail / Phone / MapPin / Globe / Briefcase / CalendarRange
 * InfoIconId 来自 shared/constants/info-icons（与 schema 共享字面量源）。
 */
import type { CSSProperties } from 'react'
import type { InfoIconId } from '@shared/constants/info-icons'

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
  switch (id) {
    case 'mail':
      return (
        <svg {...s} style={style} className={className} {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...s} style={style} className={className} {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...s} style={style} className={className} {...common}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...s} style={style} className={className} {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </svg>
      )
    case 'briefcase':
      return (
        <svg {...s} style={style} className={className} {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...s} style={style} className={className} {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      )
  }
}