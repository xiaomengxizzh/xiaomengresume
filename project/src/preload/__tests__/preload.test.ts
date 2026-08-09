/**
 * preload.test.ts —— preload 健壮性回归（2026-08-09）
 * 根因：F18 data-theme 注入在 preload 早期裸访问 document.documentElement（可能为 null）
 * → 抛 TypeError → 整个 preload 中断 → electronAPI 未暴露 → 全功能失效。
 * 断言：documentElement 为 null 时 preload 不抛错、electronAPI 仍暴露。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exposeInMainWorld = vi.fn()
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: (...a: unknown[]) => exposeInMainWorld(...a) },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() }
}))

describe('preload 健壮性', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear()
    // 模拟 preload 早期：documentElement 未就绪（null），且无 --xm-theme 参数
    ;(process as { argv: string[] }).argv = process.argv.filter((a) => !a.startsWith('--xm-theme='))
    Object.defineProperty(document, 'documentElement', { value: null, configurable: true })
  })

  it('documentElement 为 null 时不抛错、electronAPI 仍暴露', async () => {
    // 动态 import：preload 顶层执行（injectTheme + exposeInMainWorld）
    await import('../index')
    expect(exposeInMainWorld).toHaveBeenCalledWith('electronAPI', expect.any(Object))
  })
})
