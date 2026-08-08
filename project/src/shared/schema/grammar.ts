/**
 * GrammarIssueSchema —— F8 语法纠正返回结构（R 批定案，M3 冻结）
 * 依据：《项目功能.md》F8 + file/detail/functions/F08_AI_语法检查.md。
 * 偏移约定：相对被检查文本的字符偏移，0-based，to exclusive；多字段逐字段独立调用、偏移各自归零。
 * suggestion 为空字符串 = 仅提示（无建议替换文本）。
 */
import { z } from 'zod'

export const GrammarIssueSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  message: z.string(),
  suggestion: z.string()
})
export type GrammarIssue = z.infer<typeof GrammarIssueSchema>
