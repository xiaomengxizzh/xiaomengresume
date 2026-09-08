/**
 * safeUuid 测试 —— 原生路径 + 非安全上下文兜底路径（局域网 http 场景）。
 */
import { describe, expect, it, vi } from 'vitest'
import { safeUuid } from '../uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('safeUuid', () => {
  it('安全上下文：走原生 randomUUID', () => {
    const id = safeUuid()
    expect(id).toMatch(V4)
    expect(id).not.toBe(safeUuid())
  })

  it('非安全上下文（randomUUID 缺失）：getRandomValues 兜底仍产出合法 v4', () => {
    const realCrypto = globalThis.crypto
    // 模拟局域网 http：randomUUID 整体缺失，仅保留 getRandomValues
    vi.stubGlobal(
      'crypto',
      { getRandomValues: (arr: Uint8Array): Uint8Array => realCrypto.getRandomValues(arr) } as unknown as Crypto
    )
    try {
      const a = safeUuid()
      const b = safeUuid()
      expect(a).toMatch(V4)
      expect(b).toMatch(V4)
      expect(a).not.toBe(b)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
