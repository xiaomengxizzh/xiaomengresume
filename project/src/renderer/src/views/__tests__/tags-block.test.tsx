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
import { ResumeBody } from '../../templates/shared/ResumeBody'
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

  it('D：输入文字 → 替换图案（icon 清除，简历标签标题变文字）', async () => {
    const { container } = render(<EditorView />)
    await waitFor(() => expect(comboInputs(container).length).toBeGreaterThan(0))
    const inp = comboInputs(container)[0]
    fireEvent.change(inp, { target: { value: '宠物' } })
    await act(async () => {})
    const f0 = (useResumeStore.getState().resume.basics.customFields ?? [])[0]
    expect(f0.label).toBe('宠物') // 简历标签标题显示文字
    expect(f0.icon ?? '').toBe('') // 图案被清除（文字标签）
  })

  it('E：先输入文字再选图案 → 图案替换文字（label = 图案名）', async () => {
    const { container } = render(<EditorView />)
    await waitFor(() => expect(comboInputs(container).length).toBeGreaterThan(0))
    const inp = comboInputs(container)[0]
    fireEvent.change(inp, { target: { value: '宠物' } })
    await act(async () => {})
    // 选图案"邮箱" → 文字被替换
    const cell = comboInputs(container)[0].closest('.grid > div') as HTMLElement
    const arrow = [...cell.querySelectorAll('button')].find((b) => b.textContent?.trim() === '▾') as HTMLButtonElement
    fireEvent.click(arrow)
    const panel = arrow.closest('.relative')?.querySelector('.absolute') as HTMLElement
    const mailBtn = [...panel.querySelectorAll('button')].find((b) => b.textContent?.includes('邮箱'))
    fireEvent.click(mailBtn as HTMLButtonElement)
    await act(async () => {})
    const f0 = (useResumeStore.getState().resume.basics.customFields ?? [])[0]
    expect(f0.label).toBe('邮箱') // 图案替换文字
    expect(f0.icon).toBe('mail')
  })

  it('F：文字标签（无 icon）渲染显示 label 标题（非地址图标）', async () => {
    const r = createEmptyResume()
    r.basics.customFields = [{ id: 'c1', label: '宠物', value: '旺财', icon: '' }]
    const { container } = render(<ResumeBody variant="classic" resume={r} />)
    const body = container.querySelector('.preview-paper-body') as HTMLElement
    expect(body).toBeTruthy()
    expect(body.textContent).toContain('宠物') // 文字标签标题显示
    expect(body.textContent).toContain('旺财') // value 显示
    // 无 pin 图标（文字标签不兜底图案）——该格无 <svg>
    const cell = [...body.querySelectorAll('.redact-field')].find((el) => el.textContent?.includes('旺财'))
    expect(cell?.querySelector('svg')).toBeFalsy()
  })

  it('G：旧 infoItems 迁入 customFields（双源统一）+ infoItems 清空', async () => {
    const r = createEmptyResume()
    r.basics.infoItems = [{ id: 'x1', icon: 'phone', label: '', value: '13800138000' }]
    useResumeStore.setState({ resume: r, resumeId: 'g-id', currentView: 'editor', activeSection: null, activeFieldPath: null })
    const { container } = render(<EditorView />)
    await waitFor(() => expect(comboInputs(container).length).toBeGreaterThan(0))
    const st = useResumeStore.getState().resume.basics
    // infoItems 迁入 customFields + infoItems 清空（编辑区与简历显示统一为 customFields）
    expect(st.infoItems ?? []).toHaveLength(0)
    const cf = st.customFields ?? []
    expect(cf.some((f) => f.value === '13800138000')).toBe(true)
  })
})
