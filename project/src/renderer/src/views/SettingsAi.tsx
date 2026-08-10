/**
 * SettingsAi —— 设置 → AI 设置屏（M3 落码；2026-08-09 T3 优化）
 * 结构：四内置服务商 tab（移除「添加自定义供应商」入口）+ 名称/默认接口地址展示 +
 * API Key / 模型 ID（受控）+「检测模型」按钮（验证后解锁下方全局参数与提示词区）+ 提示词预填默认。
 * 所有读写走 ai:config:get/save；检测走 ai:config:test（临时 key/model，不入库）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiPromptCard } from '../components/ai/AiPromptCard'
import { Button } from '../components/ui'
import { DEFAULT_AI_PROMPTS } from '@shared/schema/ai-prompts'
import type { AiConfigView, ProviderConfigView } from '@shared/ipc-channels'
import type { AiPrompts } from '@shared/schema/settings'

/** 2026-08-09 T1：config 读取失败的兜底视图——四内置服务商恒可配置（apiKey/modelId 可填） */
const FALLBACK_VIEW: AiConfigView = {
  providers: [
    { providerId: 'deepseek', kind: 'builtin', name: 'DeepSeek', apiKeyMasked: null, hasApiKey: false, modelId: null, enabled: false, baseURL: 'https://api.deepseek.com', defaultName: 'DeepSeek', defaultBaseURL: 'https://api.deepseek.com' },
    { providerId: 'volcengine', kind: 'builtin', name: '火山方舟', apiKeyMasked: null, hasApiKey: false, modelId: null, enabled: false, baseURL: 'https://ark.cn-beijing.volces.com/api/v3', defaultName: '火山方舟', defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
    { providerId: 'openai', kind: 'builtin', name: 'OpenAI', apiKeyMasked: null, hasApiKey: false, modelId: null, enabled: false, baseURL: 'https://api.openai.com/v1', defaultName: 'OpenAI', defaultBaseURL: 'https://api.openai.com/v1' },
    { providerId: 'google', kind: 'builtin', name: 'Gemini', apiKeyMasked: null, hasApiKey: false, modelId: null, enabled: false, baseURL: 'https://generativelanguage.googleapis.com', defaultName: 'Gemini', defaultBaseURL: 'https://generativelanguage.googleapis.com' }
  ],
  temperature: 0.7,
  maxTokens: 4096,
  prompts: { grammar: '', intro: '', polish: '', match: '', vision: '' }
}

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

/** 温度三档单选预设（2026-08-09：客观 0.3 / 正常 0.5 / 发散 0.7） */
const TEMP_PRESETS: Array<{ value: number; key: string }> = [
  { value: 0.3, key: 'settings.ai.tempObjective' },
  { value: 0.5, key: 'settings.ai.tempNormal' },
  { value: 0.7, key: 'settings.ai.tempDivergent' }
]

export function SettingsAi(): React.JSX.Element {
  const { t } = useTranslation()
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  const [view, setView] = useState<AiConfigView | null>(null)
  const [tab, setTab] = useState('deepseek')
  const [loadErr, setLoadErr] = useState<string | null>(null)

  // 编辑草稿（apiKey/modelId 受控：检测模型用输入值，失焦保存）
  const [temperature, setTemperature] = useState(0.7)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [modelIdInput, setModelIdInput] = useState('')

  // 2026-08-09 T3：检测模型状态（仅展示检测结果，不再锁定表单——R3 全开放）
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'noKey' | 'noResponse'>('idle')
  // 2026-08-09 T1：添加自定义供应商表单 + 名称/地址草稿
  const [addOpen, setAddOpen] = useState(false)
  const [draftCustom, setDraftCustom] = useState({ name: '', baseURL: '', modelId: '' })
  const [providerName, setProviderName] = useState('')
  const [providerBaseURL, setProviderBaseURL] = useState('')
  // 2026-08-09：右下角「重置/保存」操作中
  const [busy, setBusy] = useState(false)

  const reload = (): void => {
    void window.electronAPI.ai.config
      .get()
      .then((res) => {
        if (res.ok) {
          setView(res.data)
          setTemperature(res.data.temperature)
          setLoadErr(null)
        } else {
          // 2026-08-09 T1 修复：配置加载失败仍渲染默认界面（可操作），错误仅提示条不阻断
          setLoadErr(res.error.code)
          setView(FALLBACK_VIEW)
        }
      })
      .catch(() => {
        setLoadErr('UNKNOWN')
        setView(FALLBACK_VIEW)
      })
  }

  useEffect(reload, [])

  const activeProvider = useMemo<ProviderConfigView | null>(() => {
    if (!view) return null
    return view.providers.find((p) => p.providerId === tab) ?? null
  }, [view, tab])

  // 切换 tab 时重置草稿与检测状态
  useEffect(() => {
    setApiKeyInput('')
    setModelIdInput('')
    setTestState('idle')
    setProviderName(activeProvider?.name ?? '')
    setProviderBaseURL(activeProvider?.baseURL ?? '')
  }, [tab, activeProvider?.providerId])

  const save = async (patch: Parameters<typeof window.electronAPI.ai.config.save>[0]): Promise<void> => {
    const res = await window.electronAPI.ai.config.save(patch)
    if (res.ok) reload()
    return res.ok ? Promise.resolve() : Promise.reject(new Error(res.error.code))
  }

  // 2026-08-09：右下角「重置」——全部 API 配置项恢复系统预设默认值（主进程统一复位）
  const resetAll = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await window.electronAPI.ai.config.reset()
      if (res.ok) {
        setApiKeyInput('')
        setModelIdInput('')
        setProviderName('')
        setProviderBaseURL('')
        setTemperature(0.7)
        setTestState('idle')
        reload()
      } else {
        window.alert(t('ai.error.' + res.error.code))
      }
    } finally {
      setBusy(false)
    }
  }

  // 2026-08-09：右下角「保存」——当前 API 配置持久化存储（当前服务商草稿 + 参数）
  const saveAll = async (): Promise<void> => {
    if (!activeProvider) return
    setBusy(true)
    try {
      const patch: Parameters<typeof window.electronAPI.ai.config.save>[0] = {
        providerId: activeProvider.providerId,
        ...(providerName.trim() ? { name: providerName.trim() } : {}),
        ...(providerBaseURL.trim() ? { baseURL: providerBaseURL.trim() } : {}),
        ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
        ...(modelIdInput.trim() ? { modelId: modelIdInput.trim() } : {}),
        temperature: nearestTemp.value
      }
      await save(patch)
    } catch (err) {
      window.alert(t('ai.error.' + ((err as Error).message ?? 'UNKNOWN')))
    } finally {
      setBusy(false)
    }
  }

  /** 2026-08-09 T3/R3：检测模型（用当前输入 apiKey+modelId 验证；custom 透传 baseURL） */
  const testModel = async (): Promise<void> => {
    const key = apiKeyInput.trim() || (activeProvider?.hasApiKey ? activeProvider.apiKeyMasked ?? '' : '')
    if (!key) {
      setTestState('noKey')
      return
    }
    const model = modelIdInput.trim() || activeProvider?.modelId || ''
    if (!model) {
      setTestState('noKey')
      return
    }
    setTestState('testing')
    const res = await window.electronAPI.ai.config.test({
      providerId: tab,
      apiKey: key,
      modelId: model,
      baseURL: activeProvider?.kind === 'custom' ? providerBaseURL.trim() : providerBaseURL.trim() || undefined
    })
    if (res.ok) {
      setTestState('ok')
    } else {
      setTestState(res.error.code === 'NO_API_KEY' ? 'noKey' : 'noResponse')
    }
  }

  if (!view) {
    return <div className="p-6 text-sm text-foreground/70">…</div>
  }

  // 2026-08-09 T1：配置加载失败提示条（不阻断界面渲染）
  const loadWarn = loadErr ? (
    <div className="border-b border-danger/30 bg-danger-bg px-4 py-1.5 text-xs text-danger">
      {t('ai.error.' + loadErr)}
    </div>
  ) : null

  const prompts = view.prompts
  // R7：提示词分区——简历提示词 4 键 + 视觉提示词（豆包，独立分组）
  const resumePromptCards: Array<{ key: keyof AiPrompts; title: string }> = [
    { key: 'grammar', title: t('navSub.grammar') },
    { key: 'intro', title: t('navSub.intro') },
    { key: 'polish', title: t('navSub.polish') },
    { key: 'match', title: t('navSub.match') }
  ]
  const visionPromptKey: keyof AiPrompts = 'vision'

  const testHint =
    testState === 'noKey'
      ? t('settings.ai.noApiKey')
      : testState === 'noResponse'
        ? t('settings.ai.noResponse')
        : testState === 'ok'
          ? t('settings.ai.testOk')
          : ''

  // 温度三档单选：就近映射当前值到预设档（旧配置任意值也必选中其一）
  const nearestTemp = TEMP_PRESETS.reduce((a, b) => (Math.abs(a.value - temperature) <= Math.abs(b.value - temperature) ? a : b))

  return (
    <div className="flex h-full flex-col">
      {loadWarn}
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2">
        {/* 2026-08-09：返回改为独立小卡片样式（与整体卡片风格一致） */}
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-card border border-border bg-surface px-3 py-1.5 text-xs text-foreground/70 shadow-card-press transition-all hover:-translate-y-px hover:text-foreground hover:shadow-card-hover"
          onClick={() => setCurrentView('settings-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-sm font-semibold">{t('settings.ai.title')}</h2>
      </div>

      {/* 服务商 tab（2026-08-09 T1：四内置 + 自定义 provider tab + 右侧「添加自定义供应商」按钮） */}
      <div className="flex flex-wrap items-end gap-1 border-b border-border/70 px-4 pt-2">
        {BUILTIN_TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`rounded-t px-3 py-1.5 text-sm ${tab === tb.id ? 'bg-surface font-medium' : 'text-foreground/60 hover:text-foreground'}`}
            onClick={() => setTab(tb.id)}
          >
            {t(tb.key)}
          </button>
        ))}
        {view.providers
          .filter((p) => p.kind === 'custom')
          .map((p) => (
            <button
              key={p.providerId}
              type="button"
              className={`max-w-[140px] truncate rounded-t px-3 py-1.5 text-sm ${tab === p.providerId ? 'bg-surface font-medium' : 'text-foreground/60 hover:text-foreground'}`}
              title={p.name}
              onClick={() => setTab(p.providerId)}
            >
              {p.name}
            </button>
          ))}
        <button
          type="button"
          className="mb-1 ml-2 shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => setAddOpen((v) => !v)}
        >
          ＋ {t('settings.ai.custom.add')}
        </button>
      </div>

      {/* 2026-08-09 T1：添加自定义供应商表单（名称/地址/模型 ID） */}
      {addOpen ? (
        <div className="flex flex-col gap-2 border-b border-border/70 bg-border/20 px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            <input
              className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
              placeholder={t('settings.ai.custom.name')}
              value={draftCustom.name}
              onChange={(e) => setDraftCustom({ ...draftCustom, name: e.target.value })}
            />
            <input
              className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
              placeholder="https://api.example.com/v1"
              value={draftCustom.baseURL}
              onChange={(e) => setDraftCustom({ ...draftCustom, baseURL: e.target.value })}
            />
            <input
              className="rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
              placeholder={t('settings.ai.modelId')}
              value={draftCustom.modelId}
              onChange={(e) => setDraftCustom({ ...draftCustom, modelId: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={!draftCustom.name.trim() || !draftCustom.baseURL.trim()}
              onClick={() => {
                void save({ addCustom: { name: draftCustom.name.trim(), baseURL: draftCustom.baseURL.trim(), modelId: draftCustom.modelId.trim() || undefined } }).then(() => {
                  setAddOpen(false)
                  setDraftCustom({ name: '', baseURL: '', modelId: '' })
                })
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeProvider ? (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
            {/* R3：供应商名字（内置可编辑，重置回默认） */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs text-foreground/60">{t('settings.ai.providerName')}</label>
                <span className={`text-xs ${activeProvider.enabled ? 'text-green-600' : 'text-foreground/50'}`}>
                  {activeProvider.enabled
                    ? activeProvider.hasApiKey
                      ? t('settings.ai.statusConnected')
                      : t('settings.ai.statusDisabled')
                    : t('settings.ai.statusDisabled')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-foreground/50"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  onBlur={() => {
                    if (providerName.trim() && providerName.trim() !== (activeProvider.name ?? '')) {
                      void save({ providerId: activeProvider.providerId, name: providerName.trim() })
                    }
                  }}
                />
                {activeProvider.defaultName && providerName.trim() !== activeProvider.defaultName ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2 py-1 text-xs text-foreground/60 hover:bg-border/40 hover:text-foreground"
                    title={t('settings.ai.resetDefault')}
                    onClick={() => {
                      setProviderName(activeProvider.defaultName ?? '')
                      void save({ providerId: activeProvider.providerId, name: activeProvider.defaultName })
                    }}
                  >
                    {t('settings.ai.reset')}
                  </button>
                ) : null}
              </div>
            </div>

            {/* R3：接口地址（内置可编辑，重置回默认） */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/60">{t('settings.ai.baseURL')}</label>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-foreground/50"
                  value={providerBaseURL}
                  onChange={(e) => setProviderBaseURL(e.target.value)}
                  onBlur={() => {
                    if (providerBaseURL.trim() && providerBaseURL.trim() !== (activeProvider.baseURL ?? '')) {
                      void save({ providerId: activeProvider.providerId, baseURL: providerBaseURL.trim() })
                    }
                  }}
                />
                {activeProvider.defaultBaseURL && providerBaseURL.trim() !== activeProvider.defaultBaseURL ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2 py-1 text-xs text-foreground/60 hover:bg-border/40 hover:text-foreground"
                    title={t('settings.ai.resetDefault')}
                    onClick={() => {
                      setProviderBaseURL(activeProvider.defaultBaseURL ?? '')
                      void save({ providerId: activeProvider.providerId, baseURL: activeProvider.defaultBaseURL })
                    }}
                  >
                    {t('settings.ai.reset')}
                  </button>
                ) : null}
              </div>
            </div>

            {/* R3：API Key（标签 + 清除按钮；失焦保存） */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/60">{t('settings.ai.apiKeyLabel')}</label>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
                  type="password"
                  placeholder={activeProvider.apiKeyMasked ?? t('settings.ai.apiKey')}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onBlur={() => {
                    if (apiKeyInput.trim()) void save({ providerId: activeProvider.providerId, apiKey: apiKeyInput.trim() })
                  }}
                />
                {activeProvider.hasApiKey || apiKeyInput.trim() ? (
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2 py-1 text-xs text-foreground/60 hover:bg-danger-bg hover:text-danger"
                    title={t('settings.ai.clearKey')}
                    onClick={() => {
                      setApiKeyInput('')
                      void save({ providerId: activeProvider.providerId, apiKey: '' })
                    }}
                  >
                    {t('settings.ai.clearKey')}
                  </button>
                ) : null}
                {activeProvider.kind === 'builtin' ? (
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
            </div>

            {/* R3：模型 ID（标签 + 失焦保存） */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-foreground/60">{t('settings.ai.modelIdLabel')}</label>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-foreground/50"
                  value={modelIdInput}
                  placeholder={activeProvider.modelId ?? t('settings.ai.modelId')}
                  onChange={(e) => setModelIdInput(e.target.value)}
                  onBlur={() => {
                    const v = modelIdInput.trim()
                    if (v && v !== (activeProvider.modelId ?? '')) {
                      void save({ providerId: activeProvider.providerId, modelId: v })
                    }
                  }}
                />
              </div>
            </div>

            {/* 2026-08-09 T3：检测模型（仅展示结果，不锁定） */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" disabled={testState === 'testing'} onClick={() => void testModel()}>
                {testState === 'testing' ? t('settings.ai.testing') : t('settings.ai.testModel')}
              </Button>
              {testHint ? (
                <span className={`text-xs ${testState === 'ok' ? 'text-success' : 'text-warning'}`}>{testHint}</span>
              ) : (
                <span className="text-xs text-foreground/45">{t('settings.ai.testHint')}</span>
              )}
            </div>

            {/* 2026-08-09：右下角「重置/保存」（重置=全部 API 配置恢复系统默认；保存=当前配置持久化） */}
            <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void resetAll()}>
                {t('settings.ai.reset')}
              </Button>
              <Button size="sm" variant="default" disabled={busy} onClick={() => void saveAll()}>
                {t('settings.ai.save')}
              </Button>
            </div>
          </div>
        ) : null}

        {/* 全局参数 + 提示词（R3：全开放编辑，不再锁定） */}
        <div className="flex flex-col gap-3">

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
            {/* 2026-08-09：温度三档单选（客观 0.3 / 正常 0.5 / 发散 0.7），只能选其一 */}
            <span className="text-sm">{t('settings.ai.temperature')}</span>
            <div className="flex gap-2">
              {TEMP_PRESETS.map((p) => (
                <label key={p.value} className={`flex cursor-pointer select-none items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors hover:bg-border/40 ${nearestTemp.value === p.value ? 'border-foreground/40 bg-border/30 text-foreground' : 'border-border text-foreground'}`}>
                  <input
                    type="radio"
                    name="ai-temperature"
                    className="accent-foreground"
                    checked={nearestTemp.value === p.value}
                    onChange={() => {
                      setTemperature(p.value)
                      void save({ temperature: p.value })
                    }}
                  />
                  {t(p.key)}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t('ai.prompts.title')}</h3>
            {resumePromptCards.map((pc) => (
              <AiPromptCard
                key={pc.key}
                title={pc.title}
                value={prompts?.[pc.key] ?? null}
                defaultText={DEFAULT_AI_PROMPTS[pc.key]}
                onSave={(v) => save({ prompts: { ...(prompts ?? { grammar: '', intro: '', polish: '', match: '', vision: '' }), [pc.key]: v } })}
                onReset={() => save({ prompts: null })}
              />
            ))}
          </div>

          {/* R7：豆包视觉提示词独立分组（与简历提示词分开设置） */}
          <div className="flex flex-col gap-2 border-t border-border/70 pt-3">
            <h3 className="text-sm font-medium">{t('settings.ai.visionPromptTitle')}</h3>
            <p className="text-xs text-foreground/50">{t('settings.ai.visionPromptHint')}</p>
            <AiPromptCard
              key={visionPromptKey}
              title={t('settings.ai.visionPrompt')}
              value={prompts?.[visionPromptKey] ?? null}
              defaultText={DEFAULT_AI_PROMPTS[visionPromptKey]}
              onSave={(v) => save({ prompts: { ...(prompts ?? { grammar: '', intro: '', polish: '', match: '', vision: '' }), [visionPromptKey]: v } })}
              onReset={() => save({ prompts: null })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
