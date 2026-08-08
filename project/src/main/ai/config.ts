/**
 * ai/config.ts —— AI 服务商配置统一入口（M3 落码，S 批 WP-S2 + Q10 自定义）
 * 依据：《技术栈.md》§3.9.2 / §3.11.2：apiKey 走 safeStorage（Linux 降级弱加密 + 告警），
 * modelId/enabled 走明文 electron-store；提示词 getAiPrompt(key) 读 store 缺省回退 DEFAULT_AI_PROMPTS。
 * apiKey 存储：独立文件 userData/ai-keys.json（safeStorage 加密 base64），不碰 SettingsSchema。
 */
import { app, safeStorage } from 'electron'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'
import {
  PROVIDER_IDS,
  type ProviderId,
  type AiPromptKey,
  type Settings
} from '../../shared/schema/settings'
import { DEFAULT_AI_PROMPTS } from '../../shared/schema/ai-prompts'
import type { AiErrorCode, AiConfigView, ProviderConfigView } from '../../shared/ipc-channels'

const store = new Store<Settings>()

/** 结构化 AI 错误（IPC 层统一映射为 AiResult） */
export class AiServiceError extends Error {
  constructor(
    public readonly code: AiErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'AiServiceError'
  }
}

/** 内置服务商信息（默认模型 + 官网「获取 API Key」链接） */
export const BUILTIN_INFO: Record<ProviderId, { name: string; defaultModelId: string; link?: string }> = {
  deepseek: { name: 'DeepSeek', defaultModelId: 'deepseek-chat', link: 'https://platform.deepseek.com/api_keys' },
  // 火山方舟无默认模型：modelId 由用户填写（OpenAI 兼容 baseURL，见 client.ts）
  volcengine: { name: '火山方舟', defaultModelId: '', link: 'https://www.volcengine.com/product/doubao' },
  openai: { name: 'OpenAI', defaultModelId: 'gpt-4o-mini', link: 'https://platform.openai.com/api-keys' },
  google: { name: 'Gemini', defaultModelId: 'gemini-2.0-flash', link: 'https://aistudio.google.com/apikey' }
}

/* ── apiKey keyring（safeStorage）──────────────────────────────────────── */

const KEYS_FILE = path.join(app.getPath('userData'), 'ai-keys.json')
let keysCache: Record<string, string> | null = null

async function loadKeys(): Promise<Record<string, string>> {
  if (keysCache) return keysCache
  try {
    keysCache = JSON.parse(await fs.readFile(KEYS_FILE, 'utf-8')) as Record<string, string>
  } catch {
    keysCache = {}
  }
  return keysCache
}

async function persistKeys(keys: Record<string, string>): Promise<void> {
  keysCache = keys
  await fs.mkdir(path.dirname(KEYS_FILE), { recursive: true })
  await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf-8')
}

/** 存 key（'' 或空 = 清除）；safeStorage 不可用时退弱加密（规范 §4.6，仅 Windows 无 DPAPI 等场景） */
export async function setApiKey(providerId: string, apiKey: string | undefined): Promise<void> {
  const keys = await loadKeys()
  if (!apiKey) {
    delete keys[providerId]
  } else if (safeStorage.isEncryptionAvailable()) {
    keys[providerId] = safeStorage.encryptString(apiKey).toString('base64')
  } else {
    console.warn('[ai/config] safeStorage 不可用，API Key 弱加密存储（仅本机可读性降低，告警一次）')
    keys[providerId] = `plain:${Buffer.from(apiKey, 'utf-8').toString('base64')}`
  }
  await persistKeys(keys)
}

/** 取 key（null = 未配置） */
export async function getApiKey(providerId: string): Promise<string | null> {
  const keys = await loadKeys()
  const v = keys[providerId]
  if (!v) return null
  try {
    if (v.startsWith('plain:')) return Buffer.from(v.slice(6), 'base64').toString('utf-8')
    return safeStorage.decryptString(Buffer.from(v, 'base64'))
  } catch {
    return null // 解密失败（机器绑定/密钥轮换）视为未配置
  }
}

/* ── 配置读取 ──────────────────────────────────────────────────────────── */

/** 提示词：store.aiPrompts.<key> 缺省回退内置默认（单一事实源 DEFAULT_AI_PROMPTS） */
export function getAiPrompt(key: AiPromptKey): string {
  const aiPrompts = store.get('aiPrompts')
  return aiPrompts?.[key] ?? DEFAULT_AI_PROMPTS[key]
}

export interface AiConfig {
  apiKey: string | null
  modelId: string | null
  enabled: boolean
  temperature: number
  maxTokens: number
  /** 仅 volcengine / custom：OpenAI 兼容 baseURL */
  baseURL?: string
}

/** 取单个服务商运行时配置（enabled 未开启也返回，供 UI/错误区分） */
export async function getAiConfig(providerId: string): Promise<AiConfig> {
  const temperature = store.get('temperature') ?? 0.7
  const maxTokens = store.get('maxTokens') ?? 4096

  if (providerId.startsWith('custom:')) {
    const custom = (store.get('customProviders') ?? []).find((c) => `custom:${c.id}` === providerId)
    if (!custom) throw new AiServiceError('CONFIG_INVALID', `unknown provider: ${providerId}`)
    return {
      apiKey: await getApiKey(providerId),
      modelId: custom.modelId ?? null,
      enabled: custom.enabled,
      temperature,
      maxTokens,
      baseURL: custom.baseURL
    }
  }

  const provider = store.get('providers')[providerId as ProviderId]
  const info = BUILTIN_INFO[providerId as ProviderId]
  if (!provider || !info) throw new AiServiceError('CONFIG_INVALID', `unknown provider: ${providerId}`)
  return {
    apiKey: await getApiKey(providerId),
    modelId: provider.modelId ?? (info.defaultModelId || null),
    enabled: provider.enabled,
    temperature,
    maxTokens
  }
}

/* ── 脱敏视图（ai:config:get）─────────────────────────────────────────── */

function maskKey(key: string | null): string | null {
  if (!key) return null
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

/** 组装全量脱敏视图（内置四家 + 自定义） */
export async function buildConfigView(): Promise<AiConfigView> {
  const providers: ProviderConfigView[] = []
  for (const id of PROVIDER_IDS) {
    const info = BUILTIN_INFO[id]
    const cfg = store.get('providers')[id]
    providers.push({
      providerId: id,
      kind: 'builtin',
      name: info.name,
      apiKeyMasked: maskKey(await getApiKey(id)),
      hasApiKey: (await getApiKey(id)) !== null,
      modelId: cfg.modelId ?? (info.defaultModelId || null),
      enabled: cfg.enabled,
      ...(id === 'volcengine' ? { baseURL: 'https://ark.cn-beijing.volces.com/api/v3' } : {})
    })
  }
  for (const c of store.get('customProviders') ?? []) {
    providers.push({
      providerId: `custom:${c.id}`,
      kind: 'custom',
      name: c.name,
      apiKeyMasked: maskKey(await getApiKey(`custom:${c.id}`)),
      hasApiKey: (await getApiKey(`custom:${c.id}`)) !== null,
      modelId: c.modelId ?? null,
      enabled: c.enabled,
      baseURL: c.baseURL
    })
  }
  return { providers, temperature: store.get('temperature') ?? 0.7, maxTokens: store.get('maxTokens') ?? 4096, prompts: store.get('aiPrompts') ?? null }
}
