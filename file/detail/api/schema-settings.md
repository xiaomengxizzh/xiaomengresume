# schema/settings.ts（Zod 数据模型 · 自动生成）

> 本文件由 `scripts/gen_api_docs.mjs` 自动生成，**禁止手写**。事实源 = `src/shared/schema/settings.ts`。

SettingsSchema —— M0 令牌地基
仅冻结「字段类型 + 缺省值 + 迁移兼容」，实际 UI / IPC / 主进程接入随里程碑（M1/M3/M5）。
定案依据：《项目实现情况.md》§2.3 M0 顺手打令牌地基 +《技术栈.md》§3.11/§3.15。

## 导出

### `ProviderSchema`

```ts
z.object({
  /** 2026-08-09 R3：服务商显示名覆盖（内置缺省 = BUILTIN_INFO.name，持久化覆盖值） */
  name: z.string().max(64).optional(),
  /** 2026-08-09 R3：接口地址覆盖（内置缺省 = BUILTIN_INFO.baseURL） */
  baseURL: z.string().url().max(2048).optional(),
  apiKey: z.string().optional(),
  modelId: z.string().optional(),
  enabled: z.boolean().default(false)
})
```

### `AiPromptsSchema`

```ts
z.object({
  grammar: z.string(),
  intro: z.string(),
  polish: z.string(),
  match: z.string(),
  /** R7：豆包视觉模型提示词（M4b 图片/扫描件信息提取；与简历提示词分开设置） */
  vision: z.string()
})
```

### `SettingsSchema`

```ts
z.object({
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
```

### `TemplateOverrideSchema`

```ts
z.object({
  baseFontSize: z.number().min(9).max(24).optional(),
  lineHeight: z.number().min(1).max(3).optional(),
  pagePadding: z.number().min(0).max(80).optional(),
  paragraphSpacing: z.number().min(0).max(40).optional(),
  sectionSpacing: z.number().min(0).max(60).optional(),
  headerSize: z.number().min(12).max(36).optional(),
  resumeFont: z.string().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** 节标题风格（underline/accent-bar/compact 三选一，覆盖 variant 默认） */
  titleStyle: z.enum(['underline', 'accent-bar', 'compact']).optional()
})
```

