/**
 * makePreviewResume 单测（2026-08-23 R2）——纯函数断言：
 * ① layout 仅含 templateId（剥离全部数值排版字段与 themeColor/resumeFont，覆盖链回落模板层）；
 * ② 内容与示例同源（王晨数据深层保留）；
 * ③ 深拷贝不共享引用（多次调用互不影响、不污染模块级示例源）。
 */
import { describe, it, expect } from 'vitest'
import { makePreviewResume } from '../make-preview-resume'
import { migrate } from '@shared/schema/resume'
import sample from '@shared/sample-resume.json'

/** sample-resume.json layout 原带的全量数值/主题字段（剥离后必须全部不存在） */
const STRIPPED_KEYS = [
  'themeColor',
  'baseFontSize',
  'pagePadding',
  'paragraphSpacing',
  'lineHeight',
  'sectionSpacing',
  'headerSize',
  'resumeFont'
] as const

describe('makePreviewResume', () => {
  it('layout 仅含 templateId：三模板均剥离全部数值/主题字段', () => {
    for (const id of ['classic', 'modern', 'compact']) {
      const r = makePreviewResume(id)
      expect(Object.keys(r.layout ?? {})).toEqual(['templateId'])
      expect(r.layout?.templateId).toBe(id)
      for (const key of STRIPPED_KEYS) {
        expect(r.layout).not.toHaveProperty(key)
      }
    }
  })

  it('内容与示例同源：title/basics/works 深层内容保留', () => {
    const base = migrate(sample)
    expect(base.basics.name).toBeTruthy() // 王晨数据非空（守卫示例源本身）
    const r = makePreviewResume('modern')
    expect(r.title).toBe(base.title)
    expect(r.basics.name).toBe(base.basics.name)
    expect(r.work).toHaveLength(base.work.length)
  })

  it('深拷贝不共享引用：两次调用互不影响，也不污染模块级示例源', () => {
    const a = makePreviewResume('classic')
    const b = makePreviewResume('classic')
    expect(a).not.toBe(b)
    expect(a.layout).not.toBe(b.layout)
    // 篡改 a 的深层字段
    a.basics.name = 'mutated'
    a.layout!.templateId = 'hacked'
    a.work[0].company = 'mutated'
    // b 与后续新调用不受影响（示例源未被污染）
    const baseName = migrate(sample).basics.name
    expect(b.basics.name).toBe(baseName)
    expect(b.layout?.templateId).toBe('classic')
    expect(b.work[0].company).toBe(migrate(sample).work[0].company)
    expect(makePreviewResume('classic').basics.name).toBe(baseName)
  })
})
