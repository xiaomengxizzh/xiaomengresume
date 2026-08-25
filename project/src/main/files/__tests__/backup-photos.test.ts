/**
 * backup-photos.test.ts —— P0 修复批 F1：备份导出/导入必须打包 photos/ 照片资产
 * 覆盖：① exportBackup 打包 photos/<uuid>.<ext> 条目；② importBackup 校验白名单后落盘、
 * 非法条目（穿越/坏扩展名/非 UUID）跳过；③ photos 目录不存在优雅跳过（不抛错）。
 * mock 链仿 ai/handlers.test.ts：hoisted 仅数据常量；vi.fn 顶层声明经箭头包装进工厂。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import type { BrowserWindow } from 'electron'

const TEST_DIR = vi.hoisted(() => `${process.env.TEMP ?? '/tmp'}/xm-backup-photos-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: (k: string): string => `${TEST_DIR}/${k}` },
  dialog: {
    showSaveDialog: (...a: unknown[]) => showSaveDialog(...(a as [])),
    showOpenDialog: (...a: unknown[]) => showOpenDialog(...(a as []))
  },
  // exportBackup 签名需要 BrowserWindow，但 dialog mock 不触达真实窗口
  BrowserWindow: class {}
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(): undefined {
      return undefined
    }
    set(): void {}
    get path(): string {
      return `${TEST_DIR}/settings-test.json`
    }
  }
}))

import { exportBackup, importBackup } from '../resume-store'
import { createZip, extractZip } from '../zip'
import { savePhotoFile } from '../photo-store'

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'
const ID2 = '6f6e7b20-3f4b-4b5d-9d2f-1b2c3d4e5f60'
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
const WIN = {} as BrowserWindow
const SAVE_PATH = path.join(TEST_DIR, 'backup-out.zip')
const IMPORT_PATH = path.join(TEST_DIR, 'backup-in.zip')
/** getStorageDir() = getPath('documents')/xiaomengresume（settings.storage.folderPath 未配置） */
const STORAGE = path.join(TEST_DIR, 'documents', 'xiaomengresume')

const showSaveDialog = vi.fn(async () => ({ canceled: false, filePath: SAVE_PATH }))
const showOpenDialog = vi.fn(async () => ({ canceled: false, filePaths: [IMPORT_PATH] }))

beforeAll(async () => {
  await fs.mkdir(STORAGE, { recursive: true })
})

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true })
})

describe('备份导出/导入 photos/（P0 F1）', () => {
  it('exportBackup：photos/<uuid>.<ext> 打包进 zip（原 EISDIR 被吞 → 悬空引用）', async () => {
    await fs.writeFile(path.join(STORAGE, `${ID}.json`), '{}', 'utf-8')
    const ref = await savePhotoFile(STORAGE, ID, PNG)
    expect(ref).toBe(`photos/${ID}.png`)

    const out = await exportBackup(WIN)
    expect(out).toBe(SAVE_PATH)
    const entries = extractZip(await fs.readFile(SAVE_PATH))
    const photoEntry = entries.find((e) => e.name === `photos/${ID}.png`)
    expect(photoEntry).toBeTruthy()
    expect(photoEntry!.data.toString('base64')).toBe(PNG.slice('data:image/png;base64,'.length))
    // resumes/ 条目不受影响
    expect(entries.some((e) => e.name === `resumes/${ID}.json`)).toBe(true)
  })

  it('exportBackup：photos 目录不存在 → 优雅跳过（不抛错，仍产出 zip）', async () => {
    await fs.rm(path.join(STORAGE, 'photos'), { recursive: true, force: true })
    const out = await exportBackup(WIN)
    expect(out).toBe(SAVE_PATH)
    const entries = extractZip(await fs.readFile(SAVE_PATH))
    expect(entries.every((e) => !e.name.startsWith('photos/'))).toBe(true)
  })

  it('importBackup：合法照片条目落盘，非法条目（穿越/坏扩展/非 UUID）跳过', async () => {
    const buf = createZip([
      { name: `photos/${ID}.png`, data: Buffer.from('photo-a') },
      { name: `photos/${ID2}.jpg`, data: Buffer.from('photo-b') },
      { name: 'photos/../../evil.png', data: Buffer.from('evil') },
      { name: 'photos/3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f.exe', data: Buffer.from('exe') },
      { name: 'photos/not-a-uuid.png', data: Buffer.from('bad') }
    ])
    await fs.writeFile(IMPORT_PATH, buf)

    const n = await importBackup(WIN)
    expect(n).toBe(2)
    const files = await fs.readdir(path.join(STORAGE, 'photos'))
    expect(files.sort()).toEqual([`${ID}.png`, `${ID2}.jpg`].sort())
    expect(await fs.readFile(path.join(STORAGE, 'photos', `${ID}.png`), 'utf-8')).toBe('photo-a')
    // 穿越条目未逃出 photos 目录（TEST_DIR 根无 evil.png）
    expect(fs.readFile(path.join(TEST_DIR, 'evil.png'))).rejects.toThrow()
  })
})
