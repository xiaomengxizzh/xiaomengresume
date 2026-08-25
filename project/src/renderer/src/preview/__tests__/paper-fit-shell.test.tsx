/**
 * paper-fit-shell.test.tsx —— PaperFitShell A4 适配壳 + BasicPreview 选模板壳（补测试盲区批 T4）
 * 覆盖：给定容器尺寸 → --preview-scale = min(availW/794, availH/1123, 1)；wrapper 宽高同步；
 * 封顶 100%；零尺寸兜底（scale=1）；容器变化触发重算 + 尺寸未变不重复写 DOM（防循环）。
 * BasicPreview：store 模式渲染 store 简历；preview 模式渲染外部数据（导入向导草稿语义）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { PaperFitShell } from '../PaperFitShell'
import { BasicPreview } from '../BasicPreview'
import { useResumeStore } from '../../store/useResumeStore'
import { createEmptyResume, type Resume } from '@shared/schema/resume'

vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))

// jsdom 无 ResizeObserver——stub 收集回调，测试手动触发
type RoCallback = (entries: unknown[], obs: unknown) => void
let roCallback: RoCallback | null = null

class MockResizeObserver {
  constructor(cb: RoCallback) {
    roCallback = cb
  }
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

function fireRo(): void {
  act(() => {
    roCallback?.([], null)
  })
}

/** jsdom 布局恒 0 → 用 defineProperty 伪造容器可视尺寸 */
function setSize(el: HTMLElement, w: number, h: number): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: w })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: h })
}

function shellDom() {
  const { container } = render(
    <PaperFitShell>
      <p>content</p>
    </PaperFitShell>
  )
  return {
    pane: container.querySelector<HTMLElement>('.preview-pane') as HTMLElement,
    wrap: container.querySelector<HTMLElement>('.preview-scale-wrapper') as HTMLElement,
    container
  }
}

const PAPER_W = 794
const PAPER_H = 1123

beforeEach(() => {
  roCallback = null
  useResumeStore.setState({ resumeId: 't4-id', resume: createEmptyResume(), privacyMode: false })
})

describe('PaperFitShell（A4 适配缩放）', () => {
  it('零尺寸兜底：clientWidth/Height = 0 → scale 回落 1，wrapper 为 A4 全尺寸', () => {
    const { pane, wrap } = shellDom()
    // mount effect 已用 0 尺寸跑过一次 update
    expect(pane.style.getPropertyValue('--preview-scale')).toBe('1')
    expect(wrap.style.width).toBe(`${PAPER_W}px`)
    expect(wrap.style.height).toBe(`${PAPER_H}px`)
  })

  it('宽约束：scale = availW/794；wrapper 宽高按比例同步', () => {
    const { pane, wrap } = shellDom()
    setSize(pane, 474, 2227) // availW=394、availH=2123 → 宽约束
    fireRo()
    const s = 394 / PAPER_W
    expect(parseFloat(pane.style.getPropertyValue('--preview-scale'))).toBeCloseTo(s, 12)
    expect(wrap.style.width).toBe(`${Math.round(PAPER_W * s)}px`)
    expect(wrap.style.height).toBe(`${Math.round(PAPER_H * s)}px`)
  })

  it('高约束：scale = availH/1123', () => {
    const { pane, wrap } = shellDom()
    setSize(pane, 1874, 1203) // availH=1099 < availW=1794 → 高约束
    fireRo()
    const s = 1099 / PAPER_H
    expect(parseFloat(pane.style.getPropertyValue('--preview-scale'))).toBeCloseTo(s, 12)
    expect(wrap.style.height).toBe('1099px')
    expect(wrap.style.width).toBe(`${Math.round(PAPER_W * s)}px`)
  })

  it('封顶 100%：超大容器 scale 不超过 1', () => {
    const { pane, wrap } = shellDom()
    setSize(pane, 20000, 20000)
    fireRo()
    expect(pane.style.getPropertyValue('--preview-scale')).toBe('1')
    expect(wrap.style.width).toBe(`${PAPER_W}px`)
    expect(wrap.style.height).toBe(`${PAPER_H}px`)
  })

  it('容器变化触发重算；尺寸未变不重复写 DOM（防循环 guard）', () => {
    const { pane, wrap } = shellDom()
    setSize(pane, 474, 2227)
    fireRo()
    expect(wrap.style.width).toBe('394px')
    // 同尺寸再触发 → 样式保持不变（guard 分支）
    const snapshot = `${wrap.style.width}|${wrap.style.height}|${pane.style.getPropertyValue('--preview-scale')}`
    fireRo()
    expect(`${wrap.style.width}|${wrap.style.height}|${pane.style.getPropertyValue('--preview-scale')}`).toBe(snapshot)
    // 容器变窄 → 重算出新比例
    setSize(pane, 374, 2227) // availW=294
    fireRo()
    const s2 = 294 / PAPER_W
    expect(wrap.style.width).toBe(`${Math.round(PAPER_W * s2)}px`)
  })
})

describe('BasicPreview（选模板壳）', () => {
  it('store 模式：渲染 store 简历内容于 A4 纸张内', () => {
    const r = createEmptyResume()
    r.basics.name = '张三'
    useResumeStore.setState({ resume: r })
    render(<BasicPreview />)
    expect(document.querySelector('.preview-paper')).toBeTruthy()
    expect(screen.getAllByText('张三').length).toBeGreaterThan(0)
  })

  it('preview 模式：传外部 resume 则渲染外部数据（store 内容不出现在预览）', () => {
    const r = createEmptyResume()
    r.basics.name = '李四'
    render(<BasicPreview preview={{ resume: r as Resume, templateId: 'compact' }} />)
    expect(screen.getAllByText('李四').length).toBeGreaterThan(0)
    expect(screen.queryByText('张三')).toBeNull()
  })
})
