/**
 * AiContextBar —— AI 屏顶栏统一「当前简历 + 岗位」选择器（T 批 #22/T2）
 * 四分区共享：岗位选项 = 所选简历 boundJobIds 反查；未选简历时岗位禁用；
 * 切换简历时清空 jobId（防跨简历岗位错配）。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import type { ResumeSummary, JobSummary } from '@shared/ipc-channels'

export function AiContextBar(): React.JSX.Element {
  const { t } = useTranslation()
  const resumeId = useResumeStore((s) => s.aiContext.resumeId)
  const jobId = useResumeStore((s) => s.aiContext.jobId)
  const setAiContext = useResumeStore((s) => s.setAiContext)

  const [resumes, setResumes] = useState<ResumeSummary[]>([])
  const [jobs, setJobs] = useState<JobSummary[]>([])

  useEffect(() => {
    void window.electronAPI.resumes.list().then(setResumes).catch(() => {})
    void window.electronAPI.jobs.list().then(setJobs).catch(() => {})
  }, [])

  const boundJobIds = resumes.find((r) => r.id === resumeId)?.boundJobIds ?? []
  const jobOptions = jobs.filter((j) => boundJobIds.includes(j.id))
  const currentJob = jobs.find((j) => j.id === jobId)

  return (
    /* 2026-08-09 T7：选择器放大并相对导航右侧内容区居中（justify-center + select 加宽） */
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border/70 px-6 py-2.5 text-sm">
      <label className="shrink-0 text-xs text-foreground/60">{t('ai.context.resume')}</label>
      <select
        className="min-w-[180px] flex-1 max-w-[300px] rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none transition-colors focus:border-foreground/50"
        value={resumeId ?? ''}
        onChange={(e) => {
          const id = e.target.value
          setAiContext({ resumeId: id || null, jobId: null })
          // AI 屏与编辑器共享「当前简历」：选择后载入 store（纯数据，不切视图）
          if (id) {
            void window.electronAPI.resumes
              .open(id)
              .then((resume) => useResumeStore.getState().loadResume(id, resume))
              .catch(() => {})
          }
        }}
      >
        <option value="">{t('ai.context.noResume')}</option>
        {resumes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name || r.id.slice(0, 8)}
          </option>
        ))}
      </select>

      <label className="shrink-0 text-xs text-foreground/60">{t('ai.context.job')}</label>
      <select
        className="min-w-[180px] flex-1 max-w-[300px] rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none transition-colors focus:border-foreground/50 disabled:opacity-50"
        value={jobId ?? ''}
        disabled={!resumeId}
        onChange={(e) => setAiContext({ jobId: e.target.value || null })}
      >
        <option value="">
          {boundJobIds.length === 0 ? t('ai.context.noJob') : t('ai.context.noJob')}
        </option>
        {jobOptions.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
          </option>
        ))}
      </select>

      {currentJob ? <span className="shrink-0 text-xs text-foreground/50">{currentJob.name}</span> : null}
    </div>
  )
}
