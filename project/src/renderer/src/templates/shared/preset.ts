/**
 * templates/shared/preset.ts —— 模板预设（F4）
 * 2026-08-10 架构收敛批：TemplatePreset 类型 / lv() / 预设值收敛至
 * shared/templates/layout.ts 单一事实源（本文件 re-export 保持既有 import 兼容，不持有数值）。
 * 字体解析（resolveFontFamily）保留本文件（渲染端特有逻辑，PDF 端有对应 getSectionFontFamily）。
 */
import type { Layout } from '@shared/schema/resume'
import { FONT_OPTIONS } from '@shared/constants/fonts'

export type { TemplatePreset, PresetKey } from '@shared/templates/layout'
export { TEMPLATE_PRESETS, lv } from '@shared/templates/layout'

/**
 * section/全局字体解析（F4 字体选择，三套模板共用）
 * 优先级（M5 A7 定案）：layout.sectionFonts[section] > layout.resumeFont（本简历）
 *   > templateResumeFont（全局模板默认字体）> 系统默认（fallback 链）。
 * 字体分离：模板设置屏管「模板默认」（templateResumeFont），编辑器 LayoutBar 管「本简历」（layout.resumeFont）。
 */
export function resolveFontFamily(layout: Layout | undefined, section: string, templateResumeFont?: string): string | undefined {
  const sid = layout?.sectionFonts?.[section]
  if (sid && sid !== 'system') {
    const f = FONT_OPTIONS.find((x) => x.id === sid)
    if (f?.family) return f.family
  }
  if (layout?.resumeFont && layout.resumeFont !== 'system') {
    const f = FONT_OPTIONS.find((x) => x.id === layout.resumeFont)
    if (f?.family) return f.family
  }
  if (templateResumeFont && templateResumeFont !== 'system') {
    const f = FONT_OPTIONS.find((x) => x.id === templateResumeFont)
    if (f?.family) return f.family
  }
  return undefined
}
