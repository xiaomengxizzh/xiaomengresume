/**
 * AiAssistPanel —— 编辑器内 AI 辅助面板（F7 润色 / F8 语法，Q6/Q9 拍板）
 * polish：useAiStream 流式 → 取消/刷新/应用；选区冻结校验（range 失效提示重选）或整字段替换（入撤销栈）。
 * grammar：ai.grammar 非流式 → 逐条替换/忽略；替换后立即重查（防残留偏移失效条目）。
 * 偏差（登记 §2.4）：v1 不做 Tiptap grammar-error Mark 高亮（偏移映射与多实例协作复杂，列表交互等效）。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { useAiStream } from '../../hooks/useAiStream'
import type { Editor } from '@tiptap/react'
import type { GrammarIssue } from '@shared/schema/grammar'
import type { RichText } from '@shared/schema/resume'

function textToRichText(text: string): RichText {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

export interface AiAssistPanelProps {
  kind: 'polish' | 'grammar'
  resumeId: string
  jobId?: string | null
  /** 方括号路径（summary.content / work[0].summary） */
  field: string
  editor: Editor | null
  /** 选区冻结（点按钮时有选区）；null = 整字段 */
  frozen: { from: number; to: number; text: string } | null
  onClose: () => void
}

export function AiAssistPanel({
  kind,
  resumeId,
  jobId,
  field,
  editor,
  frozen,
  onClose
}: AiAssistPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  const setField = useResumeStore((s) => s.setField)
  const [localErr, setLocalErr] = useState<string | null>(null)

  // ── 润色（流式）──────────────────────────────────────────────────────
  const polish = useAiStream({
    start: (requestId) =>
      window.electronAPI.ai.polish({
        requestId,
        resumeId,
        field,
        text: frozen?.text ?? editor?.getText() ?? '',
        ...(jobId ? { jobId } : {})
      }),
    cancel: (requestId) => window.electronAPI.ai.polishCancel(requestId),
    subscribe: (cb) => window.electronAPI.ai.onPolishChunk(cb)
  })

  useEffect(() => {
    if (kind === 'polish') void polish.run()
  }, [kind])

  const applyPolish = (): void => {
    if (!polish.result) return
    setLocalErr(null)
    if (frozen && editor) {
      const now = editor.state.doc.textBetween(frozen.from, frozen.to)
      if (now !== frozen.text) {
        setLocalErr(t('ai.polish.staleRange'))
        return
      }
      editor.commands.insertContentAt({ from: frozen.from, to: frozen.to }, polish.result)
    } else {
      setField(field, textToRichText(polish.result))
    }
    onClose()
  }

  // ── 语法（非流式）────────────────────────────────────────────────────
  const [issues, setIssues] = useState<GrammarIssue[] | null>(null)
  const [grammarBusy, setGrammarBusy] = useState(false)
  const [grammarError, setGrammarError] = useState<string | null>(null)

  const runGrammar = async (): Promise<void> => {
    setGrammarBusy(true)
    setGrammarError(null)
    setIssues(null)
    const text = frozen?.text ?? editor?.getText() ?? ''
    const res = await window.electronAPI.ai.grammar({ resumeId, scope: 'selection', text })
    setGrammarBusy(false)
    if (res.ok) setIssues(res.data as GrammarIssue[])
    else setGrammarError(res.error.code)
  }

  useEffect(() => {
    if (kind === 'grammar') void runGrammar()
  }, [kind])

  const replaceIssue = async (g: GrammarIssue): Promise<void> => {
    if (!editor || !g.suggestion) return
    const from0 = frozen?.from ?? 0
    editor.commands.insertContentAt({ from: from0 + g.from, to: from0 + g.to }, g.suggestion)
    // 偏移已变：立即重查刷新列表，防残留失效条目（用户点错位替换）
    await runGrammar()
  }

  return (
    <div className="border-t border-border/70 bg-surface p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {kind === 'polish' ? t('ai.polish.result') : `${t('navSub.grammar')} · ${frozen ? t('ai.grammar.scopeSelection') : field}`}
        </span>
        <div className="flex items-center gap-2">
          {kind === 'polish' ? (
            <>
              <button
                type="button"
                className="text-xs text-foreground/60 hover:text-foreground disabled:opacity-50"
                disabled={!polish.busy}
                onClick={() => void polish.cancel()}
              >
                {t('ai.polish.cancel')}
              </button>
              <button
                type="button"
                className="text-xs text-foreground/60 hover:text-foreground disabled:opacity-50"
                disabled={polish.busy || !polish.result}
                onClick={() => void polish.run()}
              >
                {t('ai.polish.refresh')}
              </button>
              <button
                type="button"
                className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
                disabled={polish.busy || !polish.result}
                onClick={applyPolish}
              >
                {t('ai.polish.apply')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
              disabled={grammarBusy}
              onClick={() => void runGrammar()}
            >
              {grammarBusy ? t('ai.grammar.running') : t('ai.grammar.run')}
            </button>
          )}
          <button type="button" className="text-xs text-foreground/60 hover:text-foreground" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {localErr ? <p className="mb-1 text-xs text-red-500">{localErr}</p> : null}

      {kind === 'polish' ? (
        polish.error ? (
          <p className="text-sm text-red-500">{t('ai.error.' + polish.error.code)}</p>
        ) : (
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-border/70 bg-surface px-3 py-2 text-sm text-foreground">
            {polish.result || (polish.busy ? t('ai.polish.running') : '')}
          </div>
        )
      ) : grammarError ? (
        <p className="text-sm text-red-500">{t('ai.error.' + grammarError)}</p>
      ) : issues === null ? (
        <p className="text-xs text-foreground/50">{grammarBusy ? t('ai.grammar.running') : '…'}</p>
      ) : issues.length === 0 ? (
        <p className="text-xs text-foreground/50">{t('ai.grammar.noIssues')}</p>
      ) : (
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {issues.map((g, i) => (
            <div key={i} className="rounded border border-border/70 bg-surface px-3 py-2">
              <p className="text-sm text-foreground">{g.message}</p>
              {g.suggestion ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs text-foreground/70">
                    {t('ai.grammar.replace')}：{g.suggestion}
                  </p>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2 py-0.5 text-xs text-foreground/70 hover:text-foreground"
                    onClick={() => void replaceIssue(g)}
                  >
                    {t('ai.grammar.replace')}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
