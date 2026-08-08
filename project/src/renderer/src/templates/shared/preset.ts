/**
 * templates/shared/preset.ts —— 模板预设（F4）
 * 三套模板的排版预设值；layout 覆盖链：简历 layout > 模板预设 > 全局初始值。
 * 2026-08-08 D11：组件 store 驱动（无 props），预设随组件注册进 registry。
 */
import type { Layout } from '@shared/schema/resume'
import { FONT_OPTIONS } from '@shared/constants/fonts'

/** 排版预设键（与 LayoutSchema 数字字段对齐，LayoutBar 消费同源） */
export type PresetKey = 'baseFontSize' | 'lineHeight' | 'pagePadding' | 'paragraphSpacing' | 'sectionSpacing' | 'headerSize'

export interface TemplatePreset {
  baseFontSize: number
  lineHeight: number
  pagePadding: number
  paragraphSpacing: number
  sectionSpacing: number
  headerSize: number
}

/** 从 layout 取值，缺省回落模板预设（F4 覆盖链） */
export function lv(layout: Layout | undefined, key: PresetKey, preset: TemplatePreset): number {
  const v = layout?.[key]
  return typeof v === 'number' ? v : preset[key]
}

/**
 * section/全局字体解析（F4 字体选择，三套模板共用）
 * 优先级：layout.sectionFonts[section] > layout.resumeFont > 系统默认（fallback 链）。
 */
export function resolveFontFamily(layout: Layout | undefined, section: string): string | undefined {
  const sid = layout?.sectionFonts?.[section]
  if (sid && sid !== 'system') {
    const f = FONT_OPTIONS.find((x) => x.id === sid)
    if (f?.family) return f.family
  }
  if (layout?.resumeFont && layout.resumeFont !== 'system') {
    const f = FONT_OPTIONS.find((x) => x.id === layout.resumeFont)
    if (f?.family) return f.family
  }
  return undefined
}
