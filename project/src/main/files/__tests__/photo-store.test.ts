/**
 * photo-store 单元测试（2026-08-11 B1 photo 转存：文件层 + 路径穿越防护）
 */
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { savePhotoFile, readPhotoFile, deletePhotoFiles, copyPhotoFiles } from '../photo-store'

async function tmpDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'xm-photo-test-'))
}

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'
const PNG = 'data:image/png;base64,iVBORw0KGgo='
const JPEG = 'data:image/jpeg;base64,/9j/4AAQ=='

describe('photo-store', () => {
  it('savePhotoFile 写文件并返回引用，readPhotoFile 读回同 dataURL', async () => {
    const dir = await tmpDir()
    const ref = await savePhotoFile(dir, ID, PNG)
    expect(ref).toBe(`photos/${ID}.png`)
    expect(await readPhotoFile(dir, ref)).toBe(PNG)
  })

  it('jpeg mime → jpg 扩展名', async () => {
    const dir = await tmpDir()
    const ref = await savePhotoFile(dir, ID, JPEG)
    expect(ref).toBe(`photos/${ID}.jpg`)
  })

  it('非法 dataURL（非图片 mime）抛错', async () => {
    const dir = await tmpDir()
    await expect(savePhotoFile(dir, ID, 'data:image/svg+xml;base64,xxx')).rejects.toThrow()
    await expect(savePhotoFile(dir, ID, 'data:image/png;base64,')).rejects.toThrow()
  })

  it('路径穿越防护：非法引用返回 null（.. / 未知扩展名 / 非 UUID / 目录）', async () => {
    const dir = await tmpDir()
    expect(await readPhotoFile(dir, '../evil.png')).toBeNull()
    expect(await readPhotoFile(dir, `photos/${ID}.svg`)).toBeNull()
    expect(await readPhotoFile(dir, 'photos/not-a-uuid.png')).toBeNull()
    expect(await readPhotoFile(dir, 'photos/')).toBeNull()
    expect(await readPhotoFile(dir, 'photos/../../secret.png')).toBeNull()
    // 文件不存在 → null（不抛错）
    expect(await readPhotoFile(dir, `photos/${ID}.png`)).toBeNull()
  })

  it('deletePhotoFiles 按 id 前缀删除照片', async () => {
    const dir = await tmpDir()
    await savePhotoFile(dir, ID, PNG)
    await deletePhotoFiles(dir, ID)
    expect(await readPhotoFile(dir, `photos/${ID}.png`)).toBeNull()
  })

  it('copyPhotoFiles 复制照片到新 id，原文件保留', async () => {
    const dir = await tmpDir()
    await savePhotoFile(dir, ID, PNG)
    const NEW = '6f6e7b20-3f4b-4b5d-9d2f-1b2c3d4e5f60'
    await copyPhotoFiles(dir, ID, NEW)
    expect(await readPhotoFile(dir, `photos/${NEW}.png`)).toBe(PNG)
    expect(await readPhotoFile(dir, `photos/${ID}.png`)).toBe(PNG)
  })
})
