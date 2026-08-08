/**
 * JobsHome —— 岗位目录管理屏（F19 UI 层，⑭ 定案 + T 批 #22 绑定简历反查）
 * 列表：名称 / 投递时间 / 绑定简历（resumes:list 反查 boundJobIds，可点跳转打开简历）；
 * 新建/编辑：name / appliedAt（DateStr）/ requirements（供 AI 润色与匹配打分）。
 * rename/duplicate 由 get→改→save 组合（IPC 仅冻结 list/get/save/delete）。
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { createEmptyJob, type Job } from '@shared/schema/job'
import type { JobSummary, ResumeSummary } from '@shared/ipc-channels'

export function JobsHome(): React.JSX.Element {
  const { t } = useTranslation()
  const loadResumeIntoEditor = useResumeStore((s) => s.loadResumeIntoEditor)

  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [editing, setEditing] = useState<Job | null>(null)
  const [draft, setDraft] = useState<Job>(() => createEmptyJob())
  const [err, setErr] = useState<string | null>(null)

  const reload = useCallback(() => {
    void window.electronAPI.jobs
      .list()
      .then(setJobs)
      .catch(() => {})
    void window.electronAPI.resumes
      .list()
      .then(setResumes)
      .catch(() => {})
  }, [])

  useEffect(reload, [reload])

  const startNew = (): void => {
    setDraft(createEmptyJob())
    setErr(null)
    setEditing(createEmptyJob()) // 非 null 且 id 新生成 → 新建模式
  }

  const startEdit = async (id: string): Promise<void> => {
    const job = await window.electronAPI.jobs.get(id)
    setDraft(job)
    setEditing(job)
  }

  const save = async (): Promise<void> => {
    if (!draft.name.trim()) {
      setErr('name required')
      return
    }
    const res = await window.electronAPI.jobs.save({ ...draft, name: draft.name.trim() })
    setEditing(null)
    reload()
    void res
  }

  const remove = async (job: JobSummary): Promise<void> => {
    if (!window.confirm(t('job.deleteConfirm', { name: job.name }))) return
    await window.electronAPI.jobs.delete(job.id)
    reload()
  }

  const openBound = async (resumeId: string): Promise<void> => {
    const resume = await window.electronAPI.resumes.open(resumeId)
    loadResumeIntoEditor(resumeId, resume)
  }

  const boundNames = (jobId: string): Array<{ id: string; name: string }> =>
    resumes.filter((r) => r.boundJobIds.includes(jobId)).map((r) => ({ id: r.id, name: r.name || r.id.slice(0, 8) }))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2">
        <h2 className="text-sm font-semibold">{t('job.title')}</h2>
        <button
          type="button"
          className="rounded bg-foreground px-2 py-0.5 text-xs text-surface"
          onClick={startNew}
        >
          + {t('job.newJob')}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3">
          <input
            className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
            placeholder={t('job.name')}
            value={draft.name}
            autoFocus
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
            placeholder={`${t('job.appliedAt')}（YYYY-MM）`}
            value={draft.appliedAt}
            onChange={(e) => setDraft({ ...draft, appliedAt: e.target.value })}
          />
          <textarea
            className="min-h-28 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
            placeholder={t('job.reqPlaceholder')}
            value={draft.requirements}
            onChange={(e) => setDraft({ ...draft, requirements: e.target.value })}
          />
          {err ? <span className="text-xs text-red-500">{err}</span> : null}
          <div className="flex gap-2">
            <button type="button" className="rounded bg-foreground px-2 py-0.5 text-xs text-surface" onClick={() => void save()}>
              {t('common.save')}
            </button>
            <button type="button" className="text-xs text-foreground/60 hover:text-foreground" onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {jobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground/50">{t('job.empty')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {jobs.map((job) => {
              const bound = boundNames(job.id)
              return (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{job.name}</span>
                      {job.appliedAt ? <span className="text-xs text-foreground/50">{job.appliedAt}</span> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-foreground/50">
                      <span>{t('job.boundResumes')}：</span>
                      {bound.length === 0 ? (
                        <span>{t('job.noBound')}</span>
                      ) : (
                        bound.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            className="text-foreground/70 underline-offset-2 hover:text-foreground hover:underline"
                            onClick={() => void openBound(b.id)}
                          >
                            {b.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className="text-xs text-foreground/60 hover:text-foreground" onClick={() => void startEdit(job.id)}>
                      {t('job.editJob')}
                    </button>
                    <button type="button" className="text-xs text-foreground/60 hover:text-red-500" onClick={() => void remove(job)}>
                      {t('job.deleteJob')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
