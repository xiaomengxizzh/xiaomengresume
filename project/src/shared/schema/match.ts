/**
 * MatchScoreSchema —— F9 岗位匹配度打分返回结构（R 批定案，M3 冻结）
 * 依据：《项目功能.md》F9 + file/detail/functions/F09_岗位匹配度打分.md。
 * suggestions[].field 指向简历字段路径（供「去润色」跳转 F7）。
 */
import { z } from 'zod'

export const MatchDimensionSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  comment: z.string()
})
export type MatchDimension = z.infer<typeof MatchDimensionSchema>

export const MatchSuggestionSchema = z.object({
  field: z.string(),
  text: z.string(),
  priority: z.enum(['high', 'medium', 'low']).optional()
})
export type MatchSuggestion = z.infer<typeof MatchSuggestionSchema>

export const MatchScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  dimensions: z.array(MatchDimensionSchema).default([]),
  suggestions: z.array(MatchSuggestionSchema).default([])
})
export type MatchScore = z.infer<typeof MatchScoreSchema>
