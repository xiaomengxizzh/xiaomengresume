/**
 * AiConfigSaveArgsSchema —— ai:config:save 入参（M3 冻结，Q10 含自定义服务商）
 * 依据：《技术栈.md》§3.9.2（WP-S2）：apiKey 走 safeStorage、modelId/enabled 走明文 store；
 * apiKey 传非空 string 覆盖、传 '' 清除、缺省不动；custom 增删走 addCustom/deleteCustom。
 */
import { z } from 'zod'
import { AiPromptsSchema } from './settings'

export const AiConfigSaveArgsSchema = z
  .object({
    /** 更新目标（builtin id 或 'custom:<uuid>'）；addCustom 时省略 */
    providerId: z.string().min(1).max(128).optional(),
    apiKey: z.string().max(4096).optional(),
    modelId: z.string().max(256).optional(),
    /** 仅 custom */
    baseURL: z.string().url().max(2048).optional(),
    enabled: z.boolean().optional(),
    addCustom: z
      .object({
        name: z.string().min(1).max(64),
        baseURL: z.string().url().max(2048),
        modelId: z.string().max(256).optional(),
        apiKey: z.string().max(4096).optional(),
        enabled: z.boolean().optional()
      })
      .optional(),
    /** 'custom:<uuid>' */
    deleteCustom: z.string().min(1).max(128).optional(),
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().int().min(1).max(32768).optional(),
    /** 提示词覆盖；null = 还原为内置默认（删除 store 键） */
    prompts: AiPromptsSchema.nullable().optional()
  })
  .refine(
    (v) =>
      v.providerId !== undefined ||
      v.addCustom !== undefined ||
      v.deleteCustom !== undefined ||
      v.temperature !== undefined ||
      v.maxTokens !== undefined ||
      v.prompts !== undefined,
    { message: 'ai:config:save: empty save' }
  )
export type AiConfigSaveArgs = z.infer<typeof AiConfigSaveArgsSchema>
