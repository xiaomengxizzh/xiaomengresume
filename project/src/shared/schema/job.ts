/**
 * JobSchema —— F19 岗位目录数据层（R 批定案 · 数据层 M1 顺带落码，UI/AI 消费随 v1.1）
 * 依据：《项目功能.md》F19 数据层落地点（WP-R1）。岗位存 userData/jobs/<id>.json 与简历平行。
 * appliedAt 复用 F1 的 DateStr 形态（宽松 YYYY / YYYY-MM，允许空串）。
 */
import { z } from 'zod'
import { DateStrSchema } from './resume'

export const JobSchema = z.object({
  /** 岗位唯一 id（uuid v4） */
  id: z.uuid(),
  /** 岗位名称（展示名，文件命名依据） */
  name: z.string().min(1),
  /** 投递时间，复用 F1 DateStr */
  appliedAt: DateStrSchema,
  /** 岗位要求（纯文本，供润色/打分消费） */
  requirements: z.string(),
  /** ISO 8601，主进程写入 */
  createdAt: z.string(),
  updatedAt: z.string()
})
export type Job = z.infer<typeof JobSchema>

/** 新建岗位工厂（uuid + 当前时间戳） */
export function createEmptyJob(name = ''): Job {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    appliedAt: '',
    requirements: '',
    createdAt: now,
    updatedAt: now
  }
}
