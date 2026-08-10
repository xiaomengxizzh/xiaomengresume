/**
 * tags-export.test.ts —— 2026-08-09 T3：基本信息标签（customFields）+ 职业（headline）导出 PDF 不崩溃
 * buildTextPdf 成功 + 页数/标题校验；文本同步由 contactItems 并入 customFields 代码 + icon 默认(pin)修复保证。
 */
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildTextPdf } from '../build'
import { createEmptyResume } from '@shared/schema/resume'

describe('基本信息标签 + 职业 → PDF 导出（T3 回归）', () => {
  it('含标签/职业的简历导出 PDF 成功且不崩溃（标题 = 简历名）', async () => {
    const resume = createEmptyResume()
    resume.basics.name = '测试用户'
    resume.basics.headline = '前端工程师' // 职业（固定框写入）
    resume.basics.customFields = [
      { id: 'c1', label: '电话', value: '138-0000-0000', icon: 'phone' },
      { id: 'c2', label: '邮箱', value: 'a@b.com' } // 无 icon → 默认 pin（T3 错位修复）
    ]
    const { buffer, pageCount } = await buildTextPdf(resume, { language: 'zh-CN', privacyMode: false, pages: 'first' })
    expect(pageCount).toBe(1)
    const doc = await PDFDocument.load(buffer)
    expect(doc.getTitle()).toBe('测试用户')
    expect(doc.getPageCount()).toBe(1)
  })
})
