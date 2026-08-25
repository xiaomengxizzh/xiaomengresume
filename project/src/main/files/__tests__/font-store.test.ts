/**
 * font-store.test.ts —— P0 修复批 F2：deleteFontFile 路径穿越防护
 * 覆盖：正常删除 / 恶意 id（../ 穿越）不删 fontsDir 外文件 / 非白名单扩展名与非法 id 静默跳过。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'

// vi.hoisted 早于 import 初始化：只用全局 process，禁引用 path/os
const TEST_DIR = vi.hoisted(() => `${process.env.TEMP ?? '/tmp'}/xm-font-test-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: (): string => TEST_DIR }
}))

import { saveFontFile, deleteFontFile, getFontsDir } from '../font-store'

async function makeSrc(name: string): Promise<string> {
  const src = path.join(TEST_DIR, `src-${name}`)
  await fs.mkdir(TEST_DIR, { recursive: true })
  await fs.writeFile(src, 'fake-font-bytes')
  return src
}

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true })
})

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
})

describe('font-store（F2 deleteFontFile 防护）', () => {
  it('saveFontFile → deleteFontFile 正常删除', async () => {
    const src = await makeSrc('a.ttf')
    const meta = await saveFontFile(src, 'a.ttf')
    const target = path.join(getFontsDir(), `${meta.id}.ttf`)
    expect(await fs.readFile(target, 'utf-8')).toBe('fake-font-bytes')
    await deleteFontFile(meta.id, 'a.ttf')
    await expect(fs.readFile(target)).rejects.toThrow()
  })

  it('恶意 id 路径穿越（../evil）→ 不删 fontsDir 外文件', async () => {
    // fonts/ 外的目标文件：join(fontsDir, '../evil.ttf') 解析后 = TEST_DIR/evil.ttf
    const outside = path.join(TEST_DIR, 'evil.ttf')
    await fs.writeFile(outside, 'should-survive')
    await deleteFontFile('../evil', 'evil.ttf')
    expect(await fs.readFile(outside, 'utf-8')).toBe('should-survive')
  })

  it('非白名单扩展名 / 非 UUID id → 静默跳过（不抛错不动文件）', async () => {
    const src = await makeSrc('b.woff2')
    const meta = await saveFontFile(src, 'b.woff2')
    const target = path.join(getFontsDir(), `${meta.id}.woff2`)
    await deleteFontFile(meta.id, 'b.exe') // 扩展名不在白名单
    expect(await fs.readFile(target, 'utf-8')).toBe('fake-font-bytes')
    await deleteFontFile('not-a-uuid', 'b.woff2') // id 非 UUID
    expect(await fs.readFile(target, 'utf-8')).toBe('fake-font-bytes')
    await deleteFontFile(meta.id, 'b.woff2') // 正常路径仍可删（清理）
  })
})
