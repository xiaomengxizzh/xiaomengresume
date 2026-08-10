# schema/resume.ts（Zod 数据模型 · 自动生成）

> 本文件由 `scripts/gen_api_docs.mjs` 自动生成，**禁止手写**。事实源 = `src/shared/schema/resume.ts`。

ResumeSchema —— M1 F1 数据模型（地基 · 契约冻结点）
依据：《项目功能.md》F1 字段集最终清单（WP-P1）+ 2026-08-07 增补
（basics 扩展 birthDate/employmentStatus/customFields/fieldOrder、条目 visible、顶层 layout）
+ WP-T1 meta（F11 最近简历）+ WP-T2 boundJobIds（F19 多值扩展，数据层 M1 顺带落码）。

铁律（《项目规范.md》§4.2）：schemaVersion 首字段 + 版本化迁移；仅增不改不升版本。
注意：本文件中的中文枚举值（skills.level / languages.proficiency）为 F1 字段集定案数据值，
非 UI 文案（CH4 扫描登记豁免）；UI 展示经 i18n 映射（见《项目功能.md》F1 §2.6/§2.8）。

## 导出

### `RichTextSchema`

```ts
z.union([
  z.object({
    type: z.literal('doc'),
    content: z.array(z.record(z.string(), z.unknown())) // Tiptap node 数组
  }),
  z.string().startsWith('<') // 降级 HTML
])
```

### `Uuid`

```ts
z.uuid()
```

### `CustomFieldSchema`

```ts
z.object({
  id: Uuid,
  label: z.string(), // 显示名，如「个人网站」
  value: z.string(),
  icon: z.string().optional() // lucide 图标名（示例 JSON 用 "Globe"）
})
```

### `FieldOrderSchema`

```ts
z.object({
  key: z.string(), // 对应 basics 字段名（name / phone / birthDate ...）
  visible: z.boolean(),
  order: z.number().int().nonnegative()
})
```

### `InfoItemSchema`

```ts
z.object({
  id: z.string(), // 稳定 key（写操作识别）
  icon: z.enum(INFO_ICON_IDS), // InfoIconId（共享字面量源）
  label: z.string(), // 显示标签（可选，PDF 不显标签但保留扩展位）
  value: z.string() // 展示值（自由文本）
})
```

### `BasicsSchema`

```ts
z.object({
  name: z.string().default(''),
  englishName: z.string().optional(),
  phone: z.string().optional(),
  // 注：F1 字段表 z.email() 与默认值 '' 矛盾（空串非合法 email），数据层宽松起步，
  // 格式校验归 UI 层轻提示（《项目日志》M1 条目登记此取舍）。
  email: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(), // 同上：z.url() 与默认 '' 矛盾，放宽
  photo: z.string().optional(),
  headline: z.string().optional(),
  profile: RichTextSchema.optional(), // 个人简介入口（短头部版）
  /** 2026-08-07 增补（仅增不改）：出生年月，隐私敏感默认不显示 */
  birthDate: DateStrSchema,
  /** 2026-08-07 增补（仅增不改）：在职状态（如「离职 / 在职」） */
  employmentStatus: z.string().optional(),
  /** 2026-08-07 增补（仅增不改）：自定义字段 */
  customFields: z.array(CustomFieldSchema).default([]),
  /** 2026-08-07 增补（仅增不改）：字段编排，缺省 = 按模板默认顺序全显示 */
  fieldOrder: z.array(FieldOrderSchema).optional(),
  /** 2026-08-07 增补（仅增不改）：基础信息条目，PDF 顶部两列布局；缺省由模板回退 */
  infoItems: z.array(InfoItemSchema).optional(),
  /** 2026-08-07 增补（仅增不改）：头像渲染尺寸（像素；PDF 示例宽 90 高 120） */
  photoWidth: z.number().int().min(40).max(400).optional(),
  photoHeight: z.number().int().min(40).max(400).optional()
})
```

### `SummarySchema`

```ts
z.object({
  content: RichTextSchema,
  /** F20 翻译模式写入；为空表示尚未生成英文版（v1 仅落数据层） */
  enContent: RichTextSchema.optional()
})
```

### `EducationSchema`

```ts
z.object({
  id: Uuid,
  school: z.string().default(''),
  degree: z.string().optional(),
  major: z.string().optional(),
  startDate: DateStrSchema,
  endDate: DateStrSchema,
  location: z.string().optional(),
  gpa: z.string().optional(),
  description: RichTextSchema.optional(),
  /** 2026-08-07 增补（仅增不改）：条目级显隐 */
  visible: z.boolean().optional()
})
```

### `WorkSchema`

```ts
z.object({
  id: Uuid,
  company: z.string().default(''),
  title: z.string().optional(),
  location: z.string().optional(),
  startDate: DateStrSchema,
  endDate: DateStrSchema,
  /** current=true 时 endDate 应为空（"至今"） */
  current: z.boolean().optional(),
  summary: RichTextSchema.optional(),
  highlights: z.array(RichTextSchema).default([]),
  visible: z.boolean().optional()
})
```

### `ProjectsSchema`

```ts
z.object({
  id: Uuid,
  name: z.string().default(''),
  role: z.string().optional(),
  organization: z.string().optional(),
  startDate: DateStrSchema,
  endDate: DateStrSchema,
  url: z.string().optional(), // 同 basics.email：放宽（z.url() 与默认 '' 矛盾）
  description: RichTextSchema.optional(),
  highlights: z.array(RichTextSchema).default([]),
  visible: z.boolean().optional()
})
```

### `SkillsSchema`

```ts
z.object({
  id: Uuid,
  name: z.string().default(''),
  category: z.string().optional(),
  level: z.enum(SKILL_LEVELS).optional()
})
```

### `CertificatesSchema`

```ts
z.object({
  id: Uuid,
  name: z.string().default(''),
  issuer: z.string().optional(),
  date: DateStrSchema,
  url: z.string().optional() // 同 basics.email：放宽（z.url() 与默认 '' 矛盾）
})
```

### `LanguagesSchema`

```ts
z.object({
  id: Uuid,
  name: z.string().default(''),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES).optional()
})
```

### `LayoutSchema`

```ts
z.object({
  templateId: z.string().optional(), // F4 registry id（classic / modern / compact）
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  baseFontSize: z.number().min(9).max(24).optional(),
  pagePadding: z.number().min(0).max(80).optional(),
  paragraphSpacing: z.number().min(0).max(40).optional(),
  lineHeight: z.number().min(1).max(3).optional(),
  sectionSpacing: z.number().min(0).max(60).optional(),
  headerSize: z.number().min(12).max(36).optional(),
  resumeFont: z.string().optional(), // 字体白名单 id / 字体名，缺省「系统默认」fallback 链
  /** 2026-08-07 UI 重构增补（仅增不改）：单元级字体覆盖，key = section 名（basics/summary/work…） */
  sectionFonts: z.record(z.string(), z.string()).optional(),
  /** 2026-08-09 增补（仅增不改）：模块显示顺序（education/work/projects/skills/certificates/languages
   *  + customSections.id；basics/summary 固定顶部不参与）。缺省 = 模板默认顺序。 */
  sectionOrder: z.array(z.string()).optional(),
  /** 2026-08-09 R6 增补（仅增不改）：基本信息三透明模块（图片/姓名与职业/标签信息）编辑区排序，
   *  同时驱动预览/PDF 头部三块横向排列顺序（photo=图片、identity=姓名与职业、tags=标签信息）。
   *  缺省 = ['photo','identity','tags']（经典模板布局）。 */
  basicsOrder: z.array(z.enum(['photo', 'identity', 'tags'])).optional()
})
```

### `CustomSectionSchema`

```ts
z.object({
  id: Uuid,
  title: z.string().default(''),
  /** 富文本正文（Tiptap doc / 降级 HTML） */
  content: RichTextSchema.optional()
})
```

### `ResumeSchema`

```ts
z.object({
  /** 首字段，版本化事实源（《项目规范.md》§4.2） */
  schemaVersion: z.literal(1),
  basics: BasicsSchema,
  summary: SummarySchema,
  education: z.array(EducationSchema),
  work: z.array(WorkSchema),
  projects: z.array(ProjectsSchema),
  skills: z.array(SkillsSchema),
  certificates: z.array(CertificatesSchema),
  languages: z.array(LanguagesSchema),
  /** 2026-08-09 增补（仅增不改，T3）：简历文件标题/显示名——与 basics.name（姓名）独立；
   *  列表/导出文件名优先用它，空则回落 basics.name；修改任一方不影响另一方。 */
  title: z.string().optional(),
  /** F9 扩展预留（可选，仅增不改）：岗位 JD，供匹配度打分 */
  targetJobDescription: RichTextSchema.optional(),
  /** 2026-08-07 增补（仅增不改）：per-resume 排版覆盖（F4 修订） */
  layout: LayoutSchema.optional(),
  /** F11 WP-T1（仅增不改）：主进程写入的活动时间戳 */
  meta: ResumeMetaSchema,
  /** F19 WP-T2（仅增不改，数据层 M1 顺带落码）：绑定岗位 id 列表（JobSchema.id[]） */
  boundJobIds: z.array(Uuid).default([]).describe('bound job id list; empty = no binding'),
  /** 2026-08-09 增补（仅增不改）：自定义模块（非基本信息，用户新建；顺序见 layout.sectionOrder） */
  customSections: z.array(CustomSectionSchema).optional()
})
```

