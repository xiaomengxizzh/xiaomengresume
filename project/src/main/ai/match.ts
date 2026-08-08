/**
 * ai/match.ts —— F9 岗位匹配度打分（M3 落码，R 批 WP-R3 + T 批 WP-T2）
 * 依据：file/detail/functions/F09_岗位匹配度打分.md：generateObject + MatchScoreSchema；
 * JD 解析优先级 = resume.boundJobIds → jobId.requirements > resume.targetJobDescription（兼容保留）>
 * 无 JD → CONFIG_INVALID（前端在未选岗位时已拦截提示）。
 */
import { generateObject } from 'ai'
import { MatchScoreSchema, type MatchScore } from '../../shared/schema/match'
import type { AiMatchArgs } from '../../shared/ipc-channels'
import { AiServiceError, getAiPrompt } from './config'
import { createActiveModel } from './client'
import { openResume } from '../files/resume-store'
import { getJob } from '../files/job-store'
import { buildResumeText, richTextToPlain } from './text'

/** 岗位匹配打分（非流式，一次返回 MatchScore） */
export async function runMatch(args: AiMatchArgs): Promise<MatchScore> {
  const { resumeId, jobId } = args
  const resume = await openResume(resumeId)

  // JD 解析：绑定岗位 requirements 优先；targetJobDescription 兼容兜底
  let jd = ''
  const job = await getJob(jobId).catch(() => null)
  if (job?.requirements?.trim()) jd = job.requirements.trim()
  if (!jd && resume.targetJobDescription) jd = richTextToPlain(resume.targetJobDescription)
  if (!jd) throw new AiServiceError('CONFIG_INVALID', 'ai:match: no JD (bind a job with requirements first)')

  const { model, temperature, maxTokens } = await createActiveModel()
  const { object } = await generateObject({
    model,
    schema: MatchScoreSchema,
    prompt: `${getAiPrompt('match')}\n\n岗位要求（JD）：\n${jd}\n\n简历内容：\n${buildResumeText(resume)}`,
    temperature,
    maxOutputTokens: maxTokens
  })
  return MatchScoreSchema.parse(object)
}
