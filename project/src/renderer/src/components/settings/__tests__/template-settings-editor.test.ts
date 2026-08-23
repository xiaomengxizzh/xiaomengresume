// @vitest-environment jsdom
/** R3（2026-08-23）：模板参数滑杆初值读覆盖层 + 保存防固化——纯函数用例（不渲染组件） */
import { describe, it, expect } from 'vitest'
import { TEMPLATE_PRESETS, type TemplatePreset } from '@shared/templates/layout'
import { DEFAULT_THEME_COLOR } from '@shared/constants/theme-colors'
import type { TemplateOverride } from '@shared/schema/settings'
import { draftFromOverride, stripFactoryDefaults } from '../TemplateSettingsEditor'

const preset: TemplatePreset = TEMPLATE_PRESETS.classic

describe('draftFromOverride（草稿初值 = 覆盖层 ⊕ 出厂）', () => {
  it('无 override → 数值 6 字段全取出厂 preset，字体/主题色回落默认', () => {
    const d = draftFromOverride(preset, undefined)
    expect(d.baseFontSize).toBe(preset.baseFontSize)
    expect(d.lineHeight).toBe(preset.lineHeight)
    expect(d.pagePadding).toBe(preset.pagePadding)
    expect(d.paragraphSpacing).toBe(preset.paragraphSpacing)
    expect(d.sectionSpacing).toBe(preset.sectionSpacing)
    expect(d.headerSize).toBe(preset.headerSize)
    expect(d.resumeFont).toBe('system')
    expect(d.themeColor).toBe(DEFAULT_THEME_COLOR)
    expect(d.titleStyle).toBeUndefined()
  })

  it('有 override（baseFontSize:12, themeColor:#2563EB）→ 覆盖值优先，未覆盖字段仍取 preset（R3 核心：不谎报出厂值）', () => {
    const d = draftFromOverride(preset, { baseFontSize: 12, themeColor: '#2563EB' })
    expect(d.baseFontSize).toBe(12)
    expect(d.themeColor).toBe('#2563EB')
    expect(d.lineHeight).toBe(preset.lineHeight)
    expect(d.headerSize).toBe(preset.headerSize)
  })

  it('有 override（resumeFont/titleStyle）→ 非数值字段同样回落到已保存覆盖', () => {
    const d = draftFromOverride(preset, { resumeFont: 'notoserifsc', titleStyle: 'compact' })
    expect(d.resumeFont).toBe('notoserifsc')
    expect(d.titleStyle).toBe('compact')
  })
})

describe('stripFactoryDefaults（保存防固化：等于出厂默认即不写覆盖层）', () => {
  it('draft 全等于出厂 → 输出为空覆盖（数值键全不落）', () => {
    const out = stripFactoryDefaults(draftFromOverride(preset, undefined), preset)
    expect(out).toEqual({})
  })

  it('部分字段等于出厂默认（数值 + system + DEFAULT_THEME_COLOR + 无 titleStyle）→ 这些键被过滤', () => {
    const draft: TemplateOverride = {
      baseFontSize: preset.baseFontSize,
      lineHeight: preset.lineHeight,
      pagePadding: preset.pagePadding,
      paragraphSpacing: preset.paragraphSpacing,
      sectionSpacing: preset.sectionSpacing,
      headerSize: preset.headerSize,
      resumeFont: 'system',
      themeColor: DEFAULT_THEME_COLOR
    }
    expect(stripFactoryDefaults(draft, preset)).toEqual({})
  })

  it('偏离出厂的值保留（数值/字体/主题色/标题风格各自独立判定）', () => {
    const draft: TemplateOverride = {
      baseFontSize: 12,
      themeColor: '#2563EB',
      titleStyle: 'compact'
    }
    expect(stripFactoryDefaults(draft, preset)).toEqual({ baseFontSize: 12, themeColor: '#2563EB', titleStyle: 'compact' })
  })
})
