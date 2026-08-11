/**
 * photo-store —— 照片资产文件层（2026-08-11 B1 photo 转存：dataURL 出 JSON 入文件）
 * 布局：<storageDir>/photos/<id>.<ext>（storageDir = resume-store.getStorageDir() 传入，跟随 F21 主存基准）。
 * JSON 内 resume.basics.photo 存引用 'photos/<id>.<ext>'（零 schema 变更——'data:' 开头=内嵌兼容）。
 * 安全：所有 id 先过 UUID 校验；photoRef/readdir 结果仅接受 basename 白名单；文件路径一律
 *  path.resolve + startsWith(dir + sep) 边界校验（防路径穿越）；无 shell、无动态命令。
 * scanResumeFiles 按 .json 后缀过滤天然跳过本目录；storage-migrate 未来落码时扩展迁移。
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** photos/ 子目录（基于传入的存储基准目录） */
export function photosDir(storageDir: string): string {
  return path.join(storageDir, 'photos')
}

/** 从 dataURL 提取 {mimeType, b64}（纯字符串解析：data:image/<mime>;base64,<b64>） */
function parseDataUrl(dataUrl: string): { mimeType: string; b64: string } | null {
  if (!dataUrl.startsWith('data:image/')) return null
  const sep = dataUrl.indexOf(';base64,')
  if (sep < 0) return null
  const mimeType = dataUrl.slice('data:image/'.length, sep)
  const b64 = dataUrl.slice(sep + ';base64,'.length)
  if (mimeType !== 'png' && mimeType !== 'jpeg' && mimeType !== 'webp') return null
  if (b64.length === 0) return null
  return { mimeType, b64 }
}

/** 受检文件名：<uuid>.<ext>（ext ∈ png/jpg/webp），非法抛错 */
function checkedPhotoName(id: string, ext: string): string {
  if (!UUID_RE.test(id)) throw new Error('photo-store: invalid resume id')
  if (ext !== 'png' && ext !== 'jpg' && ext !== 'webp') throw new Error('photo-store: unsupported ext')
  return `${id}.${ext}`
}

/** dataURL → 引用：解析 mime 定扩展名 → 写 <photos>/<id>.<ext> → 返回 'photos/<id>.<ext>' */
export async function savePhotoFile(storageDir: string, id: string, dataUrl: string): Promise<string> {
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) throw new Error('photo-store: invalid data url (only png/jpeg/webp)')
  const ext = parsed.mimeType === 'jpeg' ? 'jpg' : parsed.mimeType
  const buf = Buffer.from(parsed.b64, 'base64')
  const dir = photosDir(storageDir)
  const target = path.resolve(dir, checkedPhotoName(id, ext))
  if (!target.startsWith(dir + path.sep)) throw new Error('photo-store: unsafe path')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(target, buf)
  return `photos/${id}.${ext}`
}

/** 安全读照片：仅接受 photos/<uuid>.<ext>（basename 白名单，防路径穿越）→ dataURL；不存在/非法 → null */
export async function readPhotoFile(storageDir: string, photoRef: string): Promise<string | null> {
  if (!photoRef.startsWith('photos/')) return null
  const name = photoRef.slice('photos/'.length)
  if (name !== path.basename(name) || name.includes('..')) return null
  const ext = path.extname(name).slice(1)
  if (ext !== 'png' && ext !== 'jpg' && ext !== 'webp') return null
  const id = name.slice(0, name.length - ext.length - 1)
  if (!UUID_RE.test(id)) return null
  const target = path.resolve(photosDir(storageDir), name)
  if (!target.startsWith(photosDir(storageDir) + path.sep)) return null
  try {
    const buf = await fs.readFile(target)
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** 删除照片文件（deleteResume 联动；photos/<id>.* 全删，basename 白名单，失败静默不阻断删除） */
export async function deletePhotoFiles(storageDir: string, id: string): Promise<void> {
  if (!UUID_RE.test(id)) return
  try {
    const dir = photosDir(storageDir)
    const files = await fs.readdir(dir)
    for (const f of files) {
      if (f === path.basename(f) && f.startsWith(`${id}.`)) {
        const target = path.resolve(dir, f)
        if (!target.startsWith(dir + path.sep)) continue
        await fs.unlink(target).catch(() => {})
      }
    }
  } catch {
    /* photos 目录不存在/不可读：跳过 */
  }
}

/** 复制照片文件（duplicateResume 联动；photos/<fromId>.<ext> → <toId>.<ext>，basename 白名单，失败静默） */
export async function copyPhotoFiles(storageDir: string, fromId: string, toId: string): Promise<void> {
  if (!UUID_RE.test(fromId) || !UUID_RE.test(toId)) return
  try {
    const dir = photosDir(storageDir)
    const files = await fs.readdir(dir)
    for (const f of files) {
      if (f !== path.basename(f) || !f.startsWith(`${fromId}.`)) continue
      const src = path.resolve(dir, f)
      if (!src.startsWith(dir + path.sep)) continue
      const dst = path.resolve(dir, `${toId}${f.slice(fromId.length)}`)
      if (!dst.startsWith(dir + path.sep)) continue
      const buf = await fs.readFile(src).catch(() => null)
      if (buf) await fs.writeFile(dst, buf)
    }
  } catch {
    /* 复制失败不阻断 duplicate（照片可重传） */
  }
}
