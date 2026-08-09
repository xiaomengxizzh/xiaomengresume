/**
 * ResumeSchema —— M1 F1 数据模型（地基 · 契约冻结点）
 * 依据：《项目功能.md》F1 字段集最终清单（WP-P1）+ 2026-08-07 增补
 * （basics 扩展 birthDate/employmentStatus/customFields/fieldOrder、条目 visible、顶层 layout）
 * + WP-T1 meta（F11 最近简历）+ WP-T2 boundJobIds（F19 多值扩展，数据层 M1 顺带落码）。
 *
 * 铁律（《项目规范.md》§4.2）：schemaVersion 首字段 + 版本化迁移；仅增不改不升版本。
 * 注意：本文件中的中文枚举值（skills.level / languages.proficiency）为 F1 字段集定案数据值，
 * 非 UI 文案（CH4 扫描登记豁免）；UI 展示经 i18n 映射（见《项目功能.md》F1 §2.6/§2.8）。
 */
import { z } from 'zod'

// ── 公共类型 ──────────────────────────────────────────────────────────────

/** RichText：Tiptap JSON 文档，解析失败降级为 HTML 字符串 */
export const RichTextSchema = z.union([
  z.object({
    type: z.literal('doc'),
    content: z.array(z.record(z.string(), z.unknown())) // Tiptap node 数组
  }),
  z.string().startsWith('<') // 降级 HTML
])
export type RichText = z.infer<typeof RichTextSchema>

/** 空文档默认值（Tiptap 空内容） */
export const EMPTY_DOC: RichText = { type: 'doc', content: [] } as const

/** 日期：宽松 YYYY / YYYY-MM，允许空串（"至今" 语义由 endDate 为空表达） */
export const DateStrSchema = z
  .string()
  .regex(/^\d{4}(-\d{2})?$/, 'Date should be YYYY or YYYY-MM')
  .or(z.literal(''))
  .optional()
export type DateStr = z.infer<typeof DateStrSchema>

/** 稳定 id（uuid v4，新建时由 crypto.randomUUID() 生成） */
export const Uuid = z.uuid()

// ── basics 扩展结构（2026-08-07 增补）──────────────────────────────────────

/** 自定义字段：字段集外的自由信息（个人网站 / 微信 / 开源主页等） */
export const CustomFieldSchema = z.object({
  id: Uuid,
  label: z.string(), // 显示名，如「个人网站」
  value: z.string(),
  icon: z.string().optional() // lucide 图标名（示例 JSON 用 "Globe"）
})
export type CustomField = z.infer<typeof CustomFieldSchema>

/** 字段编排：控制 basics 各字段的显示顺序与可见性（数据层预留，UI 归 L2） */
export const FieldOrderSchema = z.object({
  key: z.string(), // 对应 basics 字段名（name / phone / birthDate ...）
  visible: z.boolean(),
  order: z.number().int().nonnegative()
})
export type FieldOrder = z.infer<typeof FieldOrderSchema>

/** 基础信息条目（2026-08-07 增补 · PDF 顶部两列布局）：icon+label+value，按顺序两列展示 */
import { INFO_ICON_IDS, type InfoIconId } from '../constants/info-icons'

export const InfoItemSchema = z.object({
  id: z.string(), // 稳定 key（写操作识别）
  icon: z.enum(INFO_ICON_IDS), // InfoIconId（共享字面量源）
  label: z.string(), // 显示标签（可选，PDF 不显标签但保留扩展位）
  value: z.string() // 展示值（自由文本）
})
/** 手写类型（zod enum + array.optional() 在 z.infer 下宽化为 string union，手写避免类型宽化） */
export type InfoItem = {
  id: string
  icon: InfoIconId
  label: string
  value: string
}

// ── 8 sections ─────────────────────────────────────────────────────────────

/** 2.1 basics（基本信息 · 单对象） */
export const BasicsSchema = z.object({
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
export type Basics = z.infer<typeof BasicsSchema>

/** 2.2 summary（自我评价 · 单对象） */
export const SummarySchema = z.object({
  content: RichTextSchema,
  /** F20 翻译模式写入；为空表示尚未生成英文版（v1 仅落数据层） */
  enContent: RichTextSchema.optional()
})
export type Summary = z.infer<typeof SummarySchema>

/** 2.3 education（教育经历 · 数组） */
export const EducationSchema = z.object({
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
export type Education = z.infer<typeof EducationSchema>

/** 2.4 work（工作经历 · 数组） */
export const WorkSchema = z.object({
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
export type Work = z.infer<typeof WorkSchema>

/** 2.5 projects（项目经历 · 数组） */
export const ProjectsSchema = z.object({
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
export type Projects = z.infer<typeof ProjectsSchema>

/** 2.6 skills（技能 · 数组）—— level 中文枚举为 F1 定案数据值（CH4 豁免） */
export const SKILL_LEVELS = ['了解', '熟练', '精通'] as const
export type SkillLevel = (typeof SKILL_LEVELS)[number]

export const SkillsSchema = z.object({
  id: Uuid,
  name: z.string().default(''),
  category: z.string().optional(),
  level: z.enum(SKILL_LEVELS).optional()
})
export type Skills = z.infer<typeof SkillsSchema>

/** 2.7 certificates（证书 · 数组） */
export const CertificatesSchema = z.object({
  id: Uuid,
  name: z.string().default(''),
  issuer: z.string().optional(),
  date: DateStrSchema,
  url: z.string().optional() // 同 basics.email：放宽（z.url() 与默认 '' 矛盾）
})
export type Certificates = z.infer<typeof CertificatesSchema>

/** 2.8 languages（语言 · 数组）—— proficiency 中文枚举为 F1 定案数据值（CH4 豁免） */
export const LANGUAGE_PROFICIENCIES = ['母语', '流利', '熟练', '基础'] as const
export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number]

export const LanguagesSchema = z.object({
  id: Uuid,
  name: z.string().default(''),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES).optional()
})
export type Languages = z.infer<typeof LanguagesSchema>

// ── 2.9 layout（排版参数 · 单对象，2026-08-07 增补）───────────────────────
// 覆盖链：简历 layout > 模板预设 > 全局设置初始值；全 optional，缺省回落模板预设。

export const LayoutSchema = z.object({
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
  sectionOrder: z.array(z.string()).optional()
})
export type Layout = z.infer<typeof LayoutSchema>

/** 自定义模块（2026-08-09 增补，仅增不改）：用户新建的非基本信息模块（兴趣爱好/获奖等）。
 *  基本信息为固定模块不可新建；自定义模块可增删，显示顺序由 layout.sectionOrder 编排。 */
export const CustomSectionSchema = z.object({
  id: Uuid,
  title: z.string().default(''),
  /** 富文本正文（Tiptap doc / 降级 HTML） */
  content: RichTextSchema.optional()
})
export type CustomSection = z.infer<typeof CustomSectionSchema>

/** F11 WP-T1：meta 元数据（主进程写入的活动时间戳，仅增不改） */
export const ResumeMetaSchema = z
  .object({
    createdAt: z.string().optional(), // ISO 8601，主进程首次创建时写入
    updatedAt: z.string().optional(), // ISO 8601，resume:save 时刷新
    lastOpenedAt: z.string().optional() // ISO 8601，resume:open 时刷新
  })
  .optional()
export type ResumeMeta = z.infer<typeof ResumeMetaSchema>

// ── 顶层 ResumeSchema 与版本化 ────────────────────────────────────────────

export const ResumeSchema = z.object({
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
export type Resume = z.infer<typeof ResumeSchema>

/** 默认空简历工厂（layout / targetJobDescription / meta 省略 = 回落模板预设）。
 *  P2 修复：EMPTY_DOC 为模块级共享常量，直接引用会令 basics.profile 与 summary.content
 *  恒等别名（编辑一处污染另一处），且所有新简历共享同一对象——此处按次独立克隆。 */
export function createEmptyResume(): Resume {
  const emptyDoc = (): RichText => ({ type: 'doc', content: [] })
  return {
    schemaVersion: 1,
    basics: {
      name: '',
      englishName: '',
      phone: '',
      email: '',
      address: '',
      location: '',
      website: '',
      photo: '',
      headline: '',
      profile: emptyDoc(),
      birthDate: '',
      employmentStatus: '',
      customFields: []
    },
    summary: { content: emptyDoc() },
    education: [],
    work: [],
    projects: [],
    skills: [],
    certificates: [],
    languages: [],
    boundJobIds: []
  }
}

/**
 * 版本迁移入口：所有导入 / 反序列化先过 migrate() 再 parse。
 * 每次改 schema → 升 schemaVersion → 加对应 case（《项目规范.md》§4.2）。
 * 无版本号视为最旧（v0）→ 抛错（M4 导入转换器负责 HTML→Tiptap 后再进此函数）。
 */
export function migrate(data: unknown): Resume {
  const v =
    data && typeof data === 'object' && 'schemaVersion' in data
      ? (data as { schemaVersion?: unknown }).schemaVersion
      : 0

  switch (v) {
    case 1:
      // 当前版本：直通校验，返回强类型 Resume
      return ResumeSchema.parse(data)

    // 未来升级示例（M1 后如需新增字段）：
    // case 1 升 2 时：
    //   case 2: {
    //     const v1 = migrate({ ...data, schemaVersion: 1 }); // 先回退到上一版
    //     const upgraded = {
    //       ...v1,
    //       schemaVersion: 2,
    //       // 新增字段补默认值
    //     };
    //     return ResumeSchema.parse(upgraded);
    //   }

    default:
      throw new Error(`Unsupported schemaVersion: ${String(v)}`)
  }
}
