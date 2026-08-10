/**
 * ai/register-ai.ts —— AI IPC 注册（M3 落码）
 * 通道：ai:grammar / ai:intro(+cancel) / ai:polish(+cancel) / ai:match / ai:config:get/save
 * 统一返回 AiResult<T>（结构化错误码，Q5 拍板）；流式经 'ai:intro:chunk'/'ai:polish:chunk' 推送。
 * 互斥语义（Q4）：渲染层单请求互斥；主进程按 requestId 维护 AbortController 支持取消。
 */
import { ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import {
  IPC,
  type AiError,
  type AiResult,
  type AiStreamChunk,
  type AiConfigView,
  type AiGrammarArgs,
  type AiIntroArgs,
  type AiPolishArgs,
  type AiMatchArgs
} from '../../shared/ipc-channels'
import { AiConfigSaveArgsSchema, type AiConfigSaveArgs } from '../../shared/schema/ai-config'
import type { AiConfigTestArgs } from '../../shared/ipc-channels'
import type { Settings } from '../../shared/schema/settings'
import { AiServiceError, buildConfigView, resetAiConfig, setApiKey } from './config'
import { testProvider } from './client'
import { isAiMock, mockGrammar, mockIntro, mockPolish, mockMatch } from './mock'
import { runGrammar } from './grammar'
import { runIntro } from './intro'
import { runPolish } from './polish'
import { runMatch } from './match'

const store = new Store<Settings>()
const activeStreams = new Map<string, AbortController>()

/** 未知错误 → 结构化错误码映射（AI SDK APICallError：statusCode/code；AbortError → CANCELLED） */
function toAiError(err: unknown): AiError {
  if (err instanceof AiServiceError) return { code: err.code, message: err.message }
  const e = err as { name?: string; statusCode?: number; code?: string; message?: string }
  if (e.name === 'AbortError' || e.code === 'aborted') return { code: 'CANCELLED' }
  if (e.statusCode === 429 || e.code === 'rate_limit') return { code: 'RATE_LIMIT' }
  if (e.statusCode !== undefined && e.statusCode >= 500) return { code: 'NETWORK' }
  if (e.code === 'timeout' || /timeout|timed out/i.test(e.message ?? '')) return { code: 'TIMEOUT' }
  return { code: 'UNKNOWN', message: e.message }
}

function ok<T>(data: T): AiResult<T> {
  return { ok: true, data }
}

function sendChunk(sender: WebContents, channel: string, requestId: string, delta: string): void {
  if (!sender.isDestroyed()) {
    sender.send(channel, { requestId, delta } satisfies AiStreamChunk)
  }
}

/** 流式 invoke 包装：注册 controller → 取消按 requestId abort → 中断统一回 CANCELLED */
async function runStreaming(
  requestId: string,
  run: (signal: AbortSignal) => Promise<string>
): Promise<AiResult<string>> {
  const controller = new AbortController()
  activeStreams.set(requestId, controller)
  try {
    return ok(await run(controller.signal))
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, error: { code: 'CANCELLED' } }
    return { ok: false, error: toAiError(err) }
  } finally {
    activeStreams.delete(requestId)
  }
}

export function registerAiIpc(): void {
  // ── 非流式：语法（generateObject）──────────────────────────────────────
  ipcMain.handle(IPC.Ai.Grammar, async (_e, args: AiGrammarArgs): Promise<AiResult<unknown>> => {
    try {
      return ok(isAiMock() ? await mockGrammar(args) : await runGrammar(args))
    } catch (err) {
      return { ok: false, error: toAiError(err) }
    }
  })

  // ── 流式：自我介绍（generate | translate）──────────────────────────────
  ipcMain.handle(IPC.Ai.Intro, async (event, args: AiIntroArgs): Promise<AiResult<string>> => {
    const requestId = args?.requestId || randomUUID()
    return runStreaming(requestId, (signal) =>
      isAiMock()
        ? mockIntro(args, (d) => sendChunk(event.sender, 'ai:intro:chunk', requestId, d))
        : runIntro(args, (d) => sendChunk(event.sender, 'ai:intro:chunk', requestId, d), signal)
    )
  })
  ipcMain.handle(IPC.Ai.IntroCancel, (_e, payload: { requestId?: string }): boolean => {
    const c = activeStreams.get(payload?.requestId ?? '')
    c?.abort()
    return true
  })

  // ── 流式：润色 ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.Ai.Polish, async (event, args: AiPolishArgs): Promise<AiResult<string>> => {
    const requestId = args?.requestId || randomUUID()
    return runStreaming(requestId, (signal) =>
      isAiMock()
        ? mockPolish(args, (d) => sendChunk(event.sender, 'ai:polish:chunk', requestId, d))
        : runPolish(args, (d) => sendChunk(event.sender, 'ai:polish:chunk', requestId, d), signal)
    )
  })
  ipcMain.handle(IPC.Ai.PolishCancel, (_e, payload: { requestId?: string }): boolean => {
    const c = activeStreams.get(payload?.requestId ?? '')
    c?.abort()
    return true
  })

  // ── 非流式：匹配打分（generateObject）─────────────────────────────────
  ipcMain.handle(IPC.Ai.Match, async (_e, args: AiMatchArgs): Promise<AiResult<unknown>> => {
    try {
      return ok(isAiMock() ? await mockMatch(args) : await runMatch(args))
    } catch (err) {
      return { ok: false, error: toAiError(err) }
    }
  })

  // ── 配置：读（脱敏视图）────────────────────────────────────────────────
  ipcMain.handle(IPC.Ai.ConfigGet, async (): Promise<AiResult<AiConfigView>> => {
    try {
      return ok(await buildConfigView())
    } catch (err) {
      return { ok: false, error: toAiError(err) }
    }
  })

  // ── 2026-08-09：重置全部 AI 配置为系统预设默认值 ────────────────────────
  ipcMain.handle(IPC.Ai.ConfigReset, async (): Promise<AiResult<boolean>> => {
    try {
      await resetAiConfig()
      return ok(true)
    } catch (err) {
      return { ok: false, error: toAiError(err) }
    }
  })

  // ── 配置：保存（apiKey → safeStorage；其余 → store；custom 增删）────────
  ipcMain.handle(IPC.Ai.ConfigSave, async (_e, raw: unknown): Promise<AiResult<boolean>> => {
    try {
      const args = AiConfigSaveArgsSchema.parse(raw) as AiConfigSaveArgs
      if (args.addCustom) {
        const id = randomUUID()
        const providerId = `custom:${id}`
        const customs = store.get('customProviders') ?? []
        customs.push({
          id,
          name: args.addCustom.name,
          baseURL: args.addCustom.baseURL,
          modelId: args.addCustom.modelId ?? '',
          enabled: args.addCustom.enabled ?? false,
          createdAt: new Date().toISOString()
        })
        store.set('customProviders', customs)
        if (args.addCustom.apiKey !== undefined) await setApiKey(providerId, args.addCustom.apiKey)
        return ok(true)
      }
      if (args.deleteCustom) {
        const id = args.deleteCustom.replace(/^custom:/, '')
        store.set(
          'customProviders',
          (store.get('customProviders') ?? []).filter((c) => c.id !== id)
        )
        await setApiKey(args.deleteCustom, undefined)
        return ok(true)
      }
      if (args.providerId) {
        const { providerId } = args
        if (providerId.startsWith('custom:')) {
          const id = providerId.replace(/^custom:/, '')
          const customs = store.get('customProviders') ?? []
          const idx = customs.findIndex((c) => c.id === id)
          if (idx < 0) throw new AiServiceError('CONFIG_INVALID', `unknown provider: ${providerId}`)
          const patch = {
            ...customs[idx],
            ...(args.name !== undefined ? { name: args.name } : {}),
            ...(args.modelId !== undefined ? { modelId: args.modelId } : {}),
            ...(args.baseURL !== undefined ? { baseURL: args.baseURL } : {}),
            ...(args.enabled !== undefined ? { enabled: args.enabled } : {})
          }
          customs[idx] = patch
          store.set('customProviders', customs)
        } else {
          const providers = store.get('providers')
          const cur = providers[providerId as keyof typeof providers]
          if (!cur) throw new AiServiceError('CONFIG_INVALID', `unknown provider: ${providerId}`)
          store.set('providers', {
            ...providers,
            [providerId]: {
              ...cur,
              // 2026-08-09 R3：内置名称/接口地址支持覆盖（仅增不改；apiKey 仍走 safeStorage）
              ...(args.name !== undefined ? { name: args.name } : {}),
              ...(args.baseURL !== undefined ? { baseURL: args.baseURL } : {}),
              ...(args.modelId !== undefined ? { modelId: args.modelId } : {}),
              ...(args.enabled !== undefined ? { enabled: args.enabled } : {})
            }
          })
        }
        if (args.apiKey !== undefined) await setApiKey(providerId, args.apiKey)
      }
      if (args.temperature !== undefined) store.set('temperature', args.temperature)
      if (args.maxTokens !== undefined) store.set('maxTokens', args.maxTokens)
      if (args.prompts !== undefined) {
        if (args.prompts === null) store.delete('aiPrompts')
        else store.set('aiPrompts', args.prompts)
      }
      return ok(true)
    } catch (err) {
      if (err instanceof AiServiceError) return { ok: false, error: { code: err.code, message: err.message } }
      if (err instanceof Error && err.name === 'ZodError') {
        return { ok: false, error: { code: 'CONFIG_INVALID', message: err.message } satisfies AiError }
      }
      return { ok: false, error: toAiError(err) }
    }
  })

  // ── 2026-08-09 T3/R3：检测模型（临时 apiKey+modelId(+baseURL) 验证，不入库）────
  ipcMain.handle(IPC.Ai.ConfigTest, async (_e, raw: unknown): Promise<AiResult<boolean>> => {
    try {
      const args = raw as AiConfigTestArgs
      if (!args || typeof args.apiKey !== 'string' || args.apiKey.trim() === '') {
        return { ok: false, error: { code: 'NO_API_KEY' } satisfies AiError }
      }
      if (typeof args.modelId !== 'string' || args.modelId.trim() === '') {
        return { ok: false, error: { code: 'NO_API_KEY' } satisfies AiError }
      }
      // R3：custom/volcengine 透传 baseURL（兼容通道用输入值检测）
      await testProvider(args.providerId, args.apiKey.trim(), args.modelId.trim(), args.baseURL)
      return ok(true)
    } catch {
      // 模型无响应（key/model 无效、网络失败等）→ 统一提示模型未响应
      return { ok: false, error: { code: 'MODEL_NO_RESPONSE' } satisfies AiError }
    }
  })
}
