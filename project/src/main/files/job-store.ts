/**
 * job-store.ts —— F19 岗位目录存储（M3 落码，R 批 WP-R1 定案）
 * 依据：《项目功能.md》F19 +《技术栈.md》§3.11.2：路径 userData/jobs/<id>.json（与简历主存平行）；
 * 仿 resume-store 生命周期——uuid 校验（路径穿越防护）、.tmp 锁原子写、.bak 轮转 N=5。
 * 偏差（登记 §2.4）：岗位 .tmp 残留不参与启动崩溃恢复扫描（岗位量小、非主数据，重写即覆盖）。
 */
import { app } from 'electron'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import { JobSchema, type Job } from '../../shared/schema/job'
import type { JobSummary } from '../../shared/ipc-channels'

const JOBS_DIR = path.join(app.getPath('userData'), 'jobs')
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BACKUPS = 5

function assertUuid(id: string): void {
  if (!UUID_RE.test(id)) throw new Error(`invalid job id: ${id}`)
}

function jobFilePath(id: string): string {
  return path.join(JOBS_DIR, `${id}.json`)
}

async function ensureJobsDir(): Promise<void> {
  await fs.mkdir(JOBS_DIR, { recursive: true })
}

/* ── per-id 写队列（防并发双写，与 resume-store 同语义）────────────────── */

const writeQueues = new Map<string, Promise<unknown>>()

function withWriteLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(id) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  writeQueues.set(
    id,
    next.catch(() => {
      /* 错误由调用方拿到，不污染队列链 */
    })
  )
  void next.finally(() => {
    if (writeQueues.get(id) === next) writeQueues.delete(id)
  })
  return next
}

/** 原子写（.tmp 锁 + .bak 轮转） */
async function atomicWrite(id: string, job: Job): Promise<Job> {
  return await withWriteLock(id, async () => {
    await ensureJobsDir()
    const file = jobFilePath(id)
    const tmp = `${file}.tmp`
    const json = JSON.stringify(job, null, 2)
    try {
      await fs.writeFile(tmp, json, 'utf-8')
      await rotateBackup(id)
      await fs.rename(tmp, file)
    } finally {
      await fs.unlink(tmp).catch(() => {})
    }
    return job
  })
}

async function rotateBackup(id: string): Promise<void> {
  const file = jobFilePath(id)
  try {
    const data = await fs.readFile(file)
    const bak = `${file}.bak.${Date.now()}`
    await fs.writeFile(bak, data)
    const files = (await fs.readdir(JOBS_DIR)).filter((f) => f.startsWith(`${id}.json.bak.`)).sort()
    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift()
      if (oldest) await fs.unlink(path.join(JOBS_DIR, oldest)).catch(() => {})
    }
  } catch {
    /* 无现存正式文件（首次保存）→ 跳过备份 */
  }
}

/* ── 生命周期 ──────────────────────────────────────────────────────────── */

/** 保存：Zod 校验 + 刷新 updatedAt（id 取自 job.id；调用方经 createEmptyJob 生成） */
export async function saveJob(job: Job): Promise<Job> {
  assertUuid(job.id)
  const validated = JobSchema.parse(job)
  const updated = { ...validated, updatedAt: new Date().toISOString() }
  return atomicWrite(job.id, updated)
}

/** 读取（migrate 无版本概念——JobSchema 直通校验） */
export async function getJob(id: string): Promise<Job> {
  assertUuid(id)
  const raw = JSON.parse(await fs.readFile(jobFilePath(id), 'utf-8')) as unknown
  return JobSchema.parse(raw)
}

/** 删除：unlink + 清理 .tmp/.bak 序列 */
export async function deleteJob(id: string): Promise<boolean> {
  assertUuid(id)
  return await withWriteLock(id, async () => {
    await ensureJobsDir().catch(() => {})
    await fs.unlink(jobFilePath(id)).catch(() => {})
    await fs.unlink(`${jobFilePath(id)}.tmp`).catch(() => {})
    let files: string[] = []
    try {
      files = await fs.readdir(JOBS_DIR)
    } catch {
      /* 目录不可读：跳过 .bak 清理 */
    }
    for (const f of files.filter((x) => x.startsWith(`${id}.json.bak.`))) {
      await fs.unlink(path.join(JOBS_DIR, f)).catch(() => {})
    }
    return true
  })
}

/** 摘要列表（按文件 mtime 倒序，新→旧；单份损坏跳过不影响整体） */
export async function listJobs(): Promise<JobSummary[]> {
  await ensureJobsDir().catch(() => {})
  let files: string[] = []
  try {
    files = await fs.readdir(JOBS_DIR)
  } catch {
    return []
  }
  const items: Array<{ id: string; name: string; appliedAt?: string; mtime: number }> = []
  for (const f of files) {
    if (!f.endsWith('.json') || f.includes('.bak.') || f.endsWith('.tmp')) continue
    const id = f.slice(0, -5)
    if (!UUID_RE.test(id)) continue
    try {
      const job = JobSchema.parse(JSON.parse(await fs.readFile(path.join(JOBS_DIR, f), 'utf-8')))
      const stat = await fs.stat(path.join(JOBS_DIR, f))
      items.push({ id: job.id, name: job.name, appliedAt: job.appliedAt, mtime: stat.mtimeMs })
    } catch {
      /* 单份损坏不影响整体列表 */
    }
  }
  return items.sort((a, b) => b.mtime - a.mtime).map(({ id, name, appliedAt }) => ({ id, name, appliedAt }))
}
