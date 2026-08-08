/**
 * CustomProviderForm —— 自定义 OpenAI 兼容服务商表单（Q10 拍板，M3 落码）
 * 字段：名称 / baseURL（OpenAI 兼容）/ modelId / apiKey / 启用；一次 addCustom 提交。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function CustomProviderForm({ onAdded }: { onAdded: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [baseURL, setBaseURL] = useState('')
  const [modelId, setModelId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!name.trim() || !baseURL.trim()) {
      setErr('name/baseURL required')
      return
    }
    setBusy(true)
    setErr(null)
    const res = await window.electronAPI.ai.config.save({
      addCustom: {
        name: name.trim(),
        baseURL: baseURL.trim(),
        ...(modelId.trim() ? { modelId: modelId.trim() } : {}),
        ...(apiKey ? { apiKey } : {}),
        enabled: true
      }
    })
    setBusy(false)
    if (!res.ok) {
      setErr(res.error.code)
      return
    }
    setName('')
    setBaseURL('')
    setModelId('')
    setApiKey('')
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        type="button"
        className="mt-3 text-sm text-foreground/70 hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        + {t('settings.ai.custom.add')}
      </button>
    )
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
      <input
        className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
        placeholder={t('settings.ai.custom.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
        placeholder={`${t('settings.ai.custom.baseURL')}（https://…）`}
        value={baseURL}
        onChange={(e) => setBaseURL(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
          placeholder={t('settings.ai.modelId')}
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
        />
        <input
          className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
          placeholder={t('settings.ai.apiKey')}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>
      {err ? <span className="text-xs text-red-500">{err}</span> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
          disabled={busy}
          onClick={() => void submit()}
        >
          {t('settings.ai.custom.save')}
        </button>
        <button
          type="button"
          className="text-xs text-foreground/60 hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          {t('common.cancel') ?? 'Cancel'}
        </button>
      </div>
    </div>
  )
}
