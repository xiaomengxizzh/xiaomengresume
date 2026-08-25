/**
 * ai-intro.test.tsx —— P0 修复批 F3：AiIntro 翻译 mode 时序
 * setMode('translate') 后同步调 stream.run()，闭包 mode 仍为旧值 → 首切「翻译」
 * 实际以 mode:'generate' 发起。断言：点击翻译按钮 → ai.intro 以 mode:'translate' 调用。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))

import { AiIntro } from '../AiIntro'
import { useResumeStore } from '../../store/useResumeStore'

const introMock = vi.fn().mockResolvedValue({ ok: true, data: '翻译结果' })

beforeEach(() => {
  introMock.mockClear()
  // AiScreenLayout → AiContextBar 挂载即拉简历/岗位列表
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    ai: {
      intro: introMock,
      introCancel: vi.fn().mockResolvedValue(true),
      onIntroChunk: vi.fn().mockReturnValue(() => {})
    },
    resumes: {
      list: vi.fn().mockResolvedValue([{ id: 'r-1', name: '张三', boundJobIds: [] }]),
      save: vi.fn().mockResolvedValue({})
    },
    jobs: { list: vi.fn().mockResolvedValue([]) }
  }
  useResumeStore.setState({ aiContext: { resumeId: 'r-1', jobId: null } })
})

describe('AiIntro mode 时序（P0 F3）', () => {
  it('默认「生成」→ ai.intro mode:generate', async () => {
    render(<AiIntro />)
    // 初始态 EmptyState 引导按钮与顶栏按钮同文案，取第一个（顶栏动作区）
    fireEvent.click(screen.getAllByText('ai.intro.generate')[0])
    await act(async () => {})
    expect(introMock).toHaveBeenCalledTimes(1)
    expect(introMock.mock.calls[0][0]).toMatchObject({ mode: 'generate', resumeId: 'r-1' })
  })

  it('首切「翻译」→ ai.intro 必须以 mode:translate 发起（不串 generate）', async () => {
    render(<AiIntro />)
    fireEvent.click(screen.getByText('ai.intro.translate'))
    await act(async () => {})
    expect(introMock).toHaveBeenCalledTimes(1)
    expect(introMock.mock.calls[0][0]).toMatchObject({ mode: 'translate', resumeId: 'r-1' })
  })
})
