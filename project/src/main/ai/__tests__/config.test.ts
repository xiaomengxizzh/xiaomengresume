/**
 * config.test.ts —— H1 修复批③A：ai-keys.json 数据安全（TDD 先红后绿）
 * 原缺陷：persistKeys 直接 writeFile 非原子（崩溃截断）；loadKeys 失败后 keysCache={},
 * 下次 setApiKey 把空表写回 → 用户 Key 静默清零。
 * 修复语义：① .tmp+rename 原子写；② 读失败置标志，首次 persist 前把损坏文件改名
 * .corrupt.<ts> 保留（供手工抢救），再原子写新表。
 * keysCache 为模块级单例 → vi.resetModules + 动态 import 逐用例隔离。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const TEST_DIR = vi.hoisted(() => `${process.cwd()}/.tmp/xm-config-test`)
const KEYS_FILE = path.join(TEST_DIR, 'ai-keys.json')

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8')
  }
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(): undefined {
      return undefined
    }
    set(): void {}
    delete(): void {}
    get path(): string {
      return path.join(TEST_DIR, 'settings.json')
    }
  }
}))

const loadConfig = async (): Promise<typeof import('../config')> => import('../config')

beforeEach(async () => {
  vi.resetModules()
  await fs.rm(TEST_DIR, { recursive: true, force: true })
  await fs.mkdir(TEST_DIR, { recursive: true })
})

describe('ai-keys.json 原子写 + 读失败保护（H1）', () => {
  it('setApiKey 落盘无 .tmp 残留，getApiKey 回读一致', async () => {
    const cfg = await loadConfig()
    await cfg.setApiKey('deepseek', 'sk-test-123')
    const raw = JSON.parse(await fs.readFile(KEYS_FILE, 'utf-8')) as Record<string, string>
    expect(Object.keys(raw)).toEqual(['deepseek'])
    // 原子写：rename 后不得残留临时文件
    await expect(fs.readFile(`${KEYS_FILE}.tmp`)).rejects.toThrow()
    expect(await cfg.getApiKey('deepseek')).toBe('sk-test-123')
  })

  it('预置损坏文件：内存空表可用，setApiKey 后损坏原文保留为 .corrupt.*、新表只含新 key', async () => {
    await fs.writeFile(KEYS_FILE, '{truncated', 'utf-8')
    const cfg = await loadConfig()
    expect(await cfg.getApiKey('deepseek')).toBeNull()
    await cfg.setApiKey('openai', 'sk-new')
    const dir = await fs.readdir(TEST_DIR)
    const corrupts = dir.filter((f) => f.startsWith('ai-keys.json.corrupt.'))
    expect(corrupts).toHaveLength(1)
    expect(await fs.readFile(path.join(TEST_DIR, corrupts[0]), 'utf-8')).toBe('{truncated')
    const now = JSON.parse(await fs.readFile(KEYS_FILE, 'utf-8')) as Record<string, string>
    expect(Object.keys(now)).toEqual(['openai'])
    expect(now.openai).toBeTruthy()
  })

  it('正常读取后的 setApiKey 不产生 .corrupt（仅真损坏才备份），多 key 合并保留', async () => {
    const k1 = Buffer.from('k1', 'utf-8').toString('base64')
    await fs.writeFile(KEYS_FILE, JSON.stringify({ deepseek: k1 }), 'utf-8')
    const cfg = await loadConfig()
    expect(await cfg.getApiKey('deepseek')).toBe('k1')
    await cfg.setApiKey('google', 'g-key')
    const dir = await fs.readdir(TEST_DIR)
    expect(dir.some((f) => f.startsWith('ai-keys.json.corrupt.'))).toBe(false)
    const raw = JSON.parse(await fs.readFile(KEYS_FILE, 'utf-8')) as Record<string, string>
    expect(Object.keys(raw).sort()).toEqual(['deepseek', 'google'])
  })
})
