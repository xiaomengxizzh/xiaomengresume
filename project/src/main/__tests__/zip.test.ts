import { describe, it, expect } from 'vitest'
import { createZip, extractZip } from '../files/zip'

describe('zip 零依赖工具（F11 备份）', () => {
  it('create → extract round-trip 无损', () => {
    const entries = [
      { name: 'resumes/a.json', data: Buffer.from(JSON.stringify({ a: 1 })) },
      { name: 'resumes/b.json', data: Buffer.from('中文内容测试'.repeat(50)) }, // 长内容触发 deflate
      { name: 'settings/config.json', data: Buffer.from('{}') }
    ]
    const buf = createZip(entries)
    const out = extractZip(buf)
    expect(out).toHaveLength(3)
    expect(out[0].name).toBe('resumes/a.json')
    expect(JSON.parse(out[0].data.toString('utf-8'))).toEqual({ a: 1 })
    expect(out[1].data.toString('utf-8')).toBe('中文内容测试'.repeat(50))
    expect(out[2].data.toString('utf-8')).toBe('{}')
  })

  it('空条目 zip 可解包', () => {
    const buf = createZip([])
    expect(extractZip(buf)).toEqual([])
  })

  it('非 zip 数据抛错', () => {
    expect(() => extractZip(Buffer.from('not a zip at all'))).toThrow(/EOCD/)
  })
})
