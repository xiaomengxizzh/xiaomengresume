/**
 * AiGrammar —— AI 屏语法检查分区（F8；双入口之一：AI 屏 = 全文检查诊断 + 定位）
 * 结果按字段分组列表（字段 + 原文片段 + 建议）；逐条「定位」→ focusField + 跳编辑器。
 * 偏差（登记 §2.4）：v1 全文检查不做批量替换与 Tiptap Mark 渲染（多字段编辑器实例协作
 * 复杂）；替换在编辑器内单字段检查（SectionCard「语法检查」）完成。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiContextBar } from '../components/ai/AiContextBar'
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
    <div className="flex h-full flex-col">
      <AiContextBar />
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2">
        <h2 className="text-sm font-semibold">{t('navSub.grammar')}</h2>
        <button
          type="button"
          className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
          disabled={busy || !resumeId}
          onClick={() => void run()}
        >
          {busy ? t('ai.grammar.running') : t('ai.grammar.run')}
        </button>
        <span className="text-xs text-foreground/50">{t('ai.grammar.scopeFull')}</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!resumeId ? (
          <p className="text-sm text-foreground/50">{t('ai.noResumeHint')}</p>
        ) : error ? (
          <p className="text-sm text-red-500">{t('ai.error.' + error.code)}</p>
        ) : issues === null ? null : issues.length === 0 ? (
          <p className="text-sm text-foreground/50">{t('ai.grammar.noIssues')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-foreground/50">{t('ai.grammar.issues', { count: issues.length })}</p>
            {issues.map((g, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-foreground/50">{g.field || t('ai.grammar.scopeSelection')}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-foreground/60 hover:text-foreground"
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
      </div>
    </div>
  )
}
