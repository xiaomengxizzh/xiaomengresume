/**
 * ai-match.test.tsx —— G5 修复批②：统一 IPC 错误处理 safeInvoke
 * 原缺陷：run() 裸 await——通道级 reject 时 busy 永久卡死（按钮永久禁用）且无用户反馈。
 * 断言：reject 后 busy 复位（按钮重新可用）；业务错误展示分支不受影响（保持既有 UI）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react'
import '../../i18n'
import i18n from '../../i18n'
import { AiMatch } from '../AiMatch'
import { useResumeStore } from '../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

afterEach(() => cleanup())

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'

function findRunButton(container: HTMLElement): HTMLButtonElement {
  const label = i18n.t('ai.match.run') as string
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label))
  if (!btn) throw new Error(`run button (${label}) not found`)
  return btn
}

function mockElectronApi(matchImpl: ReturnType<typeof vi.fn>): void {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    ai: { match: matchImpl },
    // AiContextBar（AiScreenLayout 外壳）挂载时拉取列表
    jobs: { list: vi.fn().mockResolvedValue([]) },
    resumes: { list: vi.fn().mockResolvedValue([]) }
  }
}

describe('G5 safeInvoke：通道 reject 后 busy 复位', () => {
  it('ai.match reject → toast 上报 + 按钮不再永久禁用', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // 受控时序：挂起中验证 busy 置位，再手动 reject 验证 finally 复位
    let rej!: (e: unknown) => void
    const matchMock = vi.fn().mockReturnValue(
      new Promise<never>((_, reject) => {
        rej = reject
      })
    )
    mockElectronApi(matchMock)

    useResumeStore.getState().loadResume(ID, createEmptyResume())
    useResumeStore.getState().setAiContext({ resumeId: ID, jobId: 'job-1' })

    const { container } = render(<AiMatch />)
    const btn = findRunButton(container)
    expect(btn.disabled).toBe(false)

    fireEvent.click(btn)
    // 挂起即 busy
    await waitFor(() => expect(matchMock).toHaveBeenCalledTimes(1))
    expect(btn.disabled).toBe(true)

    // reject 后 finally 复位——原实现此处永久禁用
    rej(new Error('channel down'))
    await waitFor(() => expect(btn.disabled).toBe(false))
    // 默认反馈走 reportIpcError（toast 总线 + console.error）
    await waitFor(() => expect(errSpy).toHaveBeenCalled())
  })

  it('业务错误（res.ok=false）仍走既有 error 展示，不弹 toast 分支', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockElectronApi(vi.fn().mockResolvedValue({ ok: false, error: { code: 'AI_UNAVAILABLE' } }))

    useResumeStore.getState().loadResume(ID, createEmptyResume())
    useResumeStore.getState().setAiContext({ resumeId: ID, jobId: 'job-1' })

    const { container } = render(<AiMatch />)
    fireEvent.click(findRunButton(container))

    // error 空态出现（既有展示语义保持），且 busy 已复位
    await waitFor(() =>
      expect(container.textContent).toContain(i18n.t('ai.error.AI_UNAVAILABLE') as string)
    )
    expect(findRunButton(container).disabled).toBe(false)
    expect(errSpy).not.toHaveBeenCalled() // Result 业务错误不经 reportIpcError
  })
})
