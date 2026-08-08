/**
 * ai/polish.ts —— F7 简历润色（M3 落码，R 批 WP-R3 + T 批 WP-T2 选岗注入）
 * 依据：file/detail/functions/F07_AI_润色.md：入口在编辑器内（选区优先/无选中整字段），
 * 流式输出润色文本；jobId 存在时经 job-store 取 requirements 注入 instructions（仅风格对齐，
 * 禁编造）；text 由渲染层传入（含选区快照语义，range 失效由渲染层拦截）。
 */
import { streamText } from 'ai'
import type { AiPolishArgs } from '../../shared/ipc-channels'
import { AiServiceError, getAiPrompt } from './config'
import { createActiveModel } from './client'
import { getJob } from '../files/job-store'

/** 润色（流式；onDelta 推送增量；signal 中断 → 抛 CANCELLED） */
export async function runPolish(
  args: AiPolishArgs,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { text, jobId } = args
  if (!text || !text.trim()) throw new AiServiceError('CONFIG_INVALID', 'ai:polish: empty text')
  let prompt = getAiPrompt('polish')
  if (jobId) {
    const job = await getJob(jobId).catch(() => null)
    if (job?.requirements?.trim()) {
      prompt += `\n\n目标岗位要求（仅风格对齐参考，禁止引入其中简历未涵盖的事实）：\n${job.requirements}`
    }
  }
  const { model, temperature, maxTokens } = await createActiveModel()
  const result = await streamText({
    model,
    prompt: `${prompt}\n\n待润色文本：\n${text}`,
    temperature,
    maxOutputTokens: maxTokens,
    abortSignal: signal
  })
  let full = ''
  for await (const part of result.stream) {
    const delta = part.type === 'text-delta' ? (part as { delta?: string }).delta ?? '' : ''
    if (delta) {
      full += delta
      onDelta(delta)
    }
  }
  return full
}
