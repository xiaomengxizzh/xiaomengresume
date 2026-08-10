/**
 * tags-block.test.tsx —— TagsBlock combobox 回归（2026-08-10 用户反馈修复）：
 * A 有值格切换图案 label 同步 / B 删除不重注入 / C 删光不重注入
 * jsdom + store 注入含 6 字段 basics → TagsBlock 注入 6 格 → fireEvent 操作
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act, waitFor } from '@testing-library/react'
import '../../i18n'
import { EditorView } from '../EditorView'
import { useResumeStore } from '../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

vi.mock('@tiptap/react', () => ({
  useEditor: (): null => null,
  EditorContent: (): null => null
}))
class MockResizeObserver { observe(): void {} unobserve(): void {} disconnect(): void {} }
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = MockResizeObserver
Element.prototype.scrollIntoView = (() => {}) as never
;(window as unknown as { electronAPI: unknown }).electronAPI = { resumes: { save: vi.fn() } } as never

function resumeWithBasics() {
  const r = createEmptyResume()
  const b = r.basics
  b.phone = '13800138000'
  b.email = 'a@b.com'
  b.location = '北京市'
  b.website = 'https://x.dev'
  b.birthDate = '1995-01'
  b.employmentStatus = '在职'
  return r
}

/** TagsBlock combobox 输入框（含 ▾ 的格） */
function comboInputs(container: HTMLElement): HTMLInputElement[] {
  return [...container.querySelectorAll('.grid > div')]
    .filter((d) => d.className.includes('flex flex-col') && [...d.querySelectorAll('button')].some((b) => b.textContent?.trim() === '▾'))
    .map((d) => d.querySelector('input') as HTMLInputElement)
}

describe('TagsBlock combobox（回归测试（2026-08-10 用户反馈修复））', () => {
  beforeEach(() => {
    useResumeStore.setState({
      resume: resumeWithBasics(),
      resumeId: 'test-id',
      currentView: 'editor',
      activeSection: null,
      activeFieldPath: null
    })
  })

  it('A：有值格点 ▾ 下拉选"邮箱" → label 切换', async () => {
    const { container } = render(<EditorView />)
    await waitFor(() => expect(comboInputs(container).length).toBeGreaterThan(0))
    const inputs = comboInputs(container)
    expect(inputs.length).toBeGreaterThanOrEqual(6)
    // 格 0（注入电话）
    const cell = inputs[0].closest('.grid > div') as HTMLElement
    const arrow = [...cell.querySelectorAll('button')].find((b) => b.textContent?.trim() === '▾') as HTMLButtonElement
    fireEvent.click(arrow)
    // 下拉选项
    const panel = arrow.closest('.relative')?.querySelector('.absolute') as HTMLElement
    expect(panel).toBeTruthy()
    const mailBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent?.includes('邮箱'))
    expect(mailBtn).toBeTruthy()
    fireEvent.click(mailBtn as HTMLButtonElement)
    await act(async () => {})
    const fields = useResumeStore.getState().resume.basics.customFields ?? []
    expect(fields[0].label).toBe('邮箱')
  })

  it('C：删除全部标签后输入 → 不重注入旧字段（injectedRef 守卫）', async () => {
    const { container } = render(<EditorView />)
    await waitFor(() => expect(comboInputs(container).length).toBeGreaterThan(0))
    // 删除全部 6 格
    let guard = 0
    while (comboInputs(container).length > 0 && guard < 10) {
      const cell = comboInputs(container)[0].closest('.grid > div') as HTMLElement
      const del = [...cell.querySelectorAll('button')].find((b) => b.textContent?.trim() === '✕') as HTMLButtonElement
      if (!del) break
      fireEvent.click(del)
      await act(async () => {})
      guard++
    }
    const afterDelAll = (useResumeStore.getState().resume.basics.customFields ?? []).length
    expect(afterDelAll).toBe(0)
    // 输入新标签
    await act(async () => {})
    const inp = comboInputs(container)[0]
    fireEvent.change(inp, { target: { value: '我的标签' } })
    await act(async () => {})
    const fields = useResumeStore.getState().resume.basics.customFields ?? []
    const labels = fields.map((f) => f.label)
    // 不重注入（无电话/邮箱等旧字段）；输入值生效
    expect(labels).not.toContain('电话')
    expect(labels).not.toContain('邮箱')
    expect(labels[0]).toBe('我的标签')
  })

  it('B：删除格后输入 → 不重注入旧标签', async () => {
    const { container } = render(<EditorView />)
    await waitFor(() => expect(comboInputs(container).length).toBeGreaterThan(0))
    const inputs = comboInputs(container)
    const before = (useResumeStore.getState().resume.basics.customFields ?? []).length
    expect(before).toBeGreaterThan(0)
    // 删除格 0
    const cell = inputs[0].closest('.grid > div') as HTMLElement
    const del = [...cell.querySelectorAll('button')].find((b) => b.textContent?.trim() === '✕') as HTMLButtonElement
    fireEvent.click(del)
    await act(async () => {})
    const afterDel = (useResumeStore.getState().resume.basics.customFields ?? []).length
    expect(afterDel).toBe(before - 1)
    // 输入新标签（第一个 combobox input）
    const inp2 = comboInputs(container)[0]
    fireEvent.change(inp2, { target: { value: '我的自定义' } })
    await act(async () => {})
    const fields = useResumeStore.getState().resume.basics.customFields ?? []
    const labels = fields.map((f) => f.label)
    // 不重注入（无"电话"回来）；新输入成为首格 label
    expect(labels).not.toContain('电话')
    expect(labels[0]).toBe('我的自定义')
  })
})
