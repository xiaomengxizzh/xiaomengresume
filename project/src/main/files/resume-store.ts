/**
 * resume-store —— F11 简历文件层（§5.1，主进程承载，架构铁律 1）
 * 生命周期：create / open / rename / duplicate / delete / list + recent（WP-T1）。
 * 路径 = <storageFolderPath>/<id>.json（F21 #18 方案 B，默认 Documents/xiaomengresume）。
 * 数据安全三件套（已拍板 #6，不得降级）：.tmp 锁（原子写）/ .bak 轮转（N=5）/ 崩溃恢复扫描。
 * meta 写入：save 刷新 updatedAt/补 createdAt；open 刷新 lastOpenedAt（轻量原子写不触发 .bak）。
 * backup:export/import：零依赖 zip（zip.ts），打包 resumes/（含 .bak）+ jobs/ + settings JSON。
 */
import { app, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import Store from 'electron-store'
import {
  ResumeSchema,
  migrate,
  type Resume
} from '../../shared/schema/resume'
import { createZip, extractZip, type ZipEntry } from './zip'
import { extractPendingIds } from './recovery'
import { JobSchema } from '../../shared/schema/job'
import type { Settings } from '../../shared/schema/settings'
import type { RecentResume, ResumeSummary } from '../../shared/ipc-channels'

const store = new Store<Settings>()
const MAX_BACKUPS = 5
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 备份导入白名单（非敏感键；P2 用户拍板 B）：
 *  providers（API Key 敏感 + safeStorage 机器绑定）、storage（目录漂移）、
 *  importedFonts（跨机路径失效）一律跳过。 */
const SETTINGS_SAFE_KEYS = [
  'appearance',
  'appearanceMode',
  'language',
  'temperature',
  'maxTokens',
  'aiPrompts',
  'export',
  'uiFont',
  'resumeFont'
] as const

/* ── 写入健壮性（2026-08-07 二次评估采纳）────────────────────────────────── */

/** 可退避重试的系统错误码（Windows 杀软/瞬时句柄占用常见；其余错误码直接抛） */
const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY'])
/** 退避间隔（ms）：3 次重试，总等待 ≤ 50+150+450 = 650ms */
const RETRY_DELAYS = [50, 150, 450]

/** 对可重试错误做退避重试；重试耗尽或不可重试错误 → 原样抛出 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const code = (err as NodeJS.ErrnoException | undefined)?.code
      if (!code || !RETRYABLE_CODES.has(code) || attempt === RETRY_DELAYS.length) throw err
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]))
    }
  }
  throw lastErr
}

/**
 * per-id 写入串行化：同一简历的并发写（自动保存高频 + open 时间戳刷新）可能
 * 竞争同一个 <id>.json.tmp → 互相覆盖 / rename 竞态。按 id 排队逐个执行。
 * 前序写失败不阻塞后续写（各自独立 try/catch 已处理）。
 */
const writeQueues = new Map<string, Promise<unknown>>()

function withWriteLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(id) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  writeQueues.set(
    id,
    next.catch(() => {
      // 队列尾吞错：错误已由调用方拿到，不污染队列链
    })
  )
  // 2026-08-08 低危加固：写完成即释放队列条目，防 Map 随 id 无限增长
  void next.finally(() => {
    if (writeQueues.get(id) === next) writeQueues.delete(id)
  })
  return next
}

/** 存储基准目录（F21）：settings.storage.folderPath 优先，缺省 Documents/xiaomengresume */
export function getStorageDir(): string {
  if (storageFallbackDir) return storageFallbackDir
  const custom = store.get('storage.folderPath')
  if (typeof custom === 'string' && custom.length > 0) return custom
  return path.join(app.getPath('documents'), 'xiaomengresume')
}

/**
 * 会话级存储兜底（2026-08-07 二次评估采纳，与 F21 语义隔离）：
 * 首选目录不可写（只读/权限/磁盘满）时，本会话改用 userData/resumes；
 * 不写 SettingsSchema（用户设置的位置仍是首选，恢复可写后自动回到原位置）。
 */
let storageFallbackDir: string | null = null
let storageProbe: Promise<string> | null = null

async function doEnsureStorageDir(): Promise<string> {
  const dir = getStorageDir()
  try {
    await fs.mkdir(dir, { recursive: true })
    // 写探针：mkdir 对只读目录可能成功，写文件才能确认真实可写性
    const probe = path.join(dir, '.write-probe')
    await fs.writeFile(probe, 'ok', 'utf-8')
    await fs.unlink(probe).catch(() => {})
    return dir
  } catch {
    if (!storageFallbackDir) {
      storageFallbackDir = path.join(app.getPath('userData'), 'resumes')
      await fs.mkdir(storageFallbackDir, { recursive: true })
      // 界面提示（一次性）：有可见窗口才弹 dialog（沙箱/无窗口环境 dialog 可能挂起 → 降级 console.warn）
      const visible = BrowserWindow.getAllWindows().find((w) => w.isVisible())
      if (visible) {
        void dialog
          .showMessageBox(visible, {
            type: 'warning',
            title: '存储目录不可写',
            message: '首选存储目录不可写，本次会话已临时切换到备用目录。',
            detail: `原目录：${dir}\n备用目录：${storageFallbackDir}\n\n恢复可写后会自动回到原位置。可在「设置」中修改存储位置。`,
            buttons: ['知道了']
          })
          .catch(() => {})
      } else {
        console.warn(
          `[resume-store] 存储目录不可写，会话级兜底 userData/resumes\n原目录：${dir}\n备用目录：${storageFallbackDir}`
        )
      }
    }
    return storageFallbackDir
  }
}

export function ensureStorageDir(): Promise<string> {
  if (!storageProbe) storageProbe = doEnsureStorageDir()
  return storageProbe
}

export function resumeFilePath(id: string): string {
  return path.join(getStorageDir(), `${id}.json`)
}

function assertUuid(id: string): void {
  if (!UUID_RE.test(id)) throw new Error(`invalid resume id: ${id}`)
}

function nowIso(): string {
  return new Date().toISOString()
}

/* ── 数据安全三件套（原子写）───────────────────────────────────────────── */

async function rotateBackup(id: string): Promise<void> {
  const file = resumeFilePath(id)
  try {
    const data = await fs.readFile(file)
    const bak = `${file}.bak.${Date.now()}` // <dir>/<uuid>.json.bak.<ts>
    await fs.writeFile(bak, data)
    // 轮转：保留最近 N=5（P2 修复：备份文件以 "<uuid>.json.bak." 为前缀，
    // 原按 `${id}.bak.` 匹配永远命中不了 → 备份无限累积）
    const dir = getStorageDir()
    const files = (await fs.readdir(dir)).filter((f) => f.startsWith(`${id}.json.bak.`)).sort()
    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift()
      if (oldest) await fs.unlink(path.join(dir, oldest)).catch(() => {})
    }
  } catch {
    // 无现存正式文件（首次保存）→ 跳过备份
  }
}

/**
 * 原子写（三件套核心）：
 * 1. 写 <id>.json.tmp（锁，写入中标记）
 * 2. （可选）备份当前正式文件 → .bak 轮转
 * 3. rename .tmp → 正式文件（原子替换）
 * 任一步失败 → .tmp 残留 = 下次启动崩溃恢复信号（try/finally 保证窗口最短）
 * 2026-08-07 二次评估采纳：per-id 串行化（withWriteLock）+ EPERM/EBUSY 退避重试（withRetry）。
 */
async function atomicWrite(id: string, data: Resume, opts: { backup?: boolean } = {}): Promise<void> {
  return await withWriteLock(id, async () => {
    await ensureStorageDir()
    const file = resumeFilePath(id)
    const tmp = `${file}.tmp`
    const json = JSON.stringify(data, null, 2)
    try {
      await withRetry(() => fs.writeFile(tmp, json, 'utf-8'))
      if (opts.backup !== false) await withRetry(() => rotateBackup(id))
      await withRetry(() => fs.rename(tmp, file))
    } finally {
      // 成功后清理 .tmp；失败时保留（崩溃恢复信号）
      await fs.unlink(tmp).catch(() => {})
    }
  })
}

/* ── 生命周期 ──────────────────────────────────────────────────────────── */

/**
 * 保存：Zod 校验 → 刷新 meta.updatedAt/补 createdAt → 完整三件套。
 * id 由调用方显式传入（渲染进程 newResume 时生成；ResumeSchema 顶层无 id，id = 文件名）。
 */
export async function saveResume(id: string, resume: Resume): Promise<Resume> {
  assertUuid(id)
  const validated = ResumeSchema.parse(resume)
  const meta = {
    ...validated.meta,
    updatedAt: nowIso(),
    createdAt: validated.meta?.createdAt ?? nowIso()
  }
  const withMeta = { ...validated, meta }
  await atomicWrite(id, withMeta, { backup: true })
  return withMeta
}

/** 打开：读文件 → migrate → 校验 → 刷新 lastOpenedAt（轻量写，不触发 .bak；写失败降级不影响读取） */
export async function openResume(id: string): Promise<Resume> {
  assertUuid(id)
  const file = resumeFilePath(id)
  const raw = JSON.parse(await fs.readFile(file, 'utf-8')) as unknown
  const resume = migrate(raw)
  const meta = { ...resume.meta, lastOpenedAt: nowIso(), createdAt: resume.meta?.createdAt ?? nowIso() }
  const updated = { ...resume, meta }
  try {
    await atomicWrite(id, updated, { backup: false })
    return updated
  } catch (err) {
    // 2026-08-07 鲁棒性修复（二次评估采纳）：lastOpenedAt 刷新失败不阻塞读取，
    // 且必须返回【原始对象】而非带新时间戳的内存对象——否则磁盘未更新而内存已更新，
    // 重启后 recentResumes 按磁盘 meta 排序与本次会话不一致（时间戳漂移）。
    console.warn(`[resume-store] openResume: lastOpenedAt 刷新失败，降级返回原始对象 id=${id}`, err)
    return resume
  }
}

/** 重命名（T3）：仅改简历文件标题 resume.title，文件不变（原子写回，走三件套）；basics.name（姓名）不受影响 */
export async function renameResume(id: string, name: string): Promise<Resume> {
  const resume = await openResume(id)
  const updated = { ...resume, title: name }
  await atomicWrite(id, updated, { backup: true })
  return updated
}

/** 复制：深拷贝赋新 uuid + 重置 meta → 写 <newId>.json，返回新 id + 简历 */
export async function duplicateResume(id: string): Promise<{ id: string; resume: Resume }> {
  assertUuid(id)
  const resume = await openResume(id)
  const newId = crypto.randomUUID()
  const now = nowIso()
  const copy = migrate(
    structuredClone({
      ...resume,
      meta: { createdAt: now, updatedAt: now, lastOpenedAt: now }
    })
  )
  await atomicWrite(newId, copy, { backup: false })
  return { id: newId, resume: copy }
}

/** 删除：unlink + 同步删 .bak 序列（P2 修复：走 per-id 写锁，防与在途自动保存竞态——
 *  unlink 后 save 的 rename 会让已删简历"复活"；同时清理 .tmp 与 readdir 防护） */
export async function deleteResume(id: string): Promise<boolean> {
  assertUuid(id)
  const dir = getStorageDir()
  await withWriteLock(id, async () => {
    await fs.unlink(resumeFilePath(id)).catch(() => {})
    await fs.unlink(`${resumeFilePath(id)}.tmp`).catch(() => {})
    let files: string[] = []
    try {
      files = await fs.readdir(dir)
    } catch {
      /* 目录不可读：跳过 .bak 清理 */
    }
    for (const f of files.filter((x) => x.startsWith(`${id}.json.bak.`))) {
      await fs.unlink(path.join(dir, f)).catch(() => {})
    }
  })
  return true
}

/* ── F19 岗位绑定（R 批 WP-R1 · 数据层 M1 冻结契约，M3 实现）───────────── */

/** 绑定岗位：boundJobIds 追加去重（复用 saveResume 三件套写入链） */
export async function bindJob(resumeId: string, jobId: string): Promise<Resume> {
  assertUuid(resumeId)
  assertUuid(jobId)
  const resume = await openResume(resumeId)
  if (resume.boundJobIds.includes(jobId)) return resume
  return saveResume(resumeId, { ...resume, boundJobIds: [...resume.boundJobIds, jobId] })
}

/** 解绑岗位：从 boundJobIds 移除（软引用，不级联删岗位） */
export async function unbindJob(resumeId: string, jobId: string): Promise<Resume> {
  assertUuid(resumeId)
  assertUuid(jobId)
  const resume = await openResume(resumeId)
  if (!resume.boundJobIds.includes(jobId)) return resume
  return saveResume(resumeId, { ...resume, boundJobIds: resume.boundJobIds.filter((j) => j !== jobId) })
}

/* ── 聚合：list / recent（WP-T1）───────────────────────────────────────── */

async function scanResumeFiles(): Promise<Array<{ id: string; resume: Resume; mtime: number }>> {
  const dir = getStorageDir()
  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  const out: Array<{ id: string; resume: Resume; mtime: number }> = []
  for (const f of files) {
    if (!f.endsWith('.json') || f.includes('.bak.') || f.endsWith('.tmp')) continue
    const id = f.slice(0, -5)
    if (!UUID_RE.test(id)) continue
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')) as unknown
      const resume = migrate(raw)
      const stat = await fs.stat(path.join(dir, f))
      out.push({ id, resume, mtime: stat.mtimeMs })
    } catch {
      // 单份损坏不影响整体列表
    }
  }
  return out
}

export async function listResumes(): Promise<ResumeSummary[]> {
  const items = await scanResumeFiles()
  return items.map(({ id, resume }) => ({
    id,
    name: resume.title || resume.basics?.name || id, // T3：列表显示简历标题，空则回落姓名
    updatedAt: resume.meta?.updatedAt,
    boundJobIds: resume.boundJobIds ?? []
  }))
}

export async function recentResumes(): Promise<RecentResume[]> {
  const items = await scanResumeFiles()
  return items
    .map(({ id, resume, mtime }) => {
      const { createdAt, updatedAt, lastOpenedAt } = resume.meta ?? {}
      const ts = [updatedAt, lastOpenedAt, createdAt].filter(Boolean) as string[]
      const lastActivityAt = ts.length > 0 ? ts.sort().at(-1)! : new Date(mtime).toISOString()
      return {
        id,
        name: resume.title || resume.basics?.name || id, // T3：最近列表显示简历标题，空则回落姓名
        lastActivityAt,
        lastEditedAt: updatedAt,
        lastOpenedAt
      }
    })
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
}

/* ── 崩溃恢复（三件套 a）───────────────────────────────────────────────── */

/** 扫描残留 .tmp（上次未正常退出信号）→ 受影响简历 id 列表 */
export async function scanPendingRecovery(): Promise<string[]> {
  const dir = getStorageDir()
  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    return []
  }
  return extractPendingIds(files)
}

/** 用 .tmp 内容覆盖正式文件（用户确认恢复后调用） */
export async function recoverPending(id: string): Promise<Resume | null> {
  assertUuid(id)
  const tmp = `${resumeFilePath(id)}.tmp`
  try {
    const raw = JSON.parse(await fs.readFile(tmp, 'utf-8')) as unknown
    const resume = migrate(raw)
    await atomicWrite(id, resume)
    return resume
  } catch {
    return null
  }
}

/* ── 备份导出 / 导入（三件套 c，F19 扩展含 jobs/）──────────────────────── */

/** 导出全部数据为 zip（resumes/ + jobs/ + settings JSON；不含 logs / API Key） */
export async function exportBackup(win: BrowserWindow): Promise<string | null> {
  const dir = getStorageDir()
  const entries: ZipEntry[] = []

  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    /* 空目录 */
  }
  for (const f of files) {
    if (f.endsWith('.tmp')) continue
    const data = await fs.readFile(path.join(dir, f)).catch(() => null)
    if (data) entries.push({ name: `resumes/${f}`, data })
  }

  // jobs/（F19 数据层，P2 修复：导出实现补上注释承诺的 jobs 目录——
  // 目录不存在（F19 v1.1 未落码）时跳过，不阻塞）
  const jobsDir = path.join(app.getPath('userData'), 'jobs')
  let jobFiles: string[] = []
  try {
    jobFiles = await fs.readdir(jobsDir)
  } catch {
    /* jobs 目录不存在 */
  }
  for (const f of jobFiles) {
    const data = await fs.readFile(path.join(jobsDir, f)).catch(() => null)
    if (data) entries.push({ name: `jobs/${f}`, data })
  }

  // settings（electron-store 配置 JSON，无 Key 明文——Key 走 safeStorage 不在此文件）
  const settingsFile = store.path
  try {
    const data = await fs.readFile(settingsFile)
    entries.push({ name: 'settings/config.json', data })
  } catch {
    /* settings 缺失不阻塞 */
  }

  const buf = createZip(entries)
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export backup',
    defaultPath: `xiaomengresume-backup-${stamp}.zip`
  })
  if (canceled || !filePath) return null
  await fs.writeFile(filePath, buf)
  return filePath
}

/**
 * 导入备份 zip：解包 → 覆盖写回 resumes/ + 合并非敏感 settings（导入前先打一份 .bak 防误操作）。
 * settings 仅合并白名单非敏感键（用户拍板 B）：
 *  - 跳过 providers（API Key 敏感 + safeStorage 机器绑定，跨机迁移必然失效）
 *  - 跳过 storage.folderPath（导入会导致简历存储目录漂移，与已还原的 resumes/ 不一致）
 *  - 跳过 importedFonts（自定义字体列表，跨机本地路径失效）
 *  jobs/ 条目随 F19 数据层落码（M3）接入：uuid 白名单 + JobSchema 校验，损坏跳过。
 */
export async function importBackup(win: BrowserWindow): Promise<number> {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import backup',
    filters: [{ name: 'zip', extensions: ['zip'] }],
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) return 0
  const buf = await fs.readFile(filePaths[0])
  const entries = extractZip(buf)
  let count = 0
  let skipped = 0
  for (const e of entries) {
    // settings/config.json：仅合并非敏感白名单键（P2，用户拍板 B）
    if (e.name === 'settings/config.json') {
      try {
        const imported = JSON.parse(e.data.toString('utf-8')) as Record<string, unknown>
        let merged = 0
        for (const key of SETTINGS_SAFE_KEYS) {
          const v = imported[key]
          if (v !== undefined && v !== null) {
            store.set(key, v)
            merged++
          }
        }
        console.log(`[ImportBackup] settings: merged ${merged}/${SETTINGS_SAFE_KEYS.length} safe keys (providers/storage/importedFonts skipped)`)
      } catch {
        skipped++
      }
      continue
    }
    // jobs/<uuid>.json：F19 岗位恢复（M3 接入；JobSchema 校验 + uuid 白名单，损坏跳过）
    if (e.name.startsWith('jobs/')) {
      const jobRel = e.name.replace(/^jobs\//, '')
      if (!jobRel.endsWith('.json') || jobRel.includes('/')) continue
      if (!UUID_RE.test(jobRel.slice(0, -5))) continue
      try {
        const job = JobSchema.parse(JSON.parse(e.data.toString('utf-8')))
        const jobsDir = path.join(app.getPath('userData'), 'jobs')
        await fs.mkdir(jobsDir, { recursive: true })
        await fs.writeFile(path.join(jobsDir, `${job.id}.json`), JSON.stringify(job, null, 2))
        count++
      } catch {
        skipped++
      }
      continue
    }
    const rel = e.name.replace(/^resumes\//, '')
    if (!rel.endsWith('.json') || rel.includes('/')) continue
    if (e.name.startsWith('resumes/')) {
      // 2026-08-08 低危加固：仅接受 <uuid>.json，防恶意 zip 把任意文件名写入存储目录
      if (!UUID_RE.test(rel.slice(0, -5))) continue
      // P1 修复（2026-08-08）：单条损坏（JSON 解析失败/版本不合法）跳过而非中断整批——
      // 原实现 JSON.parse/migrate 无 try/catch，一条损坏 reject 整批且前面已写盘（半导入不一致）
      let resume: Resume
      try {
        const raw = JSON.parse(e.data.toString('utf-8')) as unknown
        resume = migrate(raw) // 版本化校验，损坏条目跳过
      } catch {
        skipped++
        continue
      }
      const file = path.join(getStorageDir(), path.basename(rel))
      const bak = `${file}.bak.${Date.now()}` // 导入前备份防误操作
      await fs.writeFile(bak, await fs.readFile(file).catch(() => Buffer.alloc(0)))
      await fs.writeFile(file, JSON.stringify(resume, null, 2))
      count++
    }
  }
  if (skipped > 0) {
    // 部分跳过不静默：写入日志（IPC 契约扩展留待 v1.1，至少主进程可观测）
    console.warn(`[ImportBackup] skipped ${skipped} corrupted entries, imported ${count}`)
  }
  return count
}
