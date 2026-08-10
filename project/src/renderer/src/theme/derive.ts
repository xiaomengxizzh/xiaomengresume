/**
 * 主题派生（UI 美化 P2）：OKLCH 下从主色派生全套 UI 令牌，前景对比度 ≥4.5（WCAG AA）。
 * 依赖 culori（渲染层专用 → devDependencies，见《技术栈.md》§4.2）；未接线 UI——自定义主题交互随 M5 F18。
 */
import { oklch, formatHex, wcagContrast } from 'culori'

export interface DerivedThemeTokens {
  background: string
  card: string
  sidebar: string
  foreground: string
  selected: string
  border: string
  primary: string
}

const MIN_CONTRAST = 4.5
const FALLBACK_FOREGROUND = '#424242' // light 权威前景（对比度保底，防绿字护栏兜底）

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

function base(hex: string): { c: number; h: number } {
  const c = oklch(hex)
  if (!c || c.mode !== 'oklch' || !Number.isFinite(c.l)) {
    throw new Error(`deriveTokens: 无效颜色 ${hex}`)
  }
  return { c: c.c, h: c.h ?? 0 }
}

function toHex(l: number, c: number, h: number): string {
  return formatHex({ mode: 'oklch', l: clamp01(l), c: clamp01(c), h })
}

export function deriveTokens(primaryHex: string): DerivedThemeTokens {
  const { c: pc, h } = base(primaryHex)

  // 浅底派生：背景/卡片保持主色色相、压饱和度、拉高亮度（柔顺卡片风基调）
  const background = toHex(0.965, pc * 0.3, h)
  const card = toHex(0.985, pc * 0.3, h)
  const selected = toHex(0.85, pc * 0.3, h)
  const border = toHex(0.88, pc * 0.15, h)

  // 前景：近中性深色（c 压至 ≤0.02，防绿字护栏），l 迭代降暗直至对比度 ≥4.5
  const fc = Math.min(pc * 0.1, 0.02)
  let fl = 0.25
  let foreground = toHex(fl, fc, h)
  while (fl > 0.08 && wcagContrast(foreground, background) < MIN_CONTRAST) {
    fl -= 0.02
    foreground = toHex(fl, fc, h)
  }
  if (wcagContrast(foreground, background) < MIN_CONTRAST) {
    foreground = FALLBACK_FOREGROUND
  }

  return {
    background,
    card,
    sidebar: card,
    foreground,
    selected,
    border,
    primary: formatHex({ mode: 'oklch', l: clamp01(oklch(primaryHex)?.l ?? 0), c: clamp01(pc), h })
  }
}
