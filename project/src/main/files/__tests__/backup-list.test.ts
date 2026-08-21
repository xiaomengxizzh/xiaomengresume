/**
 * backup-list 单元测试（P1-10 版本时间线，2026-08-21 · TDD 先红后绿）
 * listBackups：.bak 序列枚举 + 时间戳倒序 + 非法 id 拒绝
 * readBackup：合法备份读回 Resume（migrate 收口）/ 路径穿越与坏 JSON 拒绝
 */
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { listBackups, readBackup } from '../backup-list'

async function tmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'xm-bak-test-'))
}

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'

function resumeJson(name: string): string {
  return JSON.stringify({
    schemaVersion: 1,
    title: name,
    basics: {
      name, englishName: '', phone: '', email: '', address: '', location: '', website: '',
      photo: '', headline: '', profile: { type: 'doc', content: [] }, birthDate: '',
      employmentStatus: '', customFields: []
    },
    summary: { content: { type: 'doc', content: [] } },
    education: [], work: [], projects: [], skills: [], certificates: [], languages: [],
    boundJobIds: []
  })
}

describe('listBackups', () => {
  it('枚举该简历 .bak 序列并按时间戳倒序', async () => {
    const dir = await tmpDir()
    await fs.writeFile(path.join(dir, `${ID}.json.bak.1000`), resumeJson('a'), 'utf8')
    await fs.writeFile(path.join(dir, `${ID}.json.bak.2000`), resumeJson('b'), 'utf8')
    await fs.writeFile(path.join(dir, `${ID}.json`), resumeJson('cur'), 'utf8') // 正式文件不计
    await fs.writeFile(path.join(dir, `other-id.json.bak.3000`), '{}', 'utf8') // 他简历不计

    const metas = await listBackups(dir, ID)
    expect(metas.map((m) => m.file)).toEqual([`${ID}.json.bak.2000`, `${ID}.json.bak.1000`])
    expect(metas[0].sizeBytes).toBeGreaterThan(0)
  })

  it('非法 id / 不存在目录 → 空数组', async () => {
    expect(await listBackups(await tmpDir(), 'not-a-uuid')).toEqual([])
    expect(await listBackups(path.join(await tmpDir(), 'nope'), ID)).toEqual([])
  })
})

describe('readBackup', () => {
  it('合法备份读回 Resume（title 对应备份内容）', async () => {
    const dir = await tmpDir()
    const file = `${ID}.json.bak.1000`
    await fs.writeFile(path.join(dir, file), resumeJson('旧版本'), 'utf8')
    const r = await readBackup(dir, ID, file)
    expect(r.title).toBe('旧版本')
  })

  it('路径穿越 / 前缀不符 / 坏 JSON → 抛错', async () => {
    const dir = await tmpDir()
    await expect(readBackup(dir, ID, '../evil.json')).rejects.toThrow()
    await expect(readBackup(dir, ID, 'other.json.bak.1')).rejects.toThrow()
    const bad = `${ID}.json.bak.1000`
    await fs.writeFile(path.join(dir, bad), '{broken', 'utf8')
    await expect(readBackup(dir, ID, bad)).rejects.toThrow()
  })
})
