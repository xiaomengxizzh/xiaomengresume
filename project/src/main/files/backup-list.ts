/**
 * backup-list —— P1-10 版本时间线数据层（2026-08-21）
 * 枚举/读取 `<storageDir>/<uuid>.json.bak.<ts>` 备份（命名与轮转见 resume-store.rotateBackup）。
 * 安全口径与 photo-store 一致：UUID 校验 + basename 白名单 + 前缀强匹配，防路径穿越。
 * 写回不在此处：handler 读回 Resume 后走既有 saveResume（完整三件套 + photo 转存链路）。
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { Resume } from '@shared/schema/resume'
import { migrate } from '@shared/schema/resume'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface BackupMeta {
  /** 文件名（basename；恢复时原样传回） */
  file: string
  /** 备份时间戳（文件名内嵌 epoch ms → ISO） */
  updatedAt: string
  sizeBytes: number
}

function bakPrefix(id: string): string {
  return `${id}.json.bak.`
}

/** 枚举该简历的 .bak 序列（updatedAt 倒序 = 新→旧）；非法 id / 目录不存在 → [] */
export async function listBackups(storageDir: string, id: string): Promise<BackupMeta[]> {
  if (!UUID_RE.test(id)) return []
  let names: string[]
  try {
    names = await fs.readdir(storageDir)
  } catch {
    return []
  }
  const prefix = bakPrefix(id)
  const metas: BackupMeta[] = []
  for (const name of names) {
    if (name !== path.basename(name) || !name.startsWith(prefix)) continue
    const tsRaw = name.slice(prefix.length)
    if (!/^\d+$/.test(tsRaw)) continue
    let sizeBytes = 0
    try {
      sizeBytes = (await fs.stat(path.join(storageDir, name))).size
    } catch {
      continue // stat 失败（竞态删除）跳过
    }
    metas.push({ file: name, updatedAt: new Date(Number(tsRaw)).toISOString(), sizeBytes })
  }
  return metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

/** 读取并校验一份备份 → Resume（migrate 收口）；任何不合法抛错（handler 转 i18n 错误提示） */
export async function readBackup(storageDir: string, id: string, file: string): Promise<Resume> {
  if (!UUID_RE.test(id)) throw new Error('backup-list: invalid resume id')
  if (file !== path.basename(file) || !file.startsWith(bakPrefix(id))) {
    throw new Error('backup-list: unsafe backup filename')
  }
  const raw = await fs.readFile(path.join(storageDir, file), 'utf8')
  const parsed: unknown = JSON.parse(raw) // 坏 JSON 直接抛
  return migrate(parsed)
}
