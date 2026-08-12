/**
 * layout-override.test.ts —— M5 A3 模板覆盖链（2026-08-12）
 * 覆盖链：per-resume layout > 全局模板覆盖（SettingsSchema.templates[templateId]）> 出厂预设。
 * lv/titleStyleLogic 在 shared（单一事实源）；resolveFontFamily 在渲染端 preset.ts（A7 字体分离）。
 */
import { describe, it, expect } from 'vitest'
import { lv, titleStyleLogic, TEMPLATE_PRESETS } from '@shared/templates/layout'
import { resolveFontFamily } from '../../renderer/src/templates/shared/preset'

const preset = TEMPLATE_PRESETS.classic

describe('lv 三层覆盖链（A3）', () => {
  it('per-resume layout 优先于模板覆盖与预设', () => {
    expect(lv({ baseFontSize: 20 }, 'baseFontSize', preset, { baseFontSize: 14 })).toBe(20)
  })

  it('无 per-resume 时模板覆盖生效（全局模板参数影响既有简历）', () => {
    expect(lv(undefined, 'baseFontSize', preset, { baseFontSize: 14 })).toBe(14)
    // 未覆盖的键回落预设
    expect(lv(undefined, 'lineHeight', preset, { baseFontSize: 14 })).toBe(preset.lineHeight)
  })

  it('无覆盖无 layout → 出厂预设', () => {
    expect(lv(undefined, 'baseFontSize', preset, undefined)).toBe(preset.baseFontSize)
  })

  it('layout 覆盖但不含该键 + 模板覆盖有值 → 模板覆盖（混合覆盖链）', () => {
    expect(lv({ headerSize: 20 }, 'pagePadding', preset, { pagePadding: 50 })).toBe(50)
  })
})

describe('titleStyleLogic 模板覆盖（A3 节标题风格）', () => {
  it('override 优先于 variant 默认', () => {
    expect(titleStyleLogic('underline', 'compact')).toHaveProperty('fontWeight', 700) // compact 700
    expect(titleStyleLogic('accent-bar', 'underline')).toHaveProperty('borderBottom') // underline 有下划线
    expect(titleStyleLogic('compact', 'accent-bar')).toHaveProperty('borderLeft') // accent-bar 左侧色条
  })

  it('无 override → variant 默认不变（既有行为保持）', () => {
    expect(titleStyleLogic('classic' as never)).toHaveProperty('borderBottom')
    expect(titleStyleLogic('accent-bar')).toHaveProperty('borderLeft')
  })
})

describe('resolveFontFamily 字体分离（A7）', () => {
  it('本简历 layout.resumeFont 优先于模板默认字体', () => {
    const f = resolveFontFamily({ resumeFont: 'yahei' }, 'work', 'songti')
    expect(f).toContain('Microsoft YaHei') // layout.resumeFont 命中
  })

  it('无本简历字体 → 模板默认字体生效（模板设置屏选择）', () => {
    const f = resolveFontFamily(undefined, 'work', 'songti')
    expect(f).toContain('SimSun')
  })

  it('两处都无 → undefined（系统 fallback）', () => {
    expect(resolveFontFamily(undefined, 'work', undefined)).toBeUndefined()
    expect(resolveFontFamily({ resumeFont: 'system' }, 'work', 'system')).toBeUndefined()
  })
})
