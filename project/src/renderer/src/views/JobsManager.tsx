/**
 * JobsManager —— 岗位管理（2026-08-09 T8 四大入口重构：从「简历与岗位目录」拆分）
 * 列表：名称 / 投递时间 / 状态（在投·已过·已拒）/ 已绑定简历标记；新建/编辑走居中央 Dialog 模态框
 * （岗位名称 / 投递时间 / 状态 / 绑定简历 / 岗位要求）；支持单个删除与多选批量删除。
 * 绑定简历 = 更新对应 resume.boundJobIds（加/减岗位 id），AI 润色/匹配基于所选岗位的绑定简历。
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { Button, Dialog, EmptyState } from '../components/ui'
import type { JobSummary, ResumeSummary } from '@shared/ipc-channels'
import type { Job } from '@shared/schema/job'

type JobStatus = 'notApplied' | 'applying' | 'passed' | 'rejected'

const STATUS_KEYS: Record<JobStatus, string> = {
  notApplied: 'jobsManager.statusNotApplied',
  applying: 'jobsManager.statusApplying',
  passed: 'jobsManager.statusPassed',
  rejected: 'jobsManager.statusRejected'
}

export function JobsManager(): React.JSX.Element {
  const { t } = useTranslation()
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  // 2026-08-09 T2：选择模式（批量删除）——checkbox 仅在选择模式显示（对齐简历管理交互）
  const [selectMode, setSelectMode] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)
  const [boundIds, setBoundIds] = useState<Set<string>>(new Set()) // 模态框内绑定简历选择
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    try {
      const [j, r] = await Promise.all([window.electronAPI.jobs.list(), window.electronAPI.resumes.list()])
      setJobs(j)
      setResumes(r)
    } catch {
      /* 保持空态 */
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  /** 更新一批简历的绑定岗位集合（boundJobIds 增/减该岗位） */
  const syncBindings = async (jobId: string, targetIds: string[]): Promise<void> => {
    for (const r of resumes) {
      const wasBound = (r.boundJobIds ?? []).includes(jobId)
      const shouldBind = targetIds.includes(r.id)
      if (wasBound === shouldBind) continue
      const resume = await window.electronAPI.resumes.open(r.id)
      const list = resume.boundJobIds ?? []
      const next = shouldBind ? [...new Set([...list, jobId])] : list.filter((id) => id !== jobId)
      await window.electronAPI.resumes.save(r.id, { ...resume, boundJobIds: next })
    }
  }

  const openEdit = async (job: JobSummary): Promise<void> => {
    const full = await window.electronAPI.jobs.get(job.id)
    setEditing(full)
    setBoundIds(new Set(resumes.filter((r) => (r.boundJobIds ?? []).includes(job.id)).map((r) => r.id)))
  }

  const startNew = (): void => {
    setEditing({ id: crypto.randomUUID(), name: '', appliedAt: '', status: 'notApplied', requirements: '', createdAt: '', updatedAt: '' })
    setBoundIds(new Set())
  }

  const save = async (): Promise<void> => {
    if (!editing) return
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const payload = {
        ...editing,
        name: editing.name.trim() || t('jobsManager.untitled'),
        updatedAt: now,
        createdAt: editing.createdAt || now
      }
      await window.electronAPI.jobs.save(payload)
      await syncBindings(payload.id, [...boundIds])
      setEditing(null)
      void reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (ids: string[]): Promise<void> => {
    const label = ids.length === 1
      ? t('resumesJobs.confirmDeleteOne', { name: jobs.find((j) => j.id === ids[0])?.name ?? '' })
      : t('resumesJobs.confirmDelete', { count: ids.length })
    if (!window.confirm(label)) return
    setBusy(true)
    try {
      await Promise.all(ids.map((id) => window.electronAPI.jobs.delete(id)))
      setSel(new Set())
      void reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => setCurrentView('resumes-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-sm font-semibold text-foreground">{t('navSub.jobs')}</h2>
        <div className="ml-auto flex items-center gap-2">
          {selectMode ? (
            <>
              {sel.size > 0 ? (
                <Button size="sm" variant="danger" disabled={busy} onClick={() => void remove([...sel])}>
                  {t('resumesJobs.bulkDelete')}（{sel.size}）
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectMode(false)
                  setSel(new Set())
                }}
              >
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
              {t('resumesJobs.bulkDelete')}
            </Button>
          )}
          <Button size="sm" variant="default" onClick={startNew}>
            ＋ {t('jobsManager.new')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ maxWidth: 'var(--ui-list-max-width)', margin: '0 auto', width: '100%' }}>
        {jobs.length === 0 ? (
          <EmptyState title={t('resumesJobs.emptyJobs')} action={{ label: `＋ ${t('jobsManager.new')}`, onClick: startNew }} />
        ) : (
          <div className="flex flex-col" style={{ gap: 'var(--ui-list-gap)' }}>
            {selectMode && jobs.length > 0 ? (
              <label className="mb-1 flex cursor-pointer items-center gap-2 px-1 text-xs text-foreground/70">
                <input
                  type="checkbox"
                  className="accent-foreground"
                  checked={sel.size === jobs.length}
                  onChange={() => setSel((s) => (s.size === jobs.length ? new Set() : new Set(jobs.map((j) => j.id))))}
                />
                {t('resumesJobs.selectAll')}
              </label>
            ) : null}
            {jobs.map((j) => {
              const bound = resumes.filter((r) => (r.boundJobIds ?? []).includes(j.id))
              return (
                <div key={j.id} className="group resume-list-item min-w-0 gap-3">
                  {selectMode ? (
                    <input
                      type="checkbox"
                      className="shrink-0 accent-foreground"
                      checked={sel.has(j.id)}
                      onChange={() => setSel((s) => toggle(s, j.id))}
                      aria-label={j.name}
                    />
                  ) : null}
                  {/* 左主信息：岗位名 + 绑定简历徽章（对齐简历卡「名称左」） */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="resume-list-name truncate text-sm text-foreground">{j.name}</span>
                    {bound.length > 0 ? (
                      <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-[10px] text-success" title={bound.map((r) => r.name).join('、')}>
                        {t('jobsManager.bound')} · {bound.map((r) => r.name).join('、')}
                      </span>
                    ) : null}
                  </div>
                  {/* 右元信息：投递时间 + 状态徽章（对齐简历卡「meta 右」两端分布） */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="whitespace-nowrap text-[11px] text-foreground/50">{j.appliedAt || '—'}</span>
                    <span className={`whitespace-nowrap rounded-full px-1.5 py-px text-[11px] ${j.status === 'rejected' ? 'bg-danger-bg text-danger' : j.status === 'passed' ? 'bg-success-bg text-success' : 'bg-border/60 text-foreground/70'}`}>
                      {t(STATUS_KEYS[(j.status as JobStatus) ?? 'notApplied'])}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" className="rounded px-2 py-1 text-[11px] text-foreground/60 hover:bg-border/40 hover:text-foreground" onClick={() => void openEdit(j)}>
                      {t('jobsManager.edit')}
                    </button>
                    <button type="button" className="rounded px-2 py-1 text-[11px] text-danger hover:bg-danger-bg" onClick={() => void remove([j.id])}>
                      {t('resumesJobs.delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 新建/编辑岗位模态框（居整个 UI 正中央） */}
      <Dialog open={editing !== null} title={editing?.id && !editing?.createdAt ? t('jobsManager.new') : t('jobsManager.edit')} onClose={() => setEditing(null)}>
        {editing ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t('job.name')}
              <input className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground/50" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-foreground/70">
                {t('job.appliedAt')}
                <input className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground/50" placeholder="YYYY-MM" value={editing.appliedAt ?? ''} onChange={(e) => setEditing({ ...editing, appliedAt: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-foreground/70">
                {t('jobsManager.status')}
                <select className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground/50" value={editing.status ?? 'notApplied'} onChange={(e) => setEditing({ ...editing, status: e.target.value as JobStatus })}>
                  <option value="notApplied">{t('jobsManager.statusNotApplied')}</option>
                  <option value="applying">{t('jobsManager.statusApplying')}</option>
                  <option value="passed">{t('jobsManager.statusPassed')}</option>
                  <option value="rejected">{t('jobsManager.statusRejected')}</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t('jobsManager.bindResume')}
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-surface p-2">
                {resumes.length === 0 ? (
                  <span className="px-1 py-1 text-xs text-foreground/45">{t('resumesJobs.emptyResumes')}</span>
                ) : (
                  resumes.map((r) => (
                    <label key={r.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-sm text-foreground/80">
                      <input type="checkbox" className="accent-foreground" checked={boundIds.has(r.id)} onChange={() => setBoundIds((s) => toggle(s, r.id))} />
                      <span className="truncate">{r.name}</span>
                    </label>
                  ))
                )}
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs text-foreground/70">
              {t('job.reqPlaceholder')}
              <textarea rows={3} className="resize-y rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-foreground/50" value={editing.requirements ?? ''} onChange={(e) => setEditing({ ...editing, requirements: e.target.value })} />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" variant="default" disabled={busy} onClick={() => void save()}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  )
}
