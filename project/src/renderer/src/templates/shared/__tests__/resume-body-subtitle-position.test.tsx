/**
 * resume-body-subtitle-position.test.tsx —— 2026-09-08 排版新功能：经历条目副标题位置
 * layout.subtitlePosition = below（默认，主标题下一行）/ inline（主标题与日期同行居中）。
 * 断言 DOM 位置：inline 时公司名在条目头 flex 行内（text-align: center 中间列），
 * below 时为独立副标题行（opacity 0.8 无居中）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

Element.prototype.scrollIntoView = (() => {}) as never
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))
vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} unobserve(): void {} })

afterEach(() => cleanup())

function setupResume(subtitlePosition?: 'below' | 'inline'): void {
  const r = createEmptyResume()
  r.basics.name = '测试'
  r.layout = { templateId: 'classic', subtitlePosition }
  r.work = [
    {
      id: 'w1',
      title: '销售经理',
      company: '云帆企业',
      startDate: '2021-07',
      endDate: '2024-12',
      summary: { type: 'doc', content: [] },
      visible: true
    } as never
  ]
  useResumeStore.setState({ resume: r, resumeId: 'test-id' })
}

function companyEl(): HTMLElement | null {
  return ([...document.querySelectorAll('*')].find(
    (n) => n.children.length === 0 && n.textContent === '云帆企业'
  ) as HTMLElement | null) ?? null
}

describe('经历条目副标题位置（layout.subtitlePosition）', () => {
  it('默认（below）：副标题在主标题下一行（独立副标题行，非条目头 flex 行）', () => {
    setupResume(undefined)
    render(<ResumeBody variant="classic" />)
    const el = companyEl()
    expect(el).toBeTruthy()
    const own = el?.getAttribute('style') ?? ''
    expect(own).toContain('opacity: 0.8')
    expect(own).not.toContain('text-align: center')
    const parentStyle = el?.parentElement?.getAttribute('style') ?? ''
    expect(parentStyle).not.toContain('space-between')
  })

  it('inline：副标题进入条目头 flex 行（紧随主标题、日期靠右）', () => {
    setupResume('inline')
    render(<ResumeBody variant="classic" />)
    const el = companyEl()
    expect(el).toBeTruthy()
    const own = el?.getAttribute('style') ?? ''
    expect(own).toContain('margin-right: auto')
    expect(own).not.toContain('text-align: center')
    const parentStyle = el?.parentElement?.getAttribute('style') ?? ''
    expect(parentStyle).toContain('space-between')
  })
})
