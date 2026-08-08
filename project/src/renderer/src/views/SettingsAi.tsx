/**
 * SettingsAi —— 设置 → AI 设置屏（M3 落码，S 批 WP-S2 提前 + Q10 自定义服务商）
 * 结构：四服务商 tab + 自定义 tab + 全局参数（温度/最长上下文）+ AI 提示词四卡（Q3 修订并入）。
 * 所有读写走 ai:config:get/save（apiKey 脱敏前 4 后 4；保存时 apiKey 入 safeStorage）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiPromptCard } from '../components/ai/AiPromptCard'
import { CustomProviderForm } from '../components/ai/CustomProviderForm'
import type { AiConfigView, ProviderConfigView } from '@shared/ipc-channels'
import type { AiPrompts } from '@shared/schema/settings'

const BUILTIN_TABS: Array<{ id: string; key: string }> = [
  { id: 'deepseek', key: 'settings.ai.tabs.deepseek' },
  { id: 'volcengine', key: 'settings.ai.tabs.volcengine' },
  { id: 'openai', key: 'settings.ai.tabs.openai' },
  { id: 'google', key: 'settings.ai.tabs.google' }
]

/** 内置服务商「获取 API Key」官网链接（与主进程 BUILTIN_INFO 同步；规范 S 批 WP-S2） */
const BUILTIN_LINKS: Record<string, string> = {
  deepseek: 'https://platform.deepseek.com/api_keys',
  volcengine: 'https://www.volcengine.com/product/doubao',
  openai: 'https://platform.openai.com/api-keys',
  google: 'https://aistudio.google.com/apikey'
}

export function SettingsAi(): React.JSX.Element {
  const { t } = useTranslation()
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  const [view, setView] = useState<AiConfigView | null>(null)
  const [tab, setTab] = useState('deepseek')
  const [loadErr, setLoadErr] = useState<string | null>(null)

  // 编辑草稿（非受控即时保存；apiKey 输入单独管理）
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(4096)

  const reload = (): void => {
    void window.electronAPI.ai.config
      .get()
      .then((res) => {
        if (res.ok) {
          setView(res.data)
          setTemperature(res.data.temperature)
          setMaxTokens(res.data.maxTokens)
        } else {
          setLoadErr(res.error.code)
        }
      })
      .catch(() => setLoadErr('UNKNOWN'))
  }

  useEffect(reload, [])

  const activeProvider = useMemo<ProviderConfigView | null>(() => {
    if (!view) return null
    if (tab === 'custom') return null
    return view.providers.find((p) => p.providerId === tab) ?? null
  }, [view, tab])

  const save = async (patch: Parameters<typeof window.electronAPI.ai.config.save>[0]): Promise<void> => {
    const res = await window.electronAPI.ai.config.save(patch)
    if (res.ok) reload()
    return res.ok ? Promise.resolve() : Promise.reject(new Error(res.error.code))
  }

  if (loadErr || !view) {
    return (
      <div className="p-6 text-sm text-foreground/70">
        {loadErr ? t('ai.error.' + loadErr) : t('common.comingSoon')}
      </div>
    )
  }

  const prompts = view.prompts
  const promptCards: Array<{ key: keyof AiPrompts; title: string }> = [
    { key: 'grammar', title: t('navSub.grammar') },
    { key: 'intro', title: t('navSub.intro') },
    { key: 'polish', title: t('navSub.polish') },
    { key: 'match', title: t('navSub.match') }
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2">
        <button
          type="button"
          className="text-xs text-foreground/60 hover:text-foreground"
          onClick={() => setCurrentView('settings-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-sm font-semibold">{t('settings.ai.title')}</h2>
      </div>

      {/* 服务商 tab */}
      <div className="flex gap-1 border-b border-border/70 px-4 pt-2">
        {[...BUILTIN_TABS, { id: 'custom', key: 'settings.ai.custom.add' }].map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`rounded-t px-3 py-1.5 text-sm ${tab === tb.id ? 'bg-surface font-medium' : 'text-foreground/60 hover:text-foreground'}`}
            onClick={() => setTab(tb.id)}
          >
            {t(tb.key)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeProvider ? (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{activeProvider.name}</span>
              <span
                className={`text-xs ${activeProvider.enabled ? 'text-green-600' : 'text-foreground/50'}`}
              >
                {activeProvider.enabled
                  ? activeProvider.hasApiKey
                    ? t('settings.ai.statusConnected')
                    : t('settings.ai.statusDisabled')
                  : t('settings.ai.statusDisabled')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
                type="password"
                placeholder={activeProvider.apiKeyMasked ?? t('settings.ai.apiKey')}
                defaultValue=""
                onBlur={(e) => {
                  if (e.target.value.trim()) void save({ providerId: activeProvider.providerId, apiKey: e.target.value.trim() })
                }}
              />
              {activeProvider.kind === 'builtin' ? (
                // 主进程 setWindowOpenHandler 拦截新窗 → shell.openExternal（系统浏览器）
                <a
                  className="shrink-0 text-xs text-foreground/60 hover:text-foreground"
                  href={BUILTIN_LINKS[activeProvider.providerId] ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('settings.ai.getApiKey')} ↗
                </a>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <input
                className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
                defaultValue={activeProvider.modelId ?? ''}
                placeholder={t('settings.ai.modelId')}
                onBlur={(e) => {
                  if (e.target.value.trim() !== (activeProvider.modelId ?? '')) {
                    void save({ providerId: activeProvider.providerId, modelId: e.target.value.trim() })
                  }
                }}
              />
              <label className="flex shrink-0 items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={activeProvider.enabled}
                  onChange={(e) => void save({ providerId: activeProvider.providerId, enabled: e.target.checked })}
                />
                <span className="text-xs">{t('settings.ai.enabled')}</span>
              </label>
            </div>
          </div>
        ) : (
          // 自定义服务商列表
          <div className="mb-4 flex flex-col gap-2">
            {view.providers
              .filter((p) => p.kind === 'custom')
              .map((p) => (
                <div key={p.providerId} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => void save({ providerId: p.providerId, enabled: e.target.checked })}
                        />
                        <span className="text-xs">{t('settings.ai.enabled')}</span>
                      </label>
                    </div>
                    <p className="truncate text-xs text-foreground/50">
                      {p.baseURL} · {p.modelId ?? '—'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-foreground/60 hover:text-red-500"
                    onClick={() => {
                      if (window.confirm(t('settings.ai.custom.deleteConfirm', { name: p.name }))) {
                        void save({ deleteCustom: p.providerId })
                      }
                    }}
                  >
                    {t('settings.ai.custom.delete')}
                  </button>
                </div>
              ))}
            <CustomProviderForm onAdded={reload} />
          </div>
        )}

        {/* 全局参数 */}
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm">{t('settings.ai.temperature')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              onMouseUp={() => void save({ temperature })}
              onTouchEnd={() => void save({ temperature })}
              className="flex-1"
            />
            <span className="w-12 shrink-0 text-right text-xs text-foreground/60">{temperature.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm">{t('settings.ai.maxTokens')}</span>
            <input
              type="number"
              min={1}
              max={32768}
              step={100}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              onBlur={() => void save({ maxTokens })}
              className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
            />
          </div>
        </div>

        {/* 提示词四卡（Q3 修订：并入 settings.ai，AI 屏专注四分区） */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('ai.prompts.title')}</h3>
          {promptCards.map((pc) => (
            <AiPromptCard
              key={pc.key}
              title={pc.title}
              value={prompts?.[pc.key] ?? null}
              onSave={(v) => save({ prompts: { ...(prompts ?? { grammar: '', intro: '', polish: '', match: '' }), [pc.key]: v } })}
              onReset={() => save({ prompts: null })}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
