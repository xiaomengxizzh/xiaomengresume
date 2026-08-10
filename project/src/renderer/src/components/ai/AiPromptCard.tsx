/**
 * AiPromptCard —— AI 提示词编辑卡（2026-08-09 重构：点击卡片展开/收起，默认提示词作灰色 placeholder）
 * 交互：默认提示词以灰色文字显示在输入框内（可见不可直接编辑）；点击/聚焦文本框自动清空允许输入；
 * 点击卡片本身展开/收起编辑界面（无额外按钮）；编辑界面右下角「重置」/「保存」。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface AiPromptCardProps {
  title: string
  /** 当前自定义值（null = 未自定义，显示预置默认） */
  value: string | null
  /** 预置默认提示词（placeholder 灰字展示；用户未自定义时可见不可直接编辑） */
  defaultText: string
  onSave: (v: string) => Promise<void>
  /** 恢复预置默认值（清空自定义，主进程删键回退默认） */
  onReset: () => Promise<void>
}

export function AiPromptCard({ title, value, defaultText, onSave, onReset }: AiPromptCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (): void => {
    setDraft('') // 每次展开从空开始（默认提示词 = placeholder，聚焦即清空）
    setOpen((v) => !v)
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    await onSave(draft)
    setBusy(false)
    setOpen(false)
  }

  const reset = async (): Promise<void> => {
    setBusy(true)
    await onReset()
    setBusy(false)
    setDraft('')
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      {/* 卡片头部：点击展开/收起（无额外编辑/还原按钮） */}
      <button type="button" className="flex w-full items-center justify-between gap-2" onClick={toggle} aria-expanded={open}>
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs text-foreground/40">{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            className="min-h-24 w-full rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-foreground/50"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={defaultText}
          />
          {/* 右下角：重置 / 保存 */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs text-foreground/60 hover:bg-border/40 hover:text-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() => void reset()}
            >
              {t('ai.prompts.reset')}
            </button>
            <button
              type="button"
              className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
              disabled={busy}
              onClick={() => void save()}
            >
              {t('ai.prompts.save')}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 max-h-16 overflow-hidden text-xs text-foreground/50" title={value && value.trim() ? value : defaultText}>
          {value && value.trim() ? value : defaultText}
        </p>
      )}
    </div>
  )
}
