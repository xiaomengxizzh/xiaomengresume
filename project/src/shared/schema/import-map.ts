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
      /** 个人简介（纯文本，映射到 basics.profile） */
      profile: z.string().optional()
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

/** 纯文本 → RichText 单段落（每次新建对象，防共享常量别名污染） */
function textToRichText(text: unknown): RichText {
  const t = clean(text)
  if (!t) return { type: 'doc', content: [] }
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }]
  }
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
    const profile = clean(b.profile)
    if (profile) r.basics.profile = textToRichText(profile)
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

  // work
  r.work = (map.work ?? [])
    .filter((w) => hasContent(w as unknown as Record<string, unknown>))
    .map((w) => ({
      id: crypto.randomUUID(),
      company: clean(w.company),
      title: clean(w.title) || undefined,
      location: clean(w.location) || undefined,
      startDate: normalizeDate(w.startDate),
      endDate: w.current ? '' : normalizeDate(w.endDate),
      current: w.current === true,
      summary: w.summary !== undefined ? textToRichText(w.summary) : undefined,
      highlights: (w.highlights ?? []).map(textToRichText)
    }))

  // projects
  r.projects = (map.projects ?? [])
    .filter((p) => hasContent(p as unknown as Record<string, unknown>))
    .map((p) => ({
      id: crypto.randomUUID(),
      name: clean(p.name),
      role: clean(p.role) || undefined,
      organization: clean(p.organization) || undefined,
      startDate: normalizeDate(p.startDate),
      endDate: normalizeDate(p.endDate),
      url: clean(p.url) || undefined,
      description: p.description !== undefined ? textToRichText(p.description) : undefined,
      highlights: (p.highlights ?? []).map(textToRichText)
    }))

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
