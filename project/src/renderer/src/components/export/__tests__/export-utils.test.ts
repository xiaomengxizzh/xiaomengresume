/**
 * export-utils.test.ts —— M2 F5 导出工具纯函数测试（D12 页数估算）
 */
import { describe, it, expect } from 'vitest'
import { estimatePageCount } from '../ExportDialog'

describe('estimatePageCount（D12 页数估算）', () => {
  it('高度 ≤ A4 内容高 → 1 页', () => {
    expect(estimatePageCount(0)).toBe(1)
    expect(estimatePageCount(500)).toBe(1)
    expect(estimatePageCount(1038)).toBe(1)
  })

  it('略超 A4 内容高 → 2 页', () => {
    expect(estimatePageCount(1039)).toBe(2)
    expect(estimatePageCount(2000)).toBe(2)
  })

  it('多页向上取整', () => {
    expect(estimatePageCount(2077)).toBe(3)
    expect(estimatePageCount(3000)).toBe(3)
  })

  it('负值/非法输入回落 1 页', () => {
    expect(estimatePageCount(-10)).toBe(1)
  })
})
