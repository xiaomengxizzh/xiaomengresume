/**
 * resume-body-subtitle-position.test.tsx —— 2026-09-08 排版批 A：经历条目副标题位置
 * layout.subtitlePosition 三态：below（默认，主标题下一行）/ inline-start（同行情紧随主标题）/
 * inline-center（同行情居中于主标题与日期之间）；历史值 'inline' 渲染按 inline-start（兼容断言）。
 * 另含几何矩阵（3 模板 × 3 几何）渲染冒烟与 subheaderSize 字号断言。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'
import type { TemplateId } from '../../registry'

Element.prototype.scrollIntoView = (() => {}) as never
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))
vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} unobserve(): void {} })

afterEach(() => cleanup())

function setupResume(subtitlePosition?: 'below' | 'inline' | 'inline-start' | 'inline-center', variant: TemplateId = 'classic', subheaderSize?: number): void {
  const r = createEmptyResume()
  r.basics.name = '测试'
  r.layout = { templateId: variant, subtitlePosition, subheaderSize }
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

describe('经历条目副标题位置（layout.subtitlePosition 三态）', () => {
  it('默认（below）：副标题在主标题下一行（独立副标题行，非条目头 flex 行）', () => {
    setupResume(undefined)
    render(<ResumeBody variant="classic" />)
    const el = companyEl()
    expect(el).toBeTruthy()
    const own = el?.getAttribute('style') ?? ''
    expect(own).toContain('opacity: 0.8')
    expect(own).not.toContain('margin-right: auto')
    expect(own).not.toContain('text-align: center')
    const parentStyle = el?.parentElement?.getAttribute('style') ?? ''
    expect(parentStyle).not.toContain('space-between')
  })

  it('inline-start：副标题紧随主标题（margin-right:auto 吸收剩余空间，日期靠行尾）', () => {
    setupResume('inline-start')
    render(<ResumeBody variant="classic" />)
    const el = companyEl()
    expect(el).toBeTruthy()
    const own = el?.getAttribute('style') ?? ''
    expect(own).toContain('margin-right: auto')
    const parentStyle = el?.parentElement?.getAttribute('style') ?? ''
    expect(parentStyle).toContain('space-between')
  })

  it('inline-center：副标题行内居中（flex:1 + text-align:center）', () => {
    setupResume('inline-center')
    render(<ResumeBody variant="classic" />)
    const el = companyEl()
    expect(el).toBeTruthy()
    const own = el?.getAttribute('style') ?? ''
    expect(own).toContain('text-align: center')
    expect(own).toContain('flex')
    const parentStyle = el?.parentElement?.getAttribute('style') ?? ''
    expect(parentStyle).toContain('space-between')
  })

  it('历史值 inline：渲染按 inline-start（读写兼容）', () => {
    setupResume('inline')
    render(<ResumeBody variant="classic" />)
    const el = companyEl()
    expect(el).toBeTruthy()
    const own = el?.getAttribute('style') ?? ''
    expect(own).toContain('margin-right: auto')
    expect(own).not.toContain('text-align: center')
  })

  it('subheaderSize：副标题字号走独立 px（缺省回落 entrySubEm em 行为）', () => {
    setupResume('below', 'classic', 12)
    render(<ResumeBody variant="classic" />)
    const own = companyEl()?.getAttribute('style') ?? ''
    expect(own).toContain('font-size: 12px')
    expect(own).not.toContain('0.85em')
  })

  it('subheaderSize 未设置：回落 entrySubEm（0.85em）', () => {
    setupResume('below')
    render(<ResumeBody variant="classic" />)
    const own = companyEl()?.getAttribute('style') ?? ''
    expect(own).toContain('font-size: 0.85em')
  })
})

describe('几何矩阵（3 模板 × 3 几何 渲染冒烟）', () => {
  const variants: TemplateId[] = ['classic', 'modern', 'compact']
  const geometries = ['below', 'inline-start', 'inline-center'] as const

  it.each(variants.flatMap((v) => geometries.map((g) => [v, g] as const)))(
    '%s × %s：渲染不抛错且公司名落在预览',
    (variant, geometry) => {
      setupResume(geometry, variant)
      const { container } = render(<ResumeBody variant={variant} />)
      const el = [...container.querySelectorAll('*')].find(
        (n) => n.children.length === 0 && n.textContent === '云帆企业'
      )
      expect(el).toBeTruthy()
      const own = el?.getAttribute('style') ?? ''
      if (geometry === 'below') {
        expect(own).not.toContain('margin-right: auto')
      } else {
        expect(own).toContain(geometry === 'inline-start' ? 'margin-right: auto' : 'text-align: center')
      }
    }
  )
})
