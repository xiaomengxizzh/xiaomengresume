/**
 * use-app-bootstrap.test.tsx —— P1 修复批 F6：settings 加载不被前段失败连累
 * 现状：scanRecovery/recent/open/settings.get 串在同一 try，前段 reject 跳过 settings
 * → 静默回出厂。断言：前段全失败时 settings.get 仍被调用并入 store。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { defaultSettings } from '@shared/schema/settings'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))

import { useAppBootstrap } from '../useAppBootstrap'
import { useResumeStore } from '../../store/useResumeStore'

const settingsGet = vi.fn()
// 真实契约：settings.set(patch) 返回合并后的完整 Settings——
// store.setSettings 会用返回值整体替换本地 settings，mock 返回 {} 会清空状态
const settingsSet = vi.fn(async (patch: Record<string, unknown>) => ({
  ...useResumeStore.getState().settings,
  ...patch
}))

beforeEach(() => {
  settingsGet.mockReset()
  settingsGet.mockResolvedValue({ language: 'en', resumeFont: 'MockFont' })
  // 用例隔离：重置为出厂默认（防前一用例的 settings 泄漏）
  useResumeStore.setState({ settings: defaultSettings() })
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    resumes: {
      scanRecovery: vi.fn().mockRejectedValue(new Error('storage boom')),
      recent: vi.fn().mockRejectedValue(new Error('storage boom')),
      open: vi.fn().mockRejectedValue(new Error('storage boom'))
    },
    settings: { get: settingsGet, set: settingsSet }
  }
})

describe('useAppBootstrap 启动链拆分（P1 F6）', () => {
  it('scanRecovery/recent 失败 → settings.get 仍调用并入 store（不静默回出厂）', async () => {
    renderHook(() => useAppBootstrap())
    // 等 init 异步链跑完（IPC mock 均 immediately settled）
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(settingsGet).toHaveBeenCalledTimes(1)
    expect(useResumeStore.getState().settings.resumeFont).toBe('MockFont')
  })

  it('settings.get 自身失败 → 不抛错（容错，保持出厂默认）', async () => {
    settingsGet.mockRejectedValue(new Error('settings boom'))
    renderHook(() => useAppBootstrap())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(useResumeStore.getState().settings.language).toBeTruthy() // 出厂默认仍在
  })
})
