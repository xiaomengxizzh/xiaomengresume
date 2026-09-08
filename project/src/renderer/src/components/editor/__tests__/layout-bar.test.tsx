/**
 * layout-bar.test.tsx —— LayoutBar 排版条（补测试盲区批 T2）
 * 覆盖：折叠态只显示标题；展开后滑杆初值 = 当前模板预设（无 per-resume layout）；
 * 拖动滑杆写 layout.<key> 且进 F3 撤销栈（canUndo/undo）；紧凑排版开关激活与再点恢复；
 * fitToPage 开关 toggle；listMark 下拉写入。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LayoutBar } from '../LayoutBar'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'
import { TEMPLATE_PRESETS, compactSpacing } from '@shared/templates/layout'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k })
}))

/** 滑杆按 JSX 顺序：baseFontSize / lineHeight / pagePadding / paragraphSpacing / sectionSpacing / headerSize */
function sliders(container: HTMLElement): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('.layout-bar-item input[type="range"]')]
}

function openBar(): void {
  fireEvent.click(screen.getByText(/editor\.layoutTitle/))
}

beforeEach(() => {
  useResumeStore.setState({
    resumeId: 't2-id',
    resume: createEmptyResume(), // 无 layout → 全部回落模板预设
    currentView: 'editor',
    activeSection: null,
    activeFieldPath: null
  })
})

describe('LayoutBar（排版条）', () => {
  it('折叠态只显示标题按钮，无任何滑杆', () => {
    const { container } = render(<LayoutBar />)
    expect(screen.getByText(/editor\.layoutTitle/)).toBeTruthy()
    expect(sliders(container)).toHaveLength(0)
  })

  it('展开：7 根滑杆初值 = classic 模板预设（无 per-resume layout 时；末位 = 副标题字号回落 entrySubEm×baseFontSize）', () => {
    const { container } = render(<LayoutBar />)
    openBar()
    const inputs = sliders(container)
    expect(inputs).toHaveLength(7)
    const preset = TEMPLATE_PRESETS.classic
    expect(inputs.map((i) => Number(i.value))).toEqual([
      preset.baseFontSize,
      preset.lineHeight,
      preset.pagePadding,
      preset.paragraphSpacing,
      preset.sectionSpacing,
      preset.headerSize,
      Math.round(preset.baseFontSize * 0.9) // 副标题字号缺省 = entrySubEm×baseFontSize 回落
    ])
  })

  it('拖动滑杆写 layout.baseFontSize 且进历史（canUndo，一次 undo 回预设）', () => {
    const { container } = render(<LayoutBar />)
    act(() => {
      // loadResume 内部 history.clear()：保证历史栈从零开始（时钟敏感测试规范）
      useResumeStore.getState().loadResume('t2-id', createEmptyResume())
    })
    openBar()
    const input = sliders(container)[0]
    fireEvent.change(input, { target: { value: '14' } })
    const st = useResumeStore.getState()
    expect(st.resume.layout?.baseFontSize).toBe(14)
    expect(st.canUndo()).toBe(true)
    // undo 后覆盖被回退 → 字段消失回落预设值（组件仍展开，滑杆显示回落值）
    act(() => {
      useResumeStore.getState().undo()
    })
    expect(typeof useResumeStore.getState().resume.layout?.baseFontSize).not.toBe('number')
    expect(Number(sliders(document.body)[0].value)).toBe(TEMPLATE_PRESETS.classic.baseFontSize)
  })

  it('紧凑排版开关：一键写入 compactSpacing(classic)；再点恢复默认', () => {
    render(<LayoutBar />)
    openBar()
    const compactBtn = screen.getByText('editor.layoutCompact')
    fireEvent.click(compactBtn)
    const layout = useResumeStore.getState().resume.layout
    const compact = compactSpacing(TEMPLATE_PRESETS.classic)
    expect(layout?.lineHeight).toBe(compact.lineHeight)
    expect(layout?.pagePadding).toBe(compact.pagePadding)
    expect(layout?.paragraphSpacing).toBe(compact.paragraphSpacing)
    expect(layout?.sectionSpacing).toBe(compact.sectionSpacing)
    expect(layout?.headerSize).toBe(compact.headerSize)

    // 再点（已激活）→ reset 语义：无保留字段 → layout 整体清空回落预设
    fireEvent.click(compactBtn)
    const after = useResumeStore.getState().resume.layout
    expect(after?.lineHeight).toBeUndefined()
    expect(after?.pagePadding).toBeUndefined()
    expect(after?.fitToPage).toBeFalsy()
  })

  it('fitToPage 开关 toggle：开 → layout.fitToPage=true；再点关', () => {
    render(<LayoutBar />)
    openBar()
    const btn = screen.getByText('editor.layoutFitPage')
    fireEvent.click(btn)
    expect(useResumeStore.getState().resume.layout?.fitToPage).toBe(true)
    fireEvent.click(btn)
    expect(useResumeStore.getState().resume.layout?.fitToPage).toBe(false)
  })

  it('listMark 下拉选择写入 layout.listMark', () => {
    render(<LayoutBar />)
    openBar()
    const select = screen.getByTitle('editor.layoutMarkHint') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'dot' } })
    expect(useResumeStore.getState().resume.layout?.listMark).toBe('dot')
  })
})
