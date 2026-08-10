/**
 * ai/client.ts —— AI 模型实例工厂（M3 落码）
 * 依据：《技术栈.md》§3.9：deepseek/openai/google 走官方 Provider，火山方舟与自定义走
 * createOpenAI({ baseURL }) OpenAI 兼容通道；provider 选择 = PROVIDER_IDS 顺序 + 自定义创建顺序，
 * 取首个 enabled；全禁用抛 NO_PROVIDER。
 * 假设（方案 A1）：火山方舟兼容端点 baseURL = https://ark.cn-beijing.volces.com/api/v3（常量可改）。
 * temperature/maxTokens 随 handle 返回，由调用方传入 generateObject/streamText（v7 provider 工厂仅收模型名）。
 */
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import Store from 'electron-store'
import { PROVIDER_IDS, type Settings } from '../../shared/schema/settings'
import { AiServiceError, getAiConfig } from './config'

const store = new Store<Settings>()

/** 火山方舟 OpenAI 兼容端点（假设 A1，落码时以官方文档核对） */
export const VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'

export interface AiModelHandle {
  model: LanguageModel
  displayName: string
  temperature: number
  maxTokens: number
}

/** 选择当前生效服务商：内置（PROVIDER_IDS 顺序）→ 自定义（创建顺序），首个 enabled */
export function selectProviderId(): string | null {
  const providers = store.get('providers')
  for (const id of PROVIDER_IDS) {
    if (providers[id].enabled) return id
  }
  for (const c of store.get('customProviders') ?? []) {
    if (c.enabled) return `custom:${c.id}`
  }
  return null
}

/** 创建模型实例（缺失配置抛对应错误码；enabled=false → PROVIDER_DISABLED） */
export async function createModel(providerId: string): Promise<AiModelHandle> {
  const cfg = await getAiConfig(providerId)
  if (!cfg.enabled) throw new AiServiceError('PROVIDER_DISABLED', providerId)
  if (!cfg.apiKey) throw new AiServiceError('CONFIG_INVALID', `${providerId}: missing apiKey`)
  const handle = { temperature: cfg.temperature, maxTokens: cfg.maxTokens } as const

  if (providerId.startsWith('custom:') || providerId === 'volcengine') {
    // R3：volcengine 同样支持用户覆盖 baseURL（缺省回退 VOLCENGINE_BASE_URL）
    const baseURL = providerId.startsWith('custom:') ? cfg.baseURL : (cfg.baseURL ?? VOLCENGINE_BASE_URL)
    if (!baseURL) throw new AiServiceError('CONFIG_INVALID', `${providerId}: missing baseURL`)
    if (!cfg.modelId) throw new AiServiceError('CONFIG_INVALID', `${providerId}: missing modelId`)
    const openai = createOpenAI({ apiKey: cfg.apiKey, baseURL })
    return { model: openai(cfg.modelId), displayName: providerId, ...handle }
  }
  if (providerId === 'deepseek') {
    if (!cfg.modelId) throw new AiServiceError('CONFIG_INVALID', 'deepseek: missing modelId')
    return { model: createDeepSeek({ apiKey: cfg.apiKey })(cfg.modelId), displayName: 'DeepSeek', ...handle }
  }
  if (providerId === 'openai') {
    if (!cfg.modelId) throw new AiServiceError('CONFIG_INVALID', 'openai: missing modelId')
    return { model: createOpenAI({ apiKey: cfg.apiKey })(cfg.modelId), displayName: 'OpenAI', ...handle }
  }
  if (providerId === 'google') {
    if (!cfg.modelId) throw new AiServiceError('CONFIG_INVALID', 'google: missing modelId')
    return {
      model: createGoogleGenerativeAI({ apiKey: cfg.apiKey })(cfg.modelId),
      displayName: 'Gemini',
      ...handle
    }
  }
  throw new AiServiceError('CONFIG_INVALID', `unknown provider: ${providerId}`)
}

/** 2026-08-09 T3/R3：检测模型（临时 apiKey/modelId/baseURL 发最小请求验证，不入库） */
export async function testProvider(providerId: string, apiKey: string, modelId: string, baseURL?: string): Promise<boolean> {
  const ping = async (model: LanguageModel): Promise<boolean> => {
    await generateText({ model, prompt: 'ping', maxOutputTokens: 5 })
    return true
  }
  // R3：custom 走 OpenAI 兼容通道（此前缺失导致 custom 检测恒失败）；volcengine 透传覆盖 baseURL
  if (providerId.startsWith('custom:')) {
    if (!baseURL) throw new AiServiceError('CONFIG_INVALID', `${providerId}: missing baseURL`)
    return ping(createOpenAI({ apiKey, baseURL })(modelId))
  }
  if (providerId === 'volcengine') return ping(createOpenAI({ apiKey, baseURL: baseURL ?? VOLCENGINE_BASE_URL })(modelId))
  if (providerId === 'deepseek') return ping(createDeepSeek({ apiKey })(modelId))
  if (providerId === 'openai') return ping(createOpenAI({ apiKey })(modelId))
  if (providerId === 'google') return ping(createGoogleGenerativeAI({ apiKey })(modelId))
  throw new AiServiceError('CONFIG_INVALID', `unknown provider: ${providerId}`)
}

/** 自动选择当前生效服务商并创建模型（无 enabled → NO_PROVIDER） */
export async function createActiveModel(): Promise<AiModelHandle> {
  const providerId = selectProviderId()
  if (!providerId) throw new AiServiceError('NO_PROVIDER')
  return createModel(providerId)
}
