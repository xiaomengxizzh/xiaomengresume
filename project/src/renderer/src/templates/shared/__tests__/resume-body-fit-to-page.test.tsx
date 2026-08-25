/**
 * resume-body-fit-to-page.test.tsx —— G4 修复批②：fitToPage 只测量一次不重算
 * 原缺陷：measuredRef 只测一次 + effect 仅依赖 [fitToPage] → 开启后增删内容 fitScale 不更新。
 * 修复：ResizeObserver 持续观察，「未缩放自然高」变化超阈值时防抖重算 scale（下限 0.6 语义保留；
 * 用自然高而非原始 scrollHeight 判定，避免「scale 应用 → 高度变化 → 再重算」的缩放振荡回路）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act, waitFor } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

Element.prototype.scrollIntoView = (() => {}) as never
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))

// jsdom 无 ResizeObserver——stub 收集回调供测试手动触发
type RoCallback = (entries: unknown[], obs: unknown) => void
let roCallback: RoCallback | null = null
let observedEl: HTMLElement | null = null
class MockResizeObserver {
  constructor(cb: RoCallback) {
    roCallback = cb
  }
  observe(el: HTMLElement): void {
    observedEl = el
  }
  disconnect(): void {}
  unobserve(): void {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

/** 触发一次观察回调：设定 scrollHeight（模拟内容高度） */
function fireResize(h: number): void {
  Object.defineProperty(observedEl, 'scrollHeight', { configurable: true, value: h })
  act(() => {
    roCallback?.([], null)
  })
}

afterEach(() => {
  cleanup()
  roCallback = null
  observedEl = null
})

function setupFitToPage(): HTMLElement {
  const r = createEmptyResume()
  r.basics.name = '测试'
  r.layout = { ...(r.layout ?? {}), fitToPage: true }
  useResumeStore.setState({
    resume: r,
    resumeId: 'x',
    settings: { ...useResumeStore.getState().settings, templates: {} }
  })
  return render(<ResumeBody variant="classic" />).container
}

describe('G4 fitToPage 内容变化重算', () => {
  it('内容高度变化后 scale 重算（原实现只测一次，第二次触发后字号不变）', async () => {
    const container = setupFitToPage()
    const el = container.querySelector('.preview-paper-body') as HTMLElement

    // 首测（scale 未应用）：自然高 1400 → scale=1123/1400≈0.802 → fontSize=round(16×s×10)/10=12.8
    fireResize(1400)
    await waitFor(() => expect(el.style.fontSize).toBe('12.8px'))

    // 内容增加：真实 DOM 的 scrollHeight = 新自然高 × 当前应用 scale。
    // 自然高 1800、当前 scale≈0.802 → raw≈1443.86；还原 est=raw/scale=1800 → 重算 scale≈0.624 → fontSize=10
    fireResize(Math.round(1800 * (1123 / 1400)))
    await waitFor(() => expect(el.style.fontSize).toBe('10px'))
  })

  it('缩放应用后的回环测量不触发重算（防缩放振荡）', async () => {
    const container = setupFitToPage()
    const el = container.querySelector('.preview-paper-body') as HTMLElement

    fireResize(1400)
    await waitFor(() => expect(el.style.fontSize).toBe('12.8px'))
    fireResize(Math.round(1800 * (1123 / 1400)))
    await waitFor(() => expect(el.style.fontSize).toBe('10px'))

    // scale 应用改变实际 scrollHeight（≈1123 已缩放高）→ RO 回环触发：
    // 按「未缩放自然高」判定 est=1123/scale≈1800 与上次一致 → 不重算
    fireResize(1123)
    await new Promise((r) => setTimeout(r, 250)) // 越过 150ms 防抖窗
    expect(el.style.fontSize).toBe('10px')
  })
})
