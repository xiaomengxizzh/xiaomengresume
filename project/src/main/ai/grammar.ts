/**
 * ai/grammar.ts —— F8 语法纠正（M3 落码，R 批 WP-R3 / T 批扩展）
 * 依据：file/detail/functions/F08_AI_语法检查.md：generateObject + GrammarIssueSchema；
 * scope=selection 用渲染层传入 text；scope=full 主进程按 resumeId 读简历逐字段收集、
 * 每字段独立调用（偏移各自归零）；返回 GrammarIssue[]（0-based、to exclusive）。
 */
import { generateObject } from 'ai'
import { z } from 'zod'
import { GrammarIssueSchema, type GrammarIssue } from '../../shared/schema/grammar'
import type { AiGrammarArgs } from '../../shared/ipc-channels'
import { AiServiceError, getAiPrompt } from './config'
import { createActiveModel } from './client'
import { openResume } from '../files/resume-store'
import { richTextToPlain } from './text'
import type { Resume } from '../../shared/schema/resume'

/** 收集可检查字段文本（全文模式；空字段跳过） */
export function collectResumeSegments(resume: Resume): Array<{ field: string; text: string }> {
  const segs: Array<{ field: string; text: string }> = []
  const push = (field: string, rt?: unknown): void => {
    const text = richTextToPlain(rt as never)
    if (text.trim()) segs.push({ field, text })
  }
  push('basics.headline', resume.basics.headline)
  push('basics.profile', resume.basics.profile)
  push('summary.content', resume.summary.content)
  resume.education.forEach((e, i) => push(`education[${i}].description`, e.description))
  resume.work.forEach((w, i) => {
    push(`work[${i}].summary`, w.summary)
    w.highlights.forEach((h, j) => push(`work[${i}].highlights[${j}]`, h))
  })
  resume.projects.forEach((p, i) => {
    push(`projects[${i}].description`, p.description)
    p.highlights.forEach((h, j) => push(`projects[${i}].highlights[${j}]`, h))
  })
  return segs
}

/** 单段语法检查（generateObject 一次调用） */
async function checkSegment(text: string): Promise<GrammarIssue[]> {
  const { model, temperature, maxTokens } = await createActiveModel()
  const prompt = getAiPrompt('grammar')
  const { object } = await generateObject({
    model,
    schema: z.array(GrammarIssueSchema),
    prompt: `${prompt}\n\n待检查文本：\n${text}`,
    temperature,
    maxOutputTokens: maxTokens
  })
  // 防御：模型可能返回偏移越界 → 过滤，防渲染层 insertContentAt 越界
  return (Array.isArray(object) ? object : []).filter(
    (g) => g.from >= 0 && g.to >= g.from && g.to <= text.length
  )
}

/** 语法检查（selection：单段；full：逐字段，结果按字段携带 field 引用） */
export async function runGrammar(args: AiGrammarArgs): Promise<Array<GrammarIssue & { field: string }>> {
  const { resumeId, scope, text } = args
  const out: Array<GrammarIssue & { field: string }> = []
  if (scope === 'selection') {
    if (!text || !text.trim()) throw new AiServiceError('CONFIG_INVALID', 'ai:grammar: selection requires text')
    const issues = await checkSegment(text)
    for (const g of issues) out.push({ ...g, field: '' })
    return out
  }
  const resume = await openResume(resumeId)
  for (const seg of collectResumeSegments(resume)) {
    const issues = await checkSegment(seg.text)
    for (const g of issues) out.push({ ...g, field: seg.field })
  }
  return out
}
