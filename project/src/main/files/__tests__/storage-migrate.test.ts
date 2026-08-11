/**
 * storage-migrate 单元测试（2026-08-11 F21 存储位置迁移落码）
 */
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { migrateStorage } from '../storage-migrate'

async function tmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'xm-migrate-test-'))
}

describe('storage-migrate', () => {
  it('迁移 .json/.bak.*/photos/，跳过 .tmp，不删旧文件', async () => {
    const oldDir = await tmpDir()
    const newDir = path.join(await tmpDir(), 'target')
    await fs.writeFile(path.join(oldDir, 'a.json'), '{}')
    await fs.writeFile(path.join(oldDir, 'a.json.bak.1000'), '{}')
    await fs.writeFile(path.join(oldDir, 'a.json.tmp'), '{}') // 应跳过（非正式数据）
    await fs.mkdir(path.join(oldDir, 'photos'))
    await fs.writeFile(path.join(oldDir, 'photos', 'p.png'), 'x')

    const count = await migrateStorage(oldDir, newDir)
    expect(count).toBe(3) // a.json + a.json.bak.1000 + photos/p.png

    expect(await fs.readFile(path.join(newDir, 'a.json'), 'utf-8')).toBe('{}')
    expect(await fs.readFile(path.join(newDir, 'a.json.bak.1000'), 'utf-8')).toBe('{}')
    expect(await fs.readFile(path.join(newDir, 'photos', 'p.png'), 'utf-8')).toBe('x')
    // .tmp 不迁移
    await expect(fs.stat(path.join(newDir, 'a.json.tmp'))).rejects.toThrow()
    // 旧文件保留（不删旧数据）
    expect(await fs.readFile(path.join(oldDir, 'a.json'), 'utf-8')).toBe('{}')
  })

  it('目标位置不可写（父级是文件）→ 探针失败抛错', async () => {
    const oldDir = await tmpDir()
    const badTarget = path.join(oldDir, 'file.txt')
    await fs.writeFile(badTarget, 'x')
    await expect(migrateStorage(oldDir, path.join(badTarget, 'sub'))).rejects.toThrow()
  })

  it('旧目录为空 → 迁移 0 个，新目录仍创建', async () => {
    const oldDir = await tmpDir()
    const newDir = path.join(await tmpDir(), 'empty')
    expect(await migrateStorage(oldDir, newDir)).toBe(0)
    expect((await fs.stat(newDir)).isDirectory()).toBe(true)
  })
})
