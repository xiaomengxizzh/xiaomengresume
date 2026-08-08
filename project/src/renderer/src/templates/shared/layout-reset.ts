/**
 * templates/shared/layout-reset.ts —— 排版重置语义（L4 修复，TDD 先红后绿）
 * F4 覆盖链：简历 layout > 模板预设 > 全局初始值。
 * 「一键恢复模板默认」= 清空 layout 的排版覆盖字段（6 个数值），回落模板预设；
 * templateId / themeColor / resumeFont 保留（用户选择不清空——TDD 红暴露的语义修正）。
 * 2026-08-08 L4：原 LayoutBar DEFAULTS 写死 classic 值 → modern 下恢复得 classic 参数（张冠李戴）。
 */
import type { Layout } from '@shared/schema/resume'

/** 排版覆盖字段（reset 时清空的键）；与 LayoutSchema 数字排版字段对齐 */
export const LAYOUT_NUMERIC_KEYS = [
  'baseFontSize',
  'lineHeight',
  'pagePadding',
  'paragraphSpacing',
  'sectionSpacing',
  'headerSize'
] as const

export type LayoutNumericKey = (typeof LAYOUT_NUMERIC_KEYS)[number]

/** 用户选择类字段（reset 时保留） */
const KEEP_KEYS = new Set(['templateId', 'themeColor', 'resumeFont', 'sectionFonts'])

/**
 * 计算 reset 后的 layout：清空排版数值字段，保留选择类字段。
 * 返回新对象；若清空后无任何保留字段 → 返回 undefined（完全回落模板预设）。
 */
export function resetLayoutOverrides(layout: Layout | undefined): Layout | undefined {
  if (layout === undefined) return undefined
  const next: Layout = { ...layout }
  for (const key of LAYOUT_NUMERIC_KEYS) {
    delete next[key]
  }
  const hasKeep = (Object.keys(next) as Array<keyof Layout>).some((k) => KEEP_KEYS.has(k))
  return hasKeep ? next : undefined
}
