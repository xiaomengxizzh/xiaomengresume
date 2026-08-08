import { describe, it, expect } from 'vitest'
import { createZip, extractZip } from '../files/zip'
import { extractPendingIds } from '../files/recovery'

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

describe('崩溃恢复协议 extractPendingIds（P0-1 回归）', () => {
  const UUID = '3b1f2c6a-8e4d-4f2a-9b0c-1a2b3c4d5e6f'

  it('剥掉 .json.tmp 得裸 uuid（原 slice(0,-4) 留下 .json 致 recover 必失败）', () => {
    const files = [`${UUID}.json.tmp`, 'other-file.json', `${UUID}.bak.1234567890`, 'notes.txt']
    expect(extractPendingIds(files)).toEqual([UUID])
  })

  it('非 .tmp 与非法 uuid 均过滤', () => {
    expect(extractPendingIds([`${UUID}.json`, 'bad-id.json.tmp', 'x.json.tmp'])).toEqual([])
  })
})
