/**
 * use-autosave.test.tsx —— G2 修复批②：飞行中丢请求
 * 原缺陷：`if (inFlightRef.current) return false` —— 飞行窗口内的新编辑/flush 被静默丢弃，
 * 卸载 flush 撞上飞行保存即丢最后一次编辑。
 * 修复：飞行中置 pendingRef，保存完成后（finally）检查 pending 再补一次保存（最新内容）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'
import { useResumeStore } from '../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 微任务排空（finally → 补存链路需要多轮） */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

function setup(saveMock: ReturnType<typeof vi.fn>): void {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    resumes: {
      save: saveMock,
      saveNow: vi.fn().mockResolvedValue(undefined)
    },
    window: { onBeforeHide: vi.fn(() => vi.fn()) }
  }
  const r = createEmptyResume()
  r.basics.name = 'v0'
  useResumeStore.getState().loadResume(ID, r)
}

describe('G2 useAutoSave 飞行中请求不丢', () => {
  beforeEach(() => {
    vi.useFakeTimers() // 冻结 500ms 防抖调度，测试只走 flush 路径
  })

  it('飞行中第二次 flush → 完成后自动补存一次，且保存的是最新内容', async () => {
    const d1 = deferred<boolean>()
    const saveMock = vi.fn().mockImplementationOnce(() => d1.promise)
    setup(saveMock)

    const { result } = renderHook(() => useAutoSave())
    await act(async () => {}) // 挂载 effect 排空

    // 第一次 flush → 进入飞行（save 挂起）
    let first: boolean | undefined
    act(() => {
      void result.current.flush().then((ok) => {
        first = ok
      })
    })
    expect(saveMock).toHaveBeenCalledTimes(1)

    // 飞行窗口内新编辑 + 第二次 flush（原实现：静默丢弃）
    act(() => {
      useResumeStore.getState().setField('basics.name', 'v2-latest')
    })
    let second: boolean | undefined
    await act(async () => {
      second = await result.current.flush()
    })
    expect(second).toBe(false) // 飞行中立即返回 false（语义保持），但已登记补存
    expect(saveMock).toHaveBeenCalledTimes(1) // 原实现到此为止——丢请求

    // 第一笔保存完成 → finally 检查 pending → 微任务链自动补存（不推进定时器，排除防抖调度干扰）
    await act(async () => {
      d1.resolve(true)
      await settle()
    })

    expect(saveMock).toHaveBeenCalledTimes(2)
    expect(first).toBe(true)
    const secondCallArg = saveMock.mock.calls[1]?.[1] as { basics: { name: string } }
    expect(secondCallArg.basics.name).toBe('v2-latest') // 补的是飞行窗口内的最新编辑
    // 补存完成后不再连锁（防无限循环）；只推进 < 防抖窗时长，排除正常调度产生第三次
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
      await settle()
    })
    expect(saveMock).toHaveBeenCalledTimes(2)
  })

  it('无飞行冲突时 flush 行为不变（单次保存返回真实结果）', async () => {
    const saveMock = vi.fn().mockResolvedValue(true)
    setup(saveMock)
    const { result } = renderHook(() => useAutoSave())
    await act(async () => {})

    let ok: boolean | undefined
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(true)
    expect(saveMock).toHaveBeenCalledTimes(1)
  })
})
