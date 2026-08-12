/**
 * editor-view.test.tsx —— P0-1 接线级回归测试（2026-08-08）
 * 防「钩子定义了没人调」复发：挂载 EditorView，模拟编辑简历名，
 * 断言 500ms 防抖后 window.electronAPI.resumes.save 被调用且携带新值。
 * 环境：jsdom + fake timers；Tiptap 以 mock 替代（jsdom 无法跑 ProseMirror）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '../../i18n' // i18n 初始化副作用
import { EditorView } from '../EditorView'
import { useResumeStore } from '../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

// Tiptap 在 jsdom 无法初始化 ProseMirror → 替换为惰性空实现（EditorPane 仍正常渲染表单）
vi.mock('@tiptap/react', () => ({
  useEditor: (): null => null,
  EditorContent: (): null => null
}))

// jsdom 无 ResizeObserver（BasicPreview 用）→ 空实现 polyfill
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// jsdom 未实现 scrollIntoView（EditorPane 反查滚动用）→ 空实现
Element.prototype.scrollIntoView = (() => {}) as never

const saveMock = vi.fn()

function mockElectronApi(): void {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    app: { ping: vi.fn(), getInfo: vi.fn() },
    print: { pdf: vi.fn() },
    ai: { streamTest: vi.fn(), onStreamChunk: vi.fn() },
    resumes: {
      save: saveMock,
      open: vi.fn(),
      duplicate: vi.fn(),
      rename: vi.fn(),
      remove: vi.fn(),
      list: vi.fn(),
      recent: vi.fn().mockResolvedValue([]),
      scanRecovery: vi.fn().mockResolvedValue([]),
      recover: vi.fn(),
      createSample: vi.fn()
    },
    backup: { exportZip: vi.fn(), importZip: vi.fn() }
  }
}

describe('EditorView 自动保存接线（P0-1 回归）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    saveMock.mockReset()
    saveMock.mockResolvedValue(createEmptyResume())
    mockElectronApi()
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    // 干净初始态：加载一份空白简历（带 id 才会触发保存）
    useResumeStore.getState().loadResume('11111111-2222-4333-8444-555555555555', createEmptyResume())
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('渲染编辑器后，模拟编辑简历标题 → 500ms 防抖后 resume.save 被调用且携带新值（T3：改 title 不影响 basics.name 姓名）', async () => {
    render(<EditorView />)

    // 简历标题输入框（TopBar，T3：独立于姓名 basics.name；placeholder 来自真实 i18n zh-CN）
    const titleInput = screen.getByPlaceholderText('未命名简历')
    fireEvent.change(titleInput, { target: { value: '张三的简历' } })

    // 防抖 500ms 推进 + flush promise 链
    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(saveMock).toHaveBeenCalledTimes(1)
    const [id, resume] = saveMock.mock.calls[0] as [string, { title?: string; basics: { name: string } }]
    expect(id).toBe('11111111-2222-4333-8444-555555555555')
    expect(resume.title).toBe('张三的简历')
    expect(resume.basics.name).not.toBe('张三的简历') // 姓名保持独立（空/原值）
  })

  it('简历名称输入框可聚焦可键入（2026-08-12 用户报障回归：模拟真实交互 聚焦→键入→store 更新）', async () => {
    render(<EditorView />)
    const titleInput = screen.getByPlaceholderText('未命名简历')
    // 真实交互模拟：点击聚焦 → 逐字键入（受控组件 onChange 每键触发 setField）
    titleInput.focus()
    expect(document.activeElement).toBe(titleInput)
    fireEvent.change(titleInput, { target: { value: '晨' } })
    fireEvent.change(titleInput, { target: { value: '王晨的销售简历' } })
    const st = useResumeStore.getState().resume
    expect(st.title).toBe('王晨的销售简历') // store 即时更新（不依赖防抖落盘）
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    const [id, resume] = saveMock.mock.calls[0] as [string, { title?: string }]
    expect(id).toBe('11111111-2222-4333-8444-555555555555')
    expect(resume.title).toBe('王晨的销售简历')
  })

  it('resumeId 为空（首页态）时不触发保存', async () => {
    useResumeStore.getState().loadResume('', createEmptyResume())
    render(<EditorView />)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(saveMock).not.toHaveBeenCalled()
  })
})
