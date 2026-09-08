/**
 * resume-body-section-meta.test.tsx —— 2026-09-08 排版批 B：节级 DNA + 页边距拆分
 * layout.sectionMeta（节标题改名/columns 两栏/keepTogether 整节不跨页[fitToPage 优先]）
 * layout.pageMarginX/pageMarginY（页边距水平垂直拆分，覆盖 pagePadding 对应分量）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'
import type { Layout } from '@shared/schema/resume'

Element.prototype.scrollIntoView = (() => {}) as never
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))
vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} unobserve(): void {} })

afterEach(() => cleanup())

function setupResume(layoutPatch?: Partial<Layout> & Record<string, unknown>): void {
  const r = createEmptyResume()
  r.basics.name = '测试'
  r.layout = { templateId: 'classic', ...layoutPatch }
  r.education = [
    { id: 'e1', school: '测试大学', degree: '本科', major: '软件工程', startDate: '2020-09', endDate: '2024-06', visible: true }
  ] as never
  useResumeStore.setState({ resume: r, resumeId: 'test-id' })
}

describe('节级 DNA（layout.sectionMeta）', () => {
  it('节标题改名：自定义标题渲染，默认节名不再出现', () => {
    setupResume({ sectionMeta: { education: { title: '我的学习经历' } } })
    const { container } = render(<ResumeBody variant="classic" />)
    expect(container.textContent).toContain('我的学习经历')
    expect(container.textContent).not.toContain('教育经历')
  })

  it('节标题留空：回落默认节名', () => {
    setupResume({ sectionMeta: { education: { title: '   ' } } })
    const { container } = render(<ResumeBody variant="classic" />)
    expect(container.textContent).toContain('教育经历')
  })

  it('columns=2：列表节体挂 column-count 两栏样式', () => {
    setupResume({
      skills: [{ id: 's1', name: 'React', visible: true }] as never,
      sectionMeta: { skills: { columns: 2 } }
    })
    const { container } = render(<ResumeBody variant="classic" />)
    const cols = [...container.querySelectorAll('div')].find((d) =>
      (d.getAttribute('style') ?? '').includes('column-count: 2')
    )
    expect(cols).toBeTruthy()
  })

  it('keepTogether=true：SectionBlock 挂 break-inside: avoid', () => {
    setupResume({ sectionMeta: { education: { keepTogether: true } } })
    const { container } = render(<ResumeBody variant="classic" />)
    const sec = container.querySelector('section[data-rm-path="education"]')
    expect(sec?.getAttribute('style') ?? '').toContain('break-inside: avoid')
  })

  it('keepTogether=true 但 fitToPage 开启：不挂 break-inside（自动一页纸优先）', () => {
    setupResume({ fitToPage: true, sectionMeta: { education: { keepTogether: true } } })
    const { container } = render(<ResumeBody variant="classic" />)
    const sec = container.querySelector('section[data-rm-path="education"]')
    expect(sec?.getAttribute('style') ?? '').not.toContain('break-inside')
  })
})

describe('页边距拆分（layout.pageMarginX/pageMarginY）', () => {
  it('设置后覆盖 pagePadding 对应分量（垂直=marginY，水平=marginX）', () => {
    setupResume({ pageMarginX: 48, pageMarginY: 20 })
    const { container } = render(<ResumeBody variant="classic" />)
    const styled = [...container.querySelectorAll('*')].find((n) =>
      (n.getAttribute('style') ?? '').includes('padding: 20px 48px')
    )
    expect(styled).toBeTruthy()
  })

  it('未设置：回落 pagePadding 现行为（水平 = pagePadding + 模板附加宽）', () => {
    setupResume({})
    const { container } = render(<ResumeBody variant="classic" />)
    const styled = [...container.querySelectorAll('*')].filter((n) =>
      (n.getAttribute('style') ?? '').includes('padding:')
    )
    // classic 模板水平附加 +24：默认 pagePadding 出厂值下水平应大于垂直
    expect(styled.length).toBeGreaterThan(0)
    const pad = styled[0]?.getAttribute('style')?.match(/padding: (\d+)px (\d+)px/)
    expect(pad).toBeTruthy()
    expect(Number(pad?.[2])).toBeGreaterThan(Number(pad?.[1]))
  })
})
