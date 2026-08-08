/**
 * registry.test.ts —— M2 F4 模板注册表测试
 * getTemplate 回落逻辑 + 三套模板注册完整性 + 预设与 F4 定案系数对齐。
 */
import { describe, it, expect } from 'vitest'
import { templateRegistry, getTemplate, defaultTemplateId, PRESETS } from '../registry'

describe('templateRegistry（F4）', () => {
  it('三套模板全部注册且字段完整', () => {
    for (const id of ['classic', 'modern', 'compact'] as const) {
      const meta = templateRegistry[id]
      expect(meta.id).toBe(id)
      expect(meta.nameKey).toBeTruthy()
      expect(meta.component).toBeTypeOf('function')
      expect(meta.thumbnail).toBeTypeOf('function')
      expect(meta.preset.baseFontSize).toBeGreaterThan(0)
    }
  })

  it('defaultTemplateId 为 classic', () => {
    expect(defaultTemplateId).toBe('classic')
    expect(getTemplate(undefined).id).toBe('classic')
    expect(getTemplate('').id).toBe('classic')
  })

  it('未知 id 回落默认', () => {
    expect(getTemplate('nonexistent').id).toBe('classic')
    expect(getTemplate('CLASSIC').id).toBe('classic') // 大小写敏感
  })

  it('已知 id 精确命中', () => {
    expect(getTemplate('modern').id).toBe('modern')
    expect(getTemplate('compact').id).toBe('compact')
  })

  it('间距系数对齐 F4 定案（classic 1.0 / modern 1.15 / compact 0.85）', () => {
    expect(PRESETS.classic.sectionSpacing).toBe(16)
    expect(PRESETS.modern.sectionSpacing).toBeGreaterThan(PRESETS.classic.sectionSpacing)
    expect(PRESETS.compact.sectionSpacing).toBeLessThan(PRESETS.classic.sectionSpacing)
  })
})
