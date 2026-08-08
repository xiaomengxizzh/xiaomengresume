/**
 * AiPromptCard —— AI 提示词编辑卡（R 批 WP-R4 / S 批并入 settings.ai）
 * 状态机：只读灰 → 编辑（textarea）→ 保存/取消/刷新还原（写 store，回只读灰）。
 * 刷新还原 = 清空自定义（主进程回退 DEFAULT_AI_PROMPTS）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface AiPromptCardProps {
  title: string
  /** 当前自定义值（null = 未自定义） */
  value: string | null
  onSave: (v: string) => Promise<void>
  /** 还原为内置默认（传 null 给主进程删键） */
  onReset: () => Promise<void>
}

export function AiPromptCard({ title, value, onSave, onReset }: AiPromptCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const startEdit = (): void => {
    setDraft(value ?? '')
    setMsg(null)
    setEditing(true)
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    await onSave(draft)
    setBusy(false)
    setEditing(false)
    setMsg(t('ai.prompts.saved'))
  }

  const reset = async (): Promise<void> => {
    setBusy(true)
    await onReset()
    setBusy(false)
    setEditing(false)
    setMsg(t('ai.prompts.resetted'))
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {!editing ? (
          <div className="flex items-center gap-2">
            {msg ? <span className="text-xs text-foreground/50">{msg}</span> : null}
            <button
              type="button"
              className="text-xs text-foreground/60 hover:text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void startEdit()}
            >
              {t('ai.prompts.edit')}
            </button>
            {value !== null ? (
              <button
                type="button"
                className="text-xs text-foreground/60 hover:text-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() => void reset()}
              >
                {t('ai.prompts.reset')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="min-h-24 w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-foreground/50"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('ai.prompts.hint')}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
              disabled={busy}
              onClick={() => void save()}
            >
              {t('ai.prompts.save')}
            </button>
            <button
              type="button"
              className="text-xs text-foreground/60 hover:text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              {t('ai.prompts.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <p className="max-h-16 overflow-hidden text-xs text-foreground/50">
          {value && value.trim() ? value : t('ai.prompts.hint')}
        </p>
      )}
    </div>
  )
}
