/**
 * layout-reset.test.ts —— L4 reset 语义 TDD（先红后绿）
 * 断言：modern 模板下 reset → 回落 modern 预设（而非 classic 值）；
 * templateId/themeColor/resumeFont 保留；全清空后回落 undefined（模板预设）。
 */
import { describe, it, expect } from 'vitest'
import { resetLayoutOverrides } from '../layout-reset'

describe('resetLayoutOverrides（L4：排版恢复默认语义）', () => {
  it('清空全部排版数值字段（modern 模板下不再回落 classic 值）', () => {
    const layout = {
      templateId: 'modern',
      baseFontSize: 20,
      lineHeight: 2,
      pagePadding: 60,
      paragraphSpacing: 18,
      sectionSpacing: 30,
      headerSize: 30
    }
    const next = resetLayoutOverrides(layout)
    // 关键断言：数值字段被清空 → undefined 回落模板预设（modern preset），而非写死 classic 16
    expect(next?.baseFontSize).toBeUndefined()
    expect(next?.lineHeight).toBeUndefined()
    expect(next?.pagePadding).toBeUndefined()
    expect(next?.paragraphSpacing).toBeUndefined()
    expect(next?.sectionSpacing).toBeUndefined()
    expect(next?.headerSize).toBeUndefined()
  })

  it('保留 templateId / themeColor / resumeFont（用户选择不恢复）', () => {
    const layout = {
      templateId: 'compact',
      themeColor: '#2563eb',
      resumeFont: 'songti',
      baseFontSize: 19
    }
    const next = resetLayoutOverrides(layout)
    expect(next?.templateId).toBe('compact')
    expect(next?.themeColor).toBe('#2563eb')
    expect(next?.resumeFont).toBe('songti')
  })

  it('仅剩选择类字段时保留（templateId/themeColor 是用户选择，不清空）', () => {
    const layout = { templateId: 'modern', themeColor: '#ff0000' }
    expect(resetLayoutOverrides(layout)).toEqual({ templateId: 'modern', themeColor: '#ff0000' })
  })

  it('layout 为空对象时返回 undefined（幂等）', () => {
    expect(resetLayoutOverrides({})).toBeUndefined()
    expect(resetLayoutOverrides(undefined)).toBeUndefined()
  })
})
