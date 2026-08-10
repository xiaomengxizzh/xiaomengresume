/**
 * AiGrammar —— AI 屏语法检查分区（F8；双入口之一：AI 屏 = 全文检查诊断 + 定位）
 * 结果按字段分组列表（字段 + 原文片段 + 建议）；逐条「定位」→ focusField + 跳编辑器。
 * 偏差（登记 §2.4）：v1 全文检查不做批量替换与 Tiptap Mark 渲染（多字段编辑器实例协作
 * 复杂）；替换在编辑器内单字段检查（SectionCard「语法检查」）完成。
 * 2026-08-09 T4：改用 AiScreenLayout 共享外壳（图标/标题/操作区）+ 结果卡片化 + EmptyState。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiScreenLayout } from '../components/ai/AiScreenLayout'
import { Button, EmptyState } from '../components/ui'
import type { AiError } from '@shared/ipc-channels'
import type { GrammarIssue } from '@shared/schema/grammar'

interface IssueWithField extends GrammarIssue {
  field: string
}

export function AiGrammar(): React.JSX.Element {
  const { t } = useTranslation()
  const resumeId = useResumeStore((s) => s.aiContext.resumeId)
  const focusField = useResumeStore((s) => s.focusField)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState<IssueWithField[] | null>(null)
  const [error, setError] = useState<AiError | null>(null)

  const run = async (): Promise<void> => {
    if (!resumeId) return
    setBusy(true)
    setError(null)
    setIssues(null)
    const res = await window.electronAPI.ai.grammar({ resumeId, scope: 'full' })
    setBusy(false)
    if (res.ok) setIssues(res.data as IssueWithField[])
    else setError(res.error)
  }

  const locate = (field: string): void => {
    focusField(field)
    setCurrentView('editor')
  }

  return (
    <AiScreenLayout
      icon="grammar"
      backTo="ai-home"
      title={t('navSub.grammar')}
      actions={
        <>
          <Button size="sm" variant="default" disabled={busy || !resumeId} onClick={() => void run()}>
            {busy ? t('ai.grammar.running') : t('ai.grammar.run')}
          </Button>
          <span className="text-xs text-foreground/50">{t('ai.grammar.scopeFull')}</span>
        </>
      }
    >
      {!resumeId ? (
        <EmptyState title={t('ai.noResumeHint')} desc={t('ai.noResumeDesc')} />
      ) : error ? (
        <EmptyState error title={t('ai.error.' + error.code)} secondary={{ label: t('common.retry'), onClick: () => void run() }} />
      ) : issues === null ? (
        <EmptyState title={t('ai.grammar.idle')} desc={t('ai.grammar.idleDesc')} action={{ label: t('ai.grammar.run'), onClick: () => void run() }} />
      ) : issues.length === 0 ? (
        <EmptyState title={t('ai.grammar.noIssues')} />
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-foreground/50">{t('ai.grammar.issues', { count: issues.length })}</p>
          {issues.map((g, i) => (
            <div
              key={i}
              className="rounded-card border border-border bg-surface p-3 shadow-card-press transition-all hover:-translate-y-px hover:shadow-card-hover"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-foreground/50">{g.field || t('ai.grammar.scopeSelection')}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-foreground/60 transition-colors hover:text-foreground"
                  onClick={() => locate(g.field)}
                >
                  {t('common.open')} →
                </button>
              </div>
              <p className="text-sm text-foreground">{g.message}</p>
              {g.suggestion ? (
                <p className="mt-1 text-xs text-foreground/70">
                  {t('ai.grammar.replace')}：{g.suggestion}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </AiScreenLayout>
  )
}
