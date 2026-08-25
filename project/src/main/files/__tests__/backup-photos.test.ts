/**
 * backup-photos.test.ts —— P0 修复批 F1：备份导出/导入必须打包 photos/ 照片资产
 * 覆盖：① exportBackup 打包 photos/<uuid>.<ext> 条目；② importBackup 校验白名单后落盘、
 * 非法条目（穿越/坏扩展名/非 UUID）跳过；③ photos 目录不存在优雅跳过（不抛错）。
 * mock 链仿 ai/handlers.test.ts：hoisted 仅数据常量；vi.fn 顶层声明经箭头包装进工厂。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
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
import { createEmptyResume } from '../../../shared/schema/resume'

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

describe('importBackup 写盘抗错 + 原子写 + 幽灵 .bak（H3）', () => {
  const BAD_ID = '8a8e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f70' // uuid 合法、内容损坏

  beforeEach(async () => {
    await fs.rm(STORAGE, { recursive: true, force: true })
    await fs.mkdir(STORAGE, { recursive: true })
  })

  it('一条损坏 + 一条正常：正常条目导入成功、损坏计入 skipped 不中断；原文件不存在 → 无 .bak 产生', async () => {
    const good = createEmptyResume()
    good.title = 'good'
    const buf = createZip([
      { name: `resumes/${ID}.json`, data: Buffer.from(JSON.stringify(good)) },
      { name: `resumes/${BAD_ID}.json`, data: Buffer.from('{broken') }
    ])
    await fs.writeFile(IMPORT_PATH, buf)

    const n = await importBackup(WIN)
    expect(n).toBe(1)
    // 正常条目落盘且可解析
    const saved = JSON.parse(await fs.readFile(path.join(STORAGE, `${ID}.json`), 'utf-8')) as { title: string }
    expect(saved.title).toBe('good')
    // 损坏条目未落盘
    await expect(fs.readFile(path.join(STORAGE, `${BAD_ID}.json`))).rejects.toThrow()
    // 原文件不存在时不打 .bak（P1-10：原实现写 0 字节幽灵备份）
    const files = await fs.readdir(STORAGE)
    expect(files.filter((f) => f.includes('.bak.'))).toEqual([])
  })

  it('原文件存在时导入前仍打 .bak 且内容为旧版（防误操作语义保留），写回走原子写无 .tmp 残留', async () => {
    const oldRaw = JSON.stringify({ schemaVersion: 1, title: 'old-version' })
    await fs.writeFile(path.join(STORAGE, `${ID}.json`), oldRaw, 'utf-8')

    const fresh = createEmptyResume()
    fresh.title = 'imported'
    const buf = createZip([{ name: `resumes/${ID}.json`, data: Buffer.from(JSON.stringify(fresh)) }])
    await fs.writeFile(IMPORT_PATH, buf)

    const n = await importBackup(WIN)
    expect(n).toBe(1)
    const files = await fs.readdir(STORAGE)
    const baks = files.filter((f) => f.startsWith(`${ID}.json.bak.`))
    expect(baks).toHaveLength(1)
    expect(await fs.readFile(path.join(STORAGE, baks[0]), 'utf-8')).toBe(oldRaw)
    const cur = JSON.parse(await fs.readFile(path.join(STORAGE, `${ID}.json`), 'utf-8')) as { title: string }
    expect(cur.title).toBe('imported')
    // 原子写：rename 后无 .tmp 残留
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false)
  })
})
