/**
 * web-electronapi-mock —— 纯浏览器开发模式的 electronAPI 实现（dev 专用，不进桌面构建）
 *
 * 用途：Linux / 无 Electron 环境（vite.web.config.ts + web.html 入口）下仅渲染 Web 端。
 * 数据面：localStorage（键前缀 xmweb.v1.*），与桌面端 userData 完全隔离、互不污染。
 * 诚实降级原则（与桌面契约一致，不造假成功）：
 * - 纯渲染层可完成的（简历 CRUD / 岗位目录 / 设置 / JSON 导出）→ 真实工作；
 * - 依赖主进程能力的（PDF/图片导出、打印管线、文件对话框导入、AI BYOK、备份 zip）→
 *   返回契约内的失败形态（AiError 结构化错误 / ExportRunResult.error），UI 走既有错误提示。
 *
 * 类型对齐：satisfies ElectronAPI（类型自 preload 唯一事实源 type-only 导入，运行时零依赖 electron）。
 * 命名派生对齐主进程 resume-store：name = resume.title || resume.basics?.name || id（T3）。
 */
import { SettingsSchema } from '@shared/schema/settings'
import { migrate, type Resume } from '@shared/schema/resume'
import type { Job } from '@shared/schema/job'
import type { JobSummary, RecentResume, ResumeSummary } from '@shared/ipc-channels'
import sample from '../../../shared/sample-resume.json'
import type { ElectronAPI } from '../../../preload/index'

const PREFIX = 'xmweb.v1.'
const RESUME_KEY = (id: string): string => `${PREFIX}resume.${id}`
const JOB_KEY = (id: string): string => `${PREFIX}job.${id}`
const SETTINGS_KEY = `${PREFIX}settings`
const RESUME_PREFIX = `${PREFIX}resume.`
const JOB_PREFIX = `${PREFIX}job.`

/** localStorage 内单份简历落盘记录（对齐主进程 resume-store 维护的时间戳语义） */
interface ResumeRecord {
  resume: Resume
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
}

const nowIso = (): string => new Date().toISOString()
const newId = (): string => crypto.randomUUID()

function readRecord(id: string): ResumeRecord | null {
  const raw = localStorage.getItem(RESUME_KEY(id))
  if (!raw) return null
  try {
    return JSON.parse(raw) as ResumeRecord
  } catch {
    return null
  }
}

function writeRecord(id: string, record: ResumeRecord): void {
  localStorage.setItem(RESUME_KEY(id), JSON.stringify(record))
}

function allResumeIds(): string[] {
  const ids: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(RESUME_PREFIX)) ids.push(key.slice(RESUME_PREFIX.length))
  }
  return ids
}

/** T3 命名派生：列表/最近显示简历标题，空则回落姓名，再回落 id */
const displayName = (resume: Resume, id: string): string =>
  resume.title || resume.basics?.name || id

/** 落盘前统一维护 meta 时间戳（对齐主进程：save 刷 updatedAt、open 刷 lastOpenedAt） */
function stampMeta(resume: Resume, record: ResumeRecord): Resume {
  return { ...resume, meta: { ...resume.meta, createdAt: record.createdAt, updatedAt: record.updatedAt } }
}

const AI_UNSUPPORTED = { code: 'NO_PROVIDER', message: 'AI requires the desktop app (BYOK config is desktop-only)' } as const

export function installWebElectronAPIMock(): void {
  if (window.electronAPI) return

  const electronAPI: ElectronAPI = {
    app: {
      ping: async () => ({ pong: true, at: Date.now() }),
      getInfo: async () => ({
        name: 'xiaomengresume-web',
        version: 'dev-browser',
        electron: '-',
        chrome: navigator.userAgent,
        node: '-'
      })
    },
    print: {
      pdf: () => Promise.reject(new Error('PDF printing requires the desktop app'))
    },
    export: {
      run: async (args) => {
        if (args.format !== 'json') {
          // PDF/图片导出走主进程打印管线，浏览器内不提供（不造假成功）
          return { canceled: false, error: 'PDF/image export requires the desktop app; use JSON export in browser' }
        }
        const id = args.resumeId
        if (!id) return { canceled: false, error: 'missing resumeId' }
        const record = readRecord(id)
        if (!record) return { canceled: false, error: 'missing resumeId' }
        // JSON 导出 = 浏览器下载（对齐主进程「导出为版本化 JSON 文件」语义）
        const blob = new Blob([JSON.stringify(record.resume, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${displayName(record.resume, id) || id}.json`
        a.click()
        URL.revokeObjectURL(url)
        return { canceled: false }
      },
      onProgress: () => () => {}
    },
    ai: {
      streamTest: async () => ({ ok: false, full: '' }),
      onStreamChunk: () => () => {},
      grammar: async () => ({ ok: false, error: { ...AI_UNSUPPORTED } }),
      intro: async () => ({ ok: false, error: { ...AI_UNSUPPORTED } }),
      introCancel: async () => false,
      onIntroChunk: () => () => {},
      polish: async () => ({ ok: false, error: { ...AI_UNSUPPORTED } }),
      polishCancel: async () => false,
      onPolishChunk: () => () => {},
      match: async () => ({ ok: false, error: { ...AI_UNSUPPORTED } }),
      config: {
        get: async () => ({ ok: false, error: { ...AI_UNSUPPORTED } }),
        save: async () => ({ ok: false, error: { code: 'UNSUPPORTED', message: 'AI config is desktop-only' } }),
        test: async () => ({ ok: false, error: { code: 'NO_API_KEY' } }),
        reset: async () => ({ ok: false, error: { code: 'UNSUPPORTED', message: 'AI config is desktop-only' } })
      }
    },
    jobs: {
      list: async () => {
        const out: JobSummary[] = []
        for (const id of allJobIds()) {
          const raw = localStorage.getItem(JOB_KEY(id))
          if (!raw) continue
          const job = JSON.parse(raw) as Job
          out.push({ id: job.id, name: job.name, appliedAt: job.appliedAt, status: job.status })
        }
        return out
      },
      get: async (id) => {
        const raw = localStorage.getItem(JOB_KEY(id))
        if (!raw) throw new Error(`job not found: ${id}`)
        return JSON.parse(raw) as Job
      },
      save: async (job) => {
        localStorage.setItem(JOB_KEY(job.id), JSON.stringify(job))
        return job
      },
      delete: async (id) => {
        localStorage.removeItem(JOB_KEY(id))
        return true
      }
    },
    resumes: {
      save: async (id, resume) => {
        const prev = readRecord(id)
        const record: ResumeRecord = {
          resume,
          createdAt: prev?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
          lastOpenedAt: prev?.lastOpenedAt
        }
        writeRecord(id, record)
        return stampMeta(resume, record)
      },
      saveNow: (id, resume) => {
        const prev = readRecord(id)
        writeRecord(id, {
          resume,
          createdAt: prev?.createdAt ?? nowIso(),
          updatedAt: nowIso(),
          lastOpenedAt: prev?.lastOpenedAt
        })
      },
      open: async (id) => {
        const record = readRecord(id)
        if (!record) throw new Error(`resume not found: ${id}`)
        record.lastOpenedAt = nowIso()
        writeRecord(id, record)
        return { ...record.resume, meta: { ...record.resume.meta, lastOpenedAt: record.lastOpenedAt } }
      },
      duplicate: async (id) => {
        const record = readRecord(id)
        if (!record) throw new Error(`resume not found: ${id}`)
        const newId_ = newId()
        const copy: Resume = {
          ...record.resume,
          title: `${record.resume.title || record.resume.basics?.name || id} (copy)`,
          meta: { createdAt: nowIso(), updatedAt: nowIso() }
        }
        writeRecord(newId_, { resume: copy, createdAt: nowIso(), updatedAt: nowIso() })
        return { id: newId_, resume: copy }
      },
      rename: async (id, name) => {
        const record = readRecord(id)
        if (!record) throw new Error(`resume not found: ${id}`)
        record.resume = { ...record.resume, title: name } // T3：仅改简历标题，basics.name 不动
        record.updatedAt = nowIso()
        writeRecord(id, record)
        return stampMeta(record.resume, record)
      },
      remove: async (id) => {
        localStorage.removeItem(RESUME_KEY(id))
        return true
      },
      list: async () => {
        const out: ResumeSummary[] = []
        for (const id of allResumeIds()) {
          const record = readRecord(id)
          if (!record) continue
          out.push({
            id,
            name: displayName(record.resume, id),
            updatedAt: record.updatedAt,
            boundJobIds: record.resume.boundJobIds ?? []
          })
        }
        return out
      },
      recent: async () => {
        const out: RecentResume[] = []
        for (const id of allResumeIds()) {
          const record = readRecord(id)
          if (!record) continue
          const lastActivityAt = [record.updatedAt, record.lastOpenedAt].sort().at(-1) ?? record.createdAt
          out.push({
            id,
            name: displayName(record.resume, id),
            lastActivityAt,
            lastEditedAt: record.updatedAt,
            lastOpenedAt: record.lastOpenedAt
          })
        }
        return out.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
      },
      scanRecovery: async () => [], // 浏览器模式无 .tmp 崩溃恢复面
      recover: async () => null,
      createSample: async () => {
        const id = newId()
        const resume = migrate(sample) // 与主进程 createSample 同源同迁移（shared/sample-resume.json）
        writeRecord(id, { resume, createdAt: nowIso(), updatedAt: nowIso() })
        return { id, resume }
      },
      readPhoto: async () => null, // B1：浏览器模式 photo 一律 data: 内嵌，无路径引用
      bindJob: async (resumeId, jobId) => {
        const record = readRecord(resumeId)
        if (!record) throw new Error(`resume not found: ${resumeId}`)
        const ids = new Set(record.resume.boundJobIds ?? [])
        ids.add(jobId)
        record.resume = { ...record.resume, boundJobIds: [...ids] }
        record.updatedAt = nowIso()
        writeRecord(resumeId, record)
        return record.resume
      },
      unbindJob: async (resumeId, jobId) => {
        const record = readRecord(resumeId)
        if (!record) throw new Error(`resume not found: ${resumeId}`)
        record.resume = {
          ...record.resume,
          boundJobIds: (record.resume.boundJobIds ?? []).filter((j) => j !== jobId)
        }
        record.updatedAt = nowIso()
        writeRecord(resumeId, record)
        return record.resume
      },
      listBackups: async () => [], // 浏览器模式无 .bak 版本时间线
      recoverBackup: async () => {
        throw new Error('backup recovery requires the desktop app')
      }
    },
    backup: {
      exportZip: async () => null,
      importZip: async () => 0
    },
    storage: {
      choose: async () => null,
      get: async () => ({
        defaultPath: 'browser localStorage',
        currentPath: 'browser localStorage',
        exists: true
      }),
      set: async () => ({
        ok: false,
        error: 'storage folder is fixed to browser localStorage in web mode'
      }),
      reset: async () => 'browser localStorage',
      open: async () => {}
    },
    import: {
      run: async () => ({ ok: false, error: { code: 'UNSUPPORTED', message: 'import requires the desktop app' } }),
      runBatch: async () => ({ ok: false, error: { code: 'UNSUPPORTED', message: 'import requires the desktop app' } }),
      onProgress: () => () => {}
    },
    window: {
      minimize: () => {},
      maximizeToggle: () => {},
      close: () => {},
      onMaximized: () => () => {},
      onBeforeHide: () => () => {}
    },
    settings: {
      get: async () => {
        const raw = localStorage.getItem(SETTINGS_KEY)
        return SettingsSchema.parse(raw ? JSON.parse(raw) : {})
      },
      set: async (patch) => {
        const raw = localStorage.getItem(SETTINGS_KEY)
        const current = raw ? JSON.parse(raw) : {}
        const next = SettingsSchema.parse({ ...current, ...patch })
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
        return next
      }
    },
    font: {
      import: async () => null,
      remove: async () => {}
    },
    logs: {
      export: async () => null
    }
  }

  window.electronAPI = electronAPI
}

function allJobIds(): string[] {
  const ids: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(JOB_PREFIX)) ids.push(key.slice(JOB_PREFIX.length))
  }
  return ids
}
