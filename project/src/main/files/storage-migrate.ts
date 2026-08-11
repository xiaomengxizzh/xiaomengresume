/**
 * storage-migrate - F21 resume storage location migration (tech-spec 3.11.3, landed 2026-08-11)
 * Semantics: probe writable, then copy all .json + .bak.* + photos/, return migrated count.
 * On failure: do NOT switch (caller keeps old storage.folderPath); old files are kept.
 * Security: node:fs only; target paths go through path.resolve + boundary check.
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

/** Recursively copy a directory (photos/ etc.), return copied file count */
async function copyDir(src: string, dst: string): Promise<number> {
  let count = 0
  const entries = await fs.readdir(src).catch(() => [] as string[])
  await fs.mkdir(dst, { recursive: true })
  for (const f of entries) {
    const s = path.resolve(src, f)
    const d = path.resolve(dst, f)
    if (!s.startsWith(src + path.sep) || !d.startsWith(dst + path.sep)) continue
    const st = await fs.stat(s).catch(() => null)
    if (!st) continue
    if (st.isDirectory()) count += await copyDir(s, d)
    else if (st.isFile()) {
      await fs.copyFile(s, d)
      count += 1
    }
  }
  return count
}

/*
 * Migrate storage directory: probe writable, then copy .json/.bak.* plus photos/, return migrated count.
 * @param oldDir current storage base dir (getStorageDir())
 * @param newDir target dir (user chosen / default)
 */
export async function migrateStorage(oldDir: string, newDir: string): Promise<number> {
  if (typeof oldDir !== 'string' || oldDir.length === 0 || typeof newDir !== 'string' || newDir.length === 0) {
    throw new Error('migrateStorage: invalid directory')
  }
  // 1) probe writable (mkdir may succeed on read-only dir; writing a file confirms)
  await fs.mkdir(newDir, { recursive: true })
  const probe = path.resolve(newDir, '.write-probe')
  if (!probe.startsWith(newDir + path.sep)) throw new Error('migrateStorage: unsafe probe path')
  await fs.writeFile(probe, 'ok', 'utf-8')
  await fs.unlink(probe).catch(() => {})

  // 2) copy .json + .bak.* + photos/ (skip .tmp - not formal data)
  let count = 0
  const entries = await fs.readdir(oldDir).catch(() => [] as string[])
  for (const f of entries) {
    if (f.endsWith('.tmp')) continue
    const src = path.resolve(oldDir, f)
    const dst = path.resolve(newDir, f)
    if (!src.startsWith(oldDir + path.sep) || !dst.startsWith(newDir + path.sep)) continue
    const st = await fs.stat(src).catch(() => null)
    if (!st) continue
    if (st.isDirectory()) {
      // photos/ moves with storage (photo-store extension reserved in batch B)
      if (f === 'photos') count += await copyDir(src, dst)
      continue
    }
    if (st.isFile()) {
      await fs.copyFile(src, dst)
      count += 1
    }
  }
  return count
}
