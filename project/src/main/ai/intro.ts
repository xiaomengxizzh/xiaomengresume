/**
 * ai/intro.ts —— F20 自我介绍生成/翻译（M3 落码，R 批 WP-R3 + T 批 WP-T6）
 * 依据：file/detail/functions/F20_AI_自我介绍生成.md：streamText 流式 + 接受/放弃；
 * mode=generate 输入 = buildResumeText（禁注入岗位 requirements，防诱导编造）；
 * mode=translate 输入 = summary.content 纯文本（空则 CONFIG_INVALID），输出英文草稿。
 * 硬约束：翻译铁律在 translate 模式附加（不另起 prompt key）。
 */
import { streamText } from 'ai'
import type { AiIntroArgs } from '../../shared/ipc-channels'
import { AiServiceError, getAiPrompt } from './config'
import { createActiveModel } from './client'
import { openResume } from '../files/resume-store'
import { buildResumeText, richTextToPlain } from './text'

/** 翻译模式固定铁律（T6 定案；附加于 DEFAULT_AI_PROMPTS.intro 之后，不另起 key） */
export const TRANSLATE_RULE =
  '\n\n附加要求（翻译模式）：忠实翻译、保留原意、禁编造简历外事实（只能翻译 summary.content 已有内容，不虚构/不夸大任何简历未涵盖的事实）、术语准确、输出纯文本（不包裹解释 / 代码块 / 前缀）。'

/** 自我介绍（流式；onDelta 推送增量；signal 中断 → 抛 CANCELLED） */
export async function runIntro(
  args: AiIntroArgs,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const { resumeId, mode } = args
  const resume = await openResume(resumeId)
  const base = getAiPrompt('intro')

  let input: string
  let label: string
  if (mode === 'translate') {
    input = richTextToPlain(resume.summary.content)
    if (!input.trim()) throw new AiServiceError('CONFIG_INVALID', 'ai:intro: summary.content is empty, cannot translate')
    label = '待翻译文本'
  } else {
    input = buildResumeText(resume)
    if (!input.trim()) throw new AiServiceError('CONFIG_INVALID', 'ai:intro: resume is empty')
    label = '简历事实'
  }

  const prompt = mode === 'translate' ? `${base}${TRANSLATE_RULE}` : base
  const { model, temperature, maxTokens } = await createActiveModel()
  const result = await streamText({
    model,
    prompt: `${prompt}\n\n${label}：\n${input}`,
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
