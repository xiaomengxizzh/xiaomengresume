/**
 * 主题对比度护栏（UI 美化 P2）：WCAG AA ≥4.5:1——防绿字护栏从人工断言升级为自动化回归测试。
 * 覆盖：4 主题权威令牌现值（styles.css :root + [data-theme]）+ deriveTokens 派生输出。
 */
import { describe, it, expect } from 'vitest'
import { oklch, wcagContrast } from 'culori'
import { deriveTokens } from '../derive'

// 4 主题权威令牌（styles.css 现值；green 前景 #424242 非绿是护栏核心）
const THEMES = [
  { name: 'light', background: '#f5f5f5', card: '#ffffff', foreground: '#424242' },
  { name: 'dark', background: '#121212', card: '#202124', foreground: '#e0e0e0' },
  { name: 'beige', background: '#fff3e0', card: '#fff9ee', foreground: '#424242' },
  { name: 'green', background: '#aed59c', card: '#f1f8e9', foreground: '#424242' }
]

const contrast = (a: string, b: string): number => wcagContrast(a, b)

describe('主题对比度护栏（WCAG AA ≥ 4.5:1）', () => {
  it.each(THEMES)('$name：前景 vs 背景/卡片 对比度 ≥ 4.5', ({ background, card, foreground }) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(foreground, card)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['#1f6feb', '#4caf50', '#e91e63', '#000000', '#ffeb3b'])(
    'deriveTokens(%s)：对比度 ≥ 4.5 且前景近中性（防绿字护栏）',
    (primary) => {
      const t = deriveTokens(primary)
      expect(contrast(t.foreground, t.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.foreground, t.card)).toBeGreaterThanOrEqual(4.5)
      const fg = oklch(t.foreground)
      expect(fg && fg.mode === 'oklch' ? fg.c : 1).toBeLessThanOrEqual(0.03)
      expect(fg && fg.mode === 'oklch' ? fg.l : -1).toBeGreaterThan(0.05)
    }
  )

  // 2026-08-09 C3 护栏：品牌色 --brand（装饰/强调用，不作正文文字色）
  // light/beige/green = #5b6abf，dark = #8b93d8（浅化保证深底可辨）
  const BRANDS: Array<{ theme: string; brand: string; card: string }> = [
    { theme: 'light', brand: '#5b6abf', card: '#ffffff' },
    { theme: 'dark', brand: '#8b93d8', card: '#202124' },
    { theme: 'beige', brand: '#5b6abf', card: '#fff9ee' },
    { theme: 'green', brand: '#5b6abf', card: '#f1f8e9' }
  ]
  it.each(BRANDS)('$theme：品牌色 --brand 非绿（护栏）且在卡片上装饰可辨（对比 ≥ 3:1）', ({ brand, card }) => {
    const b = oklch(brand)
    const h = b && b.mode === 'oklch' ? (b.h ?? -1) : -1
    // 防绿字护栏扩展：brand 色相不得落入绿色相区间（oklch ~110-180）
    expect(h === -1 || h < 110 || h > 180).toBe(true)
    expect(contrast(brand, card)).toBeGreaterThanOrEqual(3)
  })
})
