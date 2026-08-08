/**
 * AiMatch —— AI 屏匹配打分分区（F9：综合分 + 维度 + 建议；「去润色」跳转 F7）
 * 前置：所选简历已绑定岗位（jobId 非空）且岗位 requirements 非空；未满足入口禁用提示。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiContextBar } from '../components/ai/AiContextBar'
import type { AiError } from '@shared/ipc-channels'
import type { MatchScore } from '@shared/schema/match'

export function AiMatch(): React.JSX.Element {
  const { t } = useTranslation()
  const resumeId = useResumeStore((s) => s.aiContext.resumeId)
  const jobId = useResumeStore((s) => s.aiContext.jobId)
  const focusField = useResumeStore((s) => s.focusField)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  const [busy, setBusy] = useState(false)
  const [score, setScore] = useState<MatchScore | null>(null)
  const [error, setError] = useState<AiError | null>(null)

  const canRun = resumeId !== null && jobId !== null

  const run = async (): Promise<void> => {
    if (!resumeId || !jobId) return
    setBusy(true)
    setError(null)
    setScore(null)
    const res = await window.electronAPI.ai.match({ resumeId, jobId })
    setBusy(false)
    if (res.ok) setScore(res.data)
    else setError(res.error)
  }

  const goPolish = (field: string): void => {
    focusField(field)
    setCurrentView('editor')
  }

  return (
    <div className="flex h-full flex-col">
      <AiContextBar />
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2">
        <h2 className="text-sm font-semibold">{t('navSub.match')}</h2>
        <button
          type="button"
          className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
          disabled={busy || !canRun}
          onClick={() => void run()}
        >
          {busy ? t('ai.match.running') : t('ai.match.run')}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!resumeId ? (
          <p className="text-sm text-foreground/50">{t('ai.noResumeHint')}</p>
        ) : !jobId ? (
          <p className="text-sm text-foreground/50">{t('ai.matchDisabledHint')}</p>
        ) : error ? (
          <p className="text-sm text-red-500">{t('ai.error.' + error.code)}</p>
        ) : score ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
              <span className="text-4xl font-bold">{score.overall}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{t('ai.match.overall')}</span>
                <span className="text-xs text-foreground/50">/100</span>
              </div>
            </div>
            {score.dimensions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{t('ai.match.dimensions')}</h3>
                {score.dimensions.map((d, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{d.name}</span>
                      <span className="text-sm font-semibold">{d.score}</span>
                    </div>
                    {d.comment ? <p className="mt-1 text-xs text-foreground/60">{d.comment}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
            {score.suggestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{t('ai.match.suggestions')}</h3>
                {score.suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-foreground">{s.text}</p>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-foreground/70 hover:text-foreground"
                        onClick={() => goPolish(s.field)}
                      >
                        {t('ai.match.goPolish')} →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-foreground/50">{t('homeDesc.match')}</p>
        )}
      </div>
    </div>
  )
}
