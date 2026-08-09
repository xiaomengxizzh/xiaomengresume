/**
 * import/rules.ts —— M4a.1 B 档本地规则解析（纯本地 · 隐私最大化 · 零新依赖）
 * 依据：《技术栈.md》§3.19 A 定案：unpdf 抽文本 → cleanText → splitBySectionAnchors
 *   → perSectionExtractBullets → { sections, dirtyLayout } → 草稿喂三步核对向导。
 * 产出 ImportMapSchema 结构 → importMapToResume 收口（复用 M4a 转换器）。
 * 落点注记：定案路径 `src/main/files/pdf-parse-rules.ts`，实际随 M4a 模块落 `src/main/import/rules.ts`（内聚）。
 *
 * 定位（定案）：B 档是 A 档的纯本地降级兜底，**只负责"先分段"，不负责"映射正确"**——
 * 字段归属由三步核对向导兜底；dirtyLayout 提示用户切 A 档（AI 精准映射）。
 */
import type { ImportMap } from '../../shared/schema/import-map'

export type LocalSection =
  | 'basics'
  | 'summary'
  | 'education'
  | 'work'
  | 'projects'
  | 'skills'
  | 'certificates'
  | 'languages'

export interface ParsedSection {
  id: LocalSection | 'unclassified'
  /** 段内非 bullet 自由文本（段落，多行 \n 连接） */
  rawText: string
  /** bullet 项（行首符号/序号剥离后的内容） */
  items: string[]
  /** 2026-08-09 增补：有序行（bullet/文本原始顺序，供条目流式构建——标题行先于其要点） */
  lines: string[]
}

/** 中英双语 section 锚点表（定案 §3.19 A 关键词表） */
export const SECTION_ANCHORS: Record<LocalSection, { zh: string[]; en: string[] }> = {
  basics: { zh: ['基本信息', '个人资料', '联系信息'], en: ['profile', 'contact', 'personal'] },
  summary: { zh: ['自我评价', '个人简介', '个人概述'], en: ['summary', 'objective', 'about'] },
  education: { zh: ['教育经历', '教育背景', '学历'], en: ['education', 'academic'] },
  work: { zh: ['工作经历', '实习经历', '工作经验'], en: ['experience', 'employment', 'work'] },
  projects: { zh: ['项目经验', '项目经历'], en: ['projects', 'project experience'] },
  skills: { zh: ['技能', '专业技能', '技能特长'], en: ['skills', 'technical skills'] },
  certificates: { zh: ['证书', '资格认证'], en: ['certifications', 'certificates'] },
  languages: { zh: ['语言能力', '外语'], en: ['languages'] }
}

/** bullet 行首符号：- • · * 数字序号 中文序号（定案 §3.19 A.3） */
const BULLET_RE = /^(?:[-•·*+]\s+|(?:\d+[.)、])\s*|([①-⑳])\s*|（\d+）\s*)(.+)$/

/** 文本清洗（定案 A.1）：trim + 剔空行/纯页码行/装饰线（不去内容字符）。
 *  页码仅 1-3 位数字（页号通常 1-3 位）；11 位手机号等长数字保留（2026-08-09 M4a.1 修复：原 ^\d+$ 误剔手机号）。 */
export function cleanText(raw: string): string {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      if (/^\d{1,3}$/.test(l)) return false // 纯页码行（1-3 位）
      if (/^[-—=_]{3,}$/.test(l)) return false // 页眉页脚装饰线
      return true
    })
    .join('\n')
}

/**
 * 独立成词判定：关键词前后不能是汉字（中文锚点，防「项目经理」命中「项目」）
 * 或字母数字（英文锚点，防 "works" 命中 "work"）。锚点后可跟冒号/空格等分隔符。
 */
export function hasIndependentKeyword(text: string, kw: string): boolean {
  const i = text.toLowerCase().indexOf(kw)
  if (i < 0) return false
  const before = i > 0 ? text[i - 1] : ''
  const after = i + kw.length < text.length ? text[i + kw.length] : ''
  if (/[\u4e00-\u9fff]/.test(kw)) {
    return !/[\u4e00-\u9fff]/.test(before) && !/[\u4e00-\u9fff]/.test(after)
  }
  return !/[a-zA-Z0-9]/.test(before) && !/[a-zA-Z0-9]/.test(after)
}

/** 锚点匹配（行级：去行首 bullet 符号后，关键词独立出现即命中） */
export function matchAnchorLine(line: string): LocalSection | null {
  const t = line.trim().replace(/^[-•·*+\d.)、（\]]+/, '')
  for (const [id, { zh, en }] of Object.entries(SECTION_ANCHORS) as Array<
    [LocalSection, { zh: string[]; en: string[] }]
  >) {
    for (const kw of zh) {
      if (hasIndependentKeyword(t, kw)) return id
    }
    for (const kw of en) {
      if (hasIndependentKeyword(t, kw)) return id
    }
  }
  return null
}

/** bullet 提取：命中行首符号 → 返回内容（无符号 → null） */
export function matchBullet(line: string): string | null {
  const m = line.trim().match(BULLET_RE)
  if (m) return (m[2] ?? m[1] ?? '').trim()
  return null
}

/** 按锚点分段（锚点行本身不入内容，仅作分隔；无锚点行归 unclassified 暂存） */
export function splitBySectionAnchors(text: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  // lastId 记录当前段 id（闭包赋值不参与 TS 控制流，用标量避开 current?.id 的 never 推断）
  let lastId: LocalSection | 'unclassified' | null = null
  const ensure = (id: LocalSection | 'unclassified'): ParsedSection => {
    if (lastId !== id) {
      current = { id, rawText: '', items: [], lines: [] }
      sections.push(current)
      lastId = id
    }
    return current as ParsedSection
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const anchor = matchAnchorLine(line)
    if (anchor) {
      ensure(anchor) // 新 section 边界（锚点行本身不入内容）
      continue
    }
    const sec = ensure(lastId ?? 'unclassified')
    const bullet = matchBullet(line)
    if (bullet !== null) {
      sec.items.push(bullet)
      sec.lines.push(bullet)
    } else {
      sec.rawText += (sec.rawText ? '\n' : '') + line
      sec.lines.push(line)
    }
  }
  return sections
}

/** 脏排版判定（定案 A.4）：命中任一 → 提示切 A 档（B 档产出仍作预览草稿） */
export function detectDirtyLayout(text: string, sections: ParsedSection[]): string[] {
  const hints: string[] = []
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.some((l) => l.includes('|') || l.includes('\t'))) hints.push('table')
  if (sections.every((s) => s.id === 'unclassified')) hints.push('no-anchor')
  if (lines.length >= 10) {
    const short = lines.filter((l) => l.length < 20).length
    if (short / lines.length > 0.6) hints.push('multi-column')
  }
  return hints
}

/* ── 段内字段级启发式（基础映射，粗糙可接受——三步核对兜底语义）──────────── */

/** 日期跨度提取：2013-09 至 2017-06 / 2020.01-2023 / 2016 年 9 月 – 2020 年 6 月 */
export function parseDateSpan(s: string): { start?: string; end?: string; rest: string } {
  const m = s.match(/(\d{4})(?:[-/.年](\d{1,2}))?(?:\s*[-–—至~到]\s*(\d{4})(?:[-/.年](\d{1,2}))?)?/)
  if (!m) return { rest: s }
  const norm = (y?: string, mo?: string): string | undefined =>
    y ? (mo ? `${y}-${String(Number(mo)).padStart(2, '0')}` : y) : undefined
  const start = norm(m[1], m[2])
  const end = m[3] ? norm(m[3], m[4]) : undefined
  const rest = s.slice(0, m.index).trim() + ' ' + s.slice((m.index ?? 0) + m[0].length).trim()
  return { start, end, rest: rest.trim() }
}

/** 条目拆分：按空格/分隔符拆 token（粗粒度；首 token = 主体名） */
function splitTokens(rest: string): string[] {
  return rest
    .split(/[\s,，、;；]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

const TITLE_HINTS = ['工程师', '经理', '总监', '主管', '专员', '开发', '设计', '运营', '产品', '架构', '顾问', '助理', '实习生', '负责人']

/**
 * 流式构建数组条目（2026-08-09 修复：对照「项目导出简历示例」暴露的拆碎问题）：
 * 含日期行 = 新条目标题行（parseHead 提取字段）；无日期行（要点 li）= 并入当前条目
 * （appendText 以 '• ' 前缀追加，textToRichText 转 bulletList）——防"每条要点变一个条目"。
 */
function buildEntries(
  lines: string[],
  parseHead: (tokens: string[], start?: string, end?: string) => Record<string, unknown> | null,
  appendText: (entry: Record<string, unknown>, text: string) => void
): Array<Record<string, unknown>> {
  const arr: Array<Record<string, unknown>> = []
  let cur: Record<string, unknown> | null = null
  for (const item of lines) {
    const { start, end, rest } = parseDateSpan(item)
    if (start || end) {
      const entry = parseHead(splitTokens(rest), start, end)
      if (entry) {
        cur = entry
        arr.push(cur)
      }
    } else if (cur) {
      appendText(cur, item)
    }
  }
  return arr
}

/** 要点并入描述字段（'• ' 前缀，textToRichText 全 bullet → bulletList） */
function appendBullet(entry: Record<string, unknown>, key: string, text: string): void {
  const prev = typeof entry[key] === 'string' ? (entry[key] as string) : ''
  entry[key] = prev ? `${prev}\n• ${text}` : `• ${text}`
}

/** B 档分段 → ImportMap（粗糙映射；姓名/联系方式正则，条目日期+主体拆分） */
export function rulesToImportMap(sections: ParsedSection[]): ImportMap {
  const map: ImportMap = {}
  const pick = (id: LocalSection): ParsedSection | undefined => sections.find((s) => s.id === id)

  // basics：显式 basics 段优先，否则首个 unclassified 段（常见简历开头无"基本信息"标题，
  // 直接姓名+联系方式，归入未分类暂存段）；姓名首行 + 电话/邮箱/网站正则提取。
  // 生效条件 = 命中至少一个联系方式正则（防无锚点正文整篇被误判为 basics）。
  const basics = pick('basics') ?? sections.find((s) => s.id === 'unclassified')
  if (basics) {
    const lines = [...basics.rawText.split('\n'), ...basics.items].filter(Boolean)
    const b: NonNullable<ImportMap['basics']> = {}
    const phone = lines.find((l) => /1[3-9]\d{9}|0\d{2,3}-\d{7,8}/.test(l))
    const email = lines.find((l) => /[\w.-]+@[\w.-]+\.\w+/.test(l))
    const website = lines.find((l) => /https?:\/\/|www\./.test(l))
    if (phone) {
      b.phone = phone.match(/1[3-9]\d{9}|0\d{2,3}-\d{7,8}/)?.[0] ?? ''
    }
    if (email) b.email = email.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] ?? ''
    if (website) b.website = website.match(/https?:\/\/[^\s]+|www\.[^\s]+/)?.[0] ?? ''
    if (b.phone || b.email || b.website) {
      const nameLine = lines.find((l) => l !== phone && l !== email && l !== website)
      if (nameLine) b.name = nameLine.slice(0, 50)
      map.basics = b
    }
  }

  // summary：整段文本
  const summary = pick('summary')
  if (summary && (summary.rawText || summary.items.length)) {
    map.summary = [summary.rawText, ...summary.items].filter(Boolean).join('\n')
  }

  // education：日期行 = 新条目（school + 日期 + 剩余进 description）；要点行并入 description
  const education = pick('education')
  if (education) {
    const lines = education.lines.length ? education.lines : [...education.items, ...education.rawText.split('\n').filter(Boolean)]
    const arr = buildEntries(
      lines,
      (tokens, start, end) => {
        const school = tokens.shift()
        if (!school) return null
        const desc = tokens.length ? tokens.join('，') : undefined
        return { school, startDate: start, endDate: end, description: desc }
      },
      (e, text) => appendBullet(e, 'description', text)
    )
    if (arr.length) map.education = arr as never
  }

  // work：日期行 = 新条目（company + 职位关键词 title + 日期）；要点行并入 summary
  const work = pick('work')
  if (work) {
    const lines = work.lines.length ? work.lines : [...work.items, ...work.rawText.split('\n').filter(Boolean)]
    const arr = buildEntries(
      lines,
      (tokens, start, end) => {
        const company = tokens.shift()
        if (!company) return null
        const titleIdx = tokens.findIndex((t) => TITLE_HINTS.some((h) => t.includes(h)))
        const title = titleIdx >= 0 ? tokens.splice(titleIdx, 1)[0] : undefined
        const summary = tokens.length ? tokens.join('，') : undefined
        return { company, title, startDate: start, endDate: end, summary }
      },
      (e, text) => appendBullet(e, 'summary', text)
    )
    if (arr.length) map.work = arr as never
  }

  // projects：日期行 = 新条目（name + 角色关键词 role + 日期）；要点行并入 description
  const projects = pick('projects')
  if (projects) {
    const lines = projects.lines.length ? projects.lines : [...projects.items, ...projects.rawText.split('\n').filter(Boolean)]
    const arr = buildEntries(
      lines,
      (tokens, start, end) => {
        const name = tokens.shift()
        if (!name) return null
        const roleIdx = tokens.findIndex((t) => TITLE_HINTS.some((h) => t.includes(h)))
        const role = roleIdx >= 0 ? tokens.splice(roleIdx, 1)[0] : undefined
        const description = tokens.length ? tokens.join('，') : undefined
        return { name, role, startDate: start, endDate: end, description }
      },
      (e, text) => appendBullet(e, 'description', text)
    )
    if (arr.length) map.projects = arr as never
  }

  // skills：每条整行保留（2026-08-09 修复：原按空格/逗号拆碎"分类：内容"成单词条；
  // 冒号前 = category，冒号后 = name——对齐示例"分类：内容"形态）
  const skills = pick('skills')
  if (skills) {
    const rows = [skills.rawText, ...skills.items]
      .join('\n')
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !SECTION_ANCHORS_KEYS.some((k) => hasIndependentKeyword(t, k)))
    const arr: NonNullable<ImportMap['skills']> = []
    for (const row of rows) {
      const idx = row.indexOf('：')
      if (idx > 0) {
        arr.push({ category: row.slice(0, idx).trim(), name: row.slice(idx + 1).trim() })
      } else {
        arr.push({ name: row })
      }
    }
    if (arr.length) map.skills = arr
  }

  // certificates / languages：条目行 → name（含日期提取）
  const certificates = pick('certificates')
  if (certificates) {
    const arr: NonNullable<ImportMap['certificates']> = []
    for (const item of [...certificates.items, ...certificates.rawText.split('\n').filter(Boolean)]) {
      const { start: date, rest } = parseDateSpan(item)
      if (!rest) continue
      arr.push({ name: rest.slice(0, 60), date })
    }
    if (arr.length) map.certificates = arr
  }
  const languages = pick('languages')
  if (languages) {
    const arr: NonNullable<ImportMap['languages']> = []
    for (const item of [...languages.items, ...languages.rawText.split('\n').filter(Boolean)]) {
      const tokens = splitTokens(item)
      const name = tokens.shift()
      if (!name) continue
      arr.push({ name })
    }
    if (arr.length) map.languages = arr
  }

  return map
}

/** 锚点关键词平铺（skills 过滤误判用） */
const SECTION_ANCHORS_KEYS: string[] = Object.values(SECTION_ANCHORS).flatMap((v) => [...v.zh, ...v.en])
