/**
 * AiMatch —— AI 屏匹配打分分区（F9：综合分 + 维度 + 建议；「去润色」跳转 F7）
 * 前置：所选简历已绑定岗位（jobId 非空）且岗位 requirements 非空；未满足入口禁用提示。
 * 2026-08-09 T4：改用 AiScreenLayout 共享外壳 + 评分/维度/建议卡片化 + EmptyState。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiScreenLayout } from '../components/ai/AiScreenLayout'
import { Button, EmptyState } from '../components/ui'
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
    <AiScreenLayout
      icon="match"
      backTo="ai-home"
      title={t('navSub.match')}
      actions={
        <Button size="sm" variant="default" disabled={busy || !canRun} onClick={() => void run()}>
          {busy ? t('ai.match.running') : t('ai.match.run')}
        </Button>
      }
    >
      {!resumeId ? (
        <EmptyState title={t('ai.noResumeHint')} desc={t('ai.noResumeDesc')} />
      ) : !jobId ? (
        <EmptyState title={t('ai.matchDisabledHint')} desc={t('ai.context.noJob')} />
      ) : error ? (
        <EmptyState error title={t('ai.error.' + error.code)} secondary={{ label: t('common.retry'), onClick: () => void run() }} />
      ) : score ? (
        <div className="mx-auto flex max-w-[560px] flex-col gap-3">
          <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-card-press">
            <span className="text-4xl font-bold text-foreground">{score.overall}</span>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{t('ai.match.overall')}</span>
              <span className="text-xs text-foreground/50">/100</span>
            </div>
          </div>
          {score.dimensions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-foreground">{t('ai.match.dimensions')}</h3>
              {score.dimensions.map((d, i) => (
                <div key={i} className="rounded-card border border-border bg-surface p-3 shadow-card-press">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{d.name}</span>
                    <span className="text-sm font-semibold text-foreground">{d.score}</span>
                  </div>
                  {d.comment ? <p className="mt-1 text-xs leading-relaxed text-foreground/60">{d.comment}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {score.suggestions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-foreground">{t('ai.match.suggestions')}</h3>
              {score.suggestions.map((s, i) => (
                <div key={i} className="rounded-card border border-border bg-surface p-3 shadow-card-press transition-all hover:-translate-y-px hover:shadow-card-hover">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm leading-relaxed text-foreground">{s.text}</p>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => goPolish(s.field)}>
                      {t('ai.match.goPolish')} →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={t('navSub.match')}
          desc={t('homeDesc.match')}
          action={{ label: t('ai.match.run'), onClick: () => void run() }}
        />
      )}
    </AiScreenLayout>
  )
}
