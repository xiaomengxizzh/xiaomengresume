/**
 * SettingsSchema —— M0 令牌地基
 * 仅冻结「字段类型 + 缺省值 + 迁移兼容」，实际 UI / IPC / 主进程接入随里程碑（M1/M3/M5）。
 * 定案依据：《项目实现情况.md》§2.3 M0 顺手打令牌地基 +《技术栈.md》§3.11/§3.15。
 */
import { z } from 'zod'

/** 4 色主题（F18 五次定案，2026-08-06 全量替换） */
export const APPEARANCE_VALUES = ['light', 'dark', 'beige', 'green'] as const
export type Appearance = (typeof APPEARANCE_VALUES)[number]

/** 主题模式：仅 dark 可跟随系统，其余三色固定 */
export const APPEARANCE_MODE_VALUES = ['fixed', 'system'] as const
export type AppearanceMode = (typeof APPEARANCE_MODE_VALUES)[number]

export const LANGUAGE_VALUES = ['zh-CN', 'en'] as const
export type Language = (typeof LANGUAGE_VALUES)[number]

/** AI 服务商（F12 / #17 拍板：四服务商均纳入） */
export const PROVIDER_IDS = ['deepseek', 'volcengine', 'openai', 'google'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export const ProviderSchema = z.object({
  apiKey: z.string().optional(),
  modelId: z.string().optional(),
  enabled: z.boolean().default(false)
})
export type Provider = z.infer<typeof ProviderSchema>

/** AI 提示词（R 批：aiPrompts 四键） */
export const AI_PROMPT_KEYS = ['grammar', 'intro', 'polish', 'match'] as const
export type AiPromptKey = (typeof AI_PROMPT_KEYS)[number]

export const AiPromptsSchema = z.object({
  grammar: z.string(),
  intro: z.string(),
  polish: z.string(),
  match: z.string()
})
export type AiPrompts = z.infer<typeof AiPromptsSchema>

/**
 * 全局设置 —— M0 只冻结骨架字段（五段），后续里程碑段落级追加：
 * - M0：appearance / appearanceMode / language（F18/F13 字段地基）
 * - M1/M5：storage（F21 简历存储位置，S 批）
 * - M3：temperature / maxTokens / providers / aiPrompts（S/T 批）
 */
export const SettingsSchema = z.object({
  /** F18 外观主题（默认 light，沿用 3.15.1 线框基线） */
  appearance: z.enum(APPEARANCE_VALUES).default('light'),
  /** 主题模式（默认 fixed；仅 dark + system 时跟随系统） */
  appearanceMode: z.enum(APPEARANCE_MODE_VALUES).default('fixed'),
  /** F13 语言（T 批 #24：默认 zh-CN，不跟系统解析） */
  language: z.enum(LANGUAGE_VALUES).default('zh-CN'),

  /** F12 AI 全局参数（S 批 WP-S2） */
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().int().min(1).max(32768).default(4096),

  /** F12 AI 服务商（S 批 WP-S2，apiKey 走 safeStorage 不入此表） */
  providers: z
    .object({
      deepseek: ProviderSchema,
      volcengine: ProviderSchema,
      openai: ProviderSchema,
      google: ProviderSchema
    })
    .default(() => ({
      deepseek: { enabled: false },
      volcengine: { enabled: false },
      openai: { enabled: false },
      google: { enabled: false }
    })),

  /** R 批 aiPrompts（缺省回退内置默认，主进程统一处理） */
  aiPrompts: AiPromptsSchema.optional(),

  /** M3 Q10（2026-08-09 拍板）：自定义 OpenAI 兼容服务商（仅增不改；apiKey 走 safeStorage 按 id 存） */
  customProviders: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1).max(64),
        baseURL: z.string().max(2048),
        modelId: z.string().max(256).optional(),
        enabled: z.boolean().default(false),
        createdAt: z.string()
      })
    )
    .default([]),

  /** F21 简历存储位置（S 批 WP-S3，#18 = 方案 B 主存迁移） */
  storage: z
    .object({
      folderPath: z.string().optional()
    })
    .default(() => ({})),

  /** M2 F5：导出记忆（#22：记忆用户上次导出目录） */
  export: z
    .object({
      lastFolder: z.string().optional()
    })
    .default(() => ({})),

  /** T 批 #23 字体系统（T4） */
  uiFont: z.string().default('system'),
  resumeFont: z.string().default('system'),
  importedFonts: z
    .array(
      z.object({
        id: z.string(),
        fileName: z.string(),
        family: z.string(),
        addedAt: z.string()
      })
    )
    .default([])
})
export type Settings = z.infer<typeof SettingsSchema>

/** 缺省设置快照（新建 / 重置用；主进程为唯一事实源） */
export function defaultSettings(): Settings {
  return SettingsSchema.parse({})
}
