/**
 * import-map.ts —— M4a 导入 AI 映射契约（src/shared 冻结，2026-08-09）
 * ImportMapSchema：AI `generateObject` 的简化结构化输出（全纯文本，不含富文本/Tiptap），
 * 宽松校验（字段全 optional + 自由字符串）——AI 输出天然有偏离，收口靠 importMapToResume 清洗。
 * importMapToResume()：纯文本 → RichText 单段落、日期规范化、枚举校验、migrate() 收口。
 * 依据：《技术栈.md》§三（ImportMapSchema → importMapToResume → migrate 定案）。
 */
import { z } from 'zod'
import {
  SKILL_LEVELS,
  LANGUAGE_PROFICIENCIES,
  createEmptyResume,
  migrate,
  type RichText,
  type SkillLevel,
  type LanguageProficiency,
  type Resume
} from './resume'

/* ── ImportMapSchema：AI 映射简化输出 ─────────────────────────────────── */

/** 宽松日期：AI 可能输出 2020 / 2020-09 / 2020.09 / 2020年9月，转换时规范化 */
const LooseDate = z.string().optional()

const MapEntryBase = {
  startDate: LooseDate,
  endDate: LooseDate
}

export const ImportMapSchema = z.object({
  basics: z
    .object({
      name: z.string().optional(),
      englishName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      location: z.string().optional(),
      website: z.string().optional(),
      headline: z.string().optional(),
      birthDate: z.string().optional(),
      /** 2026-08-09 T3：在职状态（在投/离职等） */
      employmentStatus: z.string().optional(),
      /** 2026-08-13 需求②：性别 / 年龄（正式基本字段） */
      gender: z.string().optional(),
      age: z.string().optional(),
      /** 个人简介（纯文本，映射到 basics.profile） */
      profile: z.string().optional(),
      /** 2026-08-10 导入标签全量：用户自定义基本信息标签（任意"标签:值"对，A 档模型直接输出；
       *  B 档本地规则识别未知 label 行。label ≤32、value ≤256 防脏数据（D7）） */
      customFields: z
        .array(
          z.object({
            label: z.string().min(1).max(32),
            value: z.string().max(256),
            /** 已知标签可附 icon（phone/mail/pin/globe/calendar/briefcase 等）；未知留空 → 渲染端兜底 pin */
            icon: z.string().max(32).optional()
          })
        )
        .optional()
    })
    .optional(),
  /** 自我评价（纯文本，映射到 summary.content） */
  summary: z.string().optional(),
  education: z
    .array(
      z.object({
        ...MapEntryBase,
        school: z.string().optional(),
        degree: z.string().optional(),
        major: z.string().optional(),
        location: z.string().optional(),
        gpa: z.string().optional(),
        description: z.string().optional()
      })
    )
    .optional(),
  work: z
    .array(
      z.object({
        ...MapEntryBase,
        company: z.string().optional(),
        title: z.string().optional(),
        location: z.string().optional(),
        current: z.boolean().optional(),
        summary: z.string().optional(),
        highlights: z.array(z.string()).optional()
      })
    )
    .optional(),
  projects: z
    .array(
      z.object({
        ...MapEntryBase,
        name: z.string().optional(),
        role: z.string().optional(),
        organization: z.string().optional(),
        url: z.string().optional(),
        description: z.string().optional(),
        highlights: z.array(z.string()).optional()
      })
    )
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string().optional(),
        category: z.string().optional(),
        /** 自由文本；转换时按 SKILL_LEVELS 精确匹配，非法 → undefined */
        level: z.string().optional()
      })
    )
    .optional(),
  certificates: z
    .array(
      z.object({
        name: z.string().optional(),
        issuer: z.string().optional(),
        date: LooseDate,
        url: z.string().optional()
      })
    )
    .optional(),
  languages: z
    .array(
      z.object({
        name: z.string().optional(),
        /** 自由文本；转换时按 LANGUAGE_PROFICIENCIES 精确匹配，非法 → undefined */
        proficiency: z.string().optional()
      })
    )
    .optional()
})
export type ImportMap = z.infer<typeof ImportMapSchema>

/* ── 清洗工具 ──────────────────────────────────────────────────────────── */

/** 空值归一：undefined / 空白 → ''（Resume 多数可选字段接 '' 安全） */
function clean(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.trim()
}

/** 日期规范化：接受 YYYY / YYYY-MM / YYYY/MM / YYYY.MM / YYYY年M月 → 'YYYY' | 'YYYY-MM'；非法 → '' */
function normalizeDate(s: unknown): string {
  const t = clean(s)
  if (!t) return ''
  const m = t.match(/^(\d{4})(?:[-/.年](\d{1,2}))?/)
  if (!m) return ''
  const month = m[2] ? String(Number(m[2])).padStart(2, '0') : ''
  return month ? `${m[1]}-${month}` : m[1]
}

/** 纯文本 → RichText（2026-08-09 增强：多行 → 多段落；全 bullet 行（•/-/* 前缀）→ bulletList。
 *  每次新建对象，防共享常量别名污染） */
function textToRichText(text: unknown): RichText {
  const t = clean(text)
  if (!t) return { type: 'doc', content: [] }
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { type: 'doc', content: [] }
  if (lines.every((l) => /^[•\-*]\s/.test(l))) {
    // 全部为要点行 → 单个 bulletList（对齐示例要点样式）
    return {
      type: 'doc',
      content: [bulletListOf(lines.map((l) => l.replace(/^[•\-*]\s/, '')))]
    }
  }
  return {
    type: 'doc',
    content: lines.map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] }))
  }
}

/** bulletList 构建（Tiptap listItem 结构，与 sample-resume「亮点合并为一框」定案一致） */
function bulletListOf(items: string[]): { type: 'bulletList'; content: unknown[] } {
  return {
    type: 'bulletList',
    content: items.map((t) => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }]
    }))
  }
}

/**
 * 要点合并（2026-08-09 排版修复）：highlights 并入 summary/description 的 bulletList。
 * 根因：模板（ResumeBody）只渲染 summary/description，不渲染 work/projects 的 highlights[]——
 * 原实现把 AI 要点塞 highlights[] 导致导入后要点全部丢失（排版错乱）。
 * 对齐 sample-resume 形态：概述 paragraph + 要点 bulletList（08-08「亮点合并为一框」定案）。
 */
function mergeHighlights(rt: RichText | undefined, highlights: string[]): RichText | undefined {
  const items = highlights.map((s) => clean(s)).filter(Boolean)
  if (items.length === 0) return rt
  const list = bulletListOf(items)
  // 降级 HTML（string 分支）：保留原样不合并（旧数据迁移场景，AI 导入输出为 doc 结构）
  if (typeof rt === 'string') return rt
  if (!rt || rt.type !== 'doc' || !rt.content || rt.content.length === 0) {
    return { type: 'doc', content: [list] }
  }
  return { type: 'doc', content: [...rt.content, list] }
}

const SKILL_LEVEL_SET = new Set<string>(SKILL_LEVELS)
function matchSkillLevel(s: unknown): SkillLevel | undefined {
  const t = clean(s)
  if (!t) return undefined
  return SKILL_LEVEL_SET.has(t) ? (t as SkillLevel) : undefined
}

const PROFICIENCY_SET = new Set<string>(LANGUAGE_PROFICIENCIES)
function matchProficiency(s: unknown): LanguageProficiency | undefined {
  const t = clean(s)
  if (!t) return undefined
  return PROFICIENCY_SET.has(t) ? (t as LanguageProficiency) : undefined
}

/** 条目过滤：关键字段全空 → 剔除（如 AI 输出空壳条目） */
function hasContent(entry: Record<string, unknown>): boolean {
  return Object.values(entry).some((v) => {
    if (typeof v === 'string') return v.trim() !== ''
    if (Array.isArray(v)) return v.length > 0
    return v !== undefined
  })
}

/* ── importMapToResume：宽松映射 → migrate 收口 ───────────────────────── */

/**
 * 将 AI 映射结果转为正式 Resume。
 * 宽进严出：ImportMapSchema 全宽松，此处清洗 + 生成 uuid + 枚举校验，
 * 最后过 migrate()（ResumeSchema.parse）收口——非法结构在此抛错（调用方转 PARSE_FAILED）。
 */
export function importMapToResume(map: ImportMap): Resume {
  const r = createEmptyResume()
  const b = map.basics

  // basics：仅覆盖非空字段（保留 createEmptyResume 的 '' 默认）
  if (b) {
    const name = clean(b.name)
    if (name) r.basics.name = name
    const englishName = clean(b.englishName)
    if (englishName) r.basics.englishName = englishName
    const phone = clean(b.phone)
    if (phone) r.basics.phone = phone
    const email = clean(b.email)
    if (email) r.basics.email = email
    const address = clean(b.address)
    if (address) r.basics.address = address
    const location = clean(b.location)
    if (location) r.basics.location = location
    const website = clean(b.website)
    if (website) r.basics.website = website
    const headline = clean(b.headline)
    if (headline) r.basics.headline = headline
    // 2026-08-10 修复：birthDate/employmentStatus 声明了但此前漏写（仅增不改）
    const birthDate = clean(b.birthDate)
    if (birthDate) r.basics.birthDate = birthDate
    const employmentStatus = clean(b.employmentStatus)
    if (employmentStatus) r.basics.employmentStatus = employmentStatus
    // 2026-08-13 需求②：性别/年龄正式字段
    const gender = clean(b.gender)
    if (gender) r.basics.gender = gender
    const age = clean(b.age)
    if (age) r.basics.age = age
    const profile = clean(b.profile)
    if (profile) r.basics.profile = textToRichText(profile)

    // 2026-08-10 导入标签全量：用户自定义标签（未知 label 对）直写 basics.customFields；
    // 去重：value 与固定字段（phone/email/address/location/website/birthDate/employmentStatus）重复的剔除，
    // 避免预览/导出 infoItems 重复显示（已知 6 类 label 已走固定字段 + 标准 icon）
    const fixedValues = new Set([r.basics.phone, r.basics.email, r.basics.address, r.basics.location, r.basics.website, r.basics.birthDate, r.basics.employmentStatus].filter((v): v is string => !!v))
    const customFields = (b.customFields ?? [])
      .filter((cf) => cf.value && cf.value.trim().length > 0 && !fixedValues.has(cf.value.trim()))
      .map((cf) => ({ id: crypto.randomUUID(), label: clean(cf.label) || cf.label, value: cf.value.trim(), ...(cf.icon ? { icon: cf.icon } : {}) }))
    if (customFields.length > 0) r.basics.customFields = customFields
  }

  // summary（纯文本 → content）
  const summary = clean(map.summary)
  if (summary) r.summary.content = textToRichText(summary)

  // education
  r.education = (map.education ?? [])
    .filter((e) => hasContent(e as unknown as Record<string, unknown>))
    .map((e) => ({
      id: crypto.randomUUID(),
      school: clean(e.school),
      degree: clean(e.degree) || undefined,
      major: clean(e.major) || undefined,
      startDate: normalizeDate(e.startDate),
      endDate: normalizeDate(e.endDate),
      location: clean(e.location) || undefined,
      gpa: clean(e.gpa) || undefined,
      description: e.description !== undefined ? textToRichText(e.description) : undefined
    }))

  // work：highlights 并入 summary（模板只渲染 summary，防要点丢失）
  r.work = (map.work ?? [])
    .filter((w) => hasContent(w as unknown as Record<string, unknown>))
    .map((w) => {
      const summary = w.summary !== undefined ? textToRichText(w.summary) : undefined
      return {
        id: crypto.randomUUID(),
        company: clean(w.company),
        title: clean(w.title) || undefined,
        location: clean(w.location) || undefined,
        startDate: normalizeDate(w.startDate),
        endDate: w.current ? '' : normalizeDate(w.endDate),
        current: w.current === true,
        summary: mergeHighlights(summary, w.highlights ?? []),
        highlights: []
      }
    })

  // projects：highlights 并入 description（同 work）
  r.projects = (map.projects ?? [])
    .filter((p) => hasContent(p as unknown as Record<string, unknown>))
    .map((p) => {
      const description = p.description !== undefined ? textToRichText(p.description) : undefined
      return {
        id: crypto.randomUUID(),
        name: clean(p.name),
        role: clean(p.role) || undefined,
        organization: clean(p.organization) || undefined,
        startDate: normalizeDate(p.startDate),
        endDate: normalizeDate(p.endDate),
        url: clean(p.url) || undefined,
        description: mergeHighlights(description, p.highlights ?? []),
        highlights: []
      }
    })

  // skills（level 精确匹配枚举）
  r.skills = (map.skills ?? [])
    .filter((s) => clean(s.name) !== '')
    .map((s) => ({
      id: crypto.randomUUID(),
      name: clean(s.name),
      category: clean(s.category) || undefined,
      level: matchSkillLevel(s.level)
    }))

  // certificates
  r.certificates = (map.certificates ?? [])
    .filter((c) => clean(c.name) !== '')
    .map((c) => ({
      id: crypto.randomUUID(),
      name: clean(c.name),
      issuer: clean(c.issuer) || undefined,
      date: normalizeDate(c.date),
      url: clean(c.url) || undefined
    }))

  // languages（proficiency 精确匹配枚举）
  r.languages = (map.languages ?? [])
    .filter((l) => clean(l.name) !== '')
    .map((l) => ({
      id: crypto.randomUUID(),
      name: clean(l.name),
      proficiency: matchProficiency(l.proficiency)
    }))

  // migrate() 收口：非法结构在此抛错（调用方捕获 → PARSE_FAILED）
  return migrate(r)
}
