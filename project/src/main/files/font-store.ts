/**
 * files/font-store.ts —— M5 D5 字体系统（font:// 协议 + 导入字体管理）
 * 定案：技术栈 §3.7.4 手段 D——复制 `userData/fonts/<id>.<ext>` + font:// 协议服务 +
 * 清单 `SettingsSchema.importedFonts`；许可提示由渲染层弹（仅本机使用不重新分发）。
 * family 简化：v1 用文件名（去扩展名）作 @font-face family（零依赖不解析字体内部名）。
 */
import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'

export const ALLOWED_FONT_EXT = ['.ttf', '.otf', '.woff', '.woff2'] as const
export const FONT_MAX_SIZE = 20 * 1024 * 1024 // 20MB（定案上限）

export function getFontsDir(): string {
  return join(app.getPath('userData'), 'fonts')
}

export function ensureFontsDir(): Promise<void> {
  return fs.mkdir(getFontsDir(), { recursive: true }).then(() => undefined)
}

export interface ImportedFontFile {
  id: string
  fileName: string
  family: string
  addedAt: string
}

/** 复制字体文件到 fonts/（校验扩展名/大小）；family = 文件名去扩展名（v1 简化，@font-face 用） */
export async function saveFontFile(srcPath: string, fileName: string): Promise<ImportedFontFile> {
  const ext = extname(fileName).toLowerCase()
  if (!(ALLOWED_FONT_EXT as readonly string[]).includes(ext)) {
    throw new Error('UNSUPPORTED_FONT')
  }
  const stat = await fs.stat(srcPath)
  if (stat.size > FONT_MAX_SIZE) {
    throw new Error('FONT_TOO_LARGE')
  }
  await ensureFontsDir()
  const id = randomUUID()
  await fs.copyFile(srcPath, join(getFontsDir(), `${id}${ext}`))
  return { id, fileName, family: fileName.replace(extname(fileName), ''), addedAt: new Date().toISOString() }
}

/** 删除导入字体文件（清单条目需先删，文件删除失败静默——孤儿文件可被重导覆盖） */
export async function deleteFontFile(id: string, fileName: string): Promise<void> {
  const ext = extname(fileName).toLowerCase()
  try {
    await fs.unlink(join(getFontsDir(), `${id}${ext}`))
  } catch {
    // 文件已不存在/删除失败：不阻断清单更新
  }
}
