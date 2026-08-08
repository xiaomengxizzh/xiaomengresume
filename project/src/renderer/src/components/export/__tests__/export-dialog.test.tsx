/**
 * export-dialog.test.tsx —— P0 导出超时兜底回归测试（2026-08-08）
 * 防「printToPDF 永挂 → 弹窗永久锁死（running 永远 true）」复发：
 * mock electronAPI.export.run 永不返回，推进 30s 后断言超时错误提示出现、
 * 导出按钮恢复可用（setRunning(false) 生效）。
 * 环境：jsdom + fake timers；Tiptap 以 mock 替代（模板组件可能引用，jsdom 无法跑 ProseMirror）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '../../../i18n' // i18n 初始化副作用
import { ExportDialog } from '../ExportDialog'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

// Tiptap 在 jsdom 无法初始化 ProseMirror → 惰性空实现（模板组件若引用不炸）
vi.mock('@tiptap/react', () => ({
  useEditor: (): null => null,
  EditorContent: (): null => null
}))

// jsdom 无 ResizeObserver（ExportDialog 页数测量用）→ 空实现 polyfill
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function mockElectronApi(): { runMock: ReturnType<typeof vi.fn> } {
  const runMock = vi.fn()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    app: { ping: vi.fn(), getInfo: vi.fn() },
    print: { pdf: vi.fn() },
    export: {
      run: runMock,
      onProgress: vi.fn().mockReturnValue(vi.fn())
    },
    ai: { streamTest: vi.fn(), onStreamChunk: vi.fn() },
    resumes: {
      save: vi.fn(),
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
  return { runMock }
}

const RESUME_ID = '11111111-2222-4333-8444-555555555555'

describe('ExportDialog 导出超时兜底（P0 回归）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    ;(Element.prototype as { scrollIntoView?: unknown }).scrollIntoView = vi.fn()
    useResumeStore.getState().loadResume(RESUME_ID, createEmptyResume())
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('printToPDF 永挂时 30s 后报超时并恢复按钮', async () => {
    const { runMock } = mockElectronApi()
    // 模拟永挂：永不 resolve/reject 的 promise（等价于 GPU 不可用环境的 printToPDF）
    runMock.mockReturnValue(new Promise(() => {}))
    const onClose = vi.fn()

    render(<ExportDialog open={true} onClose={onClose} resumeId={RESUME_ID} />)
    // flush 打开弹窗的 measure effect（rAF）
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // 点击「导出」主按钮（精确匹配，避开其他含"导出"的 accessible name）
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '导出' }))
    })
    expect(runMock).toHaveBeenCalledTimes(1)

    // 推进 30s → 触发 renderer 侧超时兜底
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    // 断言：超时错误提示出现 + 导出按钮恢复可用（running 已复位）
    expect(screen.getByText(/导出超时/)).toBeTruthy()
    expect((screen.getByRole('button', { name: '导出' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
