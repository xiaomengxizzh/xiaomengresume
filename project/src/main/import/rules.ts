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
  projects: { zh: ['项目经验', '项目经历', '校园经历', '社会实践', '实践经历', '项目实践'], en: ['projects', 'project experience'] },
  skills: { zh: ['技能', '专业技能', '技能特长', '相关技能'], en: ['skills', 'technical skills'] },
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
    // 2026-08-13 修复：锚点词后跟冒号/空白也命中（"语言能力：CET-6"——after=：，原判非中文拒掉致段丢失）
    const afterOk = !/[\u4e00-\u9fff]/.test(after) || /[:：\s]/.test(after)
    return !/[\u4e00-\u9fff]/.test(before) && afterOk
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

/** 2026-08-10：值类文本判定（纯数字/URL/邮箱/日期）——不作为自定义标签的值候选 */
function isValueOnly(v: string): boolean {
  return /^\d{6,}$/.test(v) || /^https?:\/\/|^www\./.test(v) || /@/.test(v) || /^\d{4}[年./-]\d{1,2}/.test(v)
}

/** 剥离锚点行前缀：去行首 bullet 符号 + 命中的锚点词（含其后冒号/空格），返回剩余内容（无则 ''） */
function stripAnchorPrefix(line: string, id: LocalSection): string {
  let t = line.trim().replace(/^[-•·*+\d.)、（\]]+/, '')
  const kws = [...SECTION_ANCHORS[id].zh, ...SECTION_ANCHORS[id].en].sort((a, b) => b.length - a.length)
  for (const kw of kws) {
    if (t.startsWith(kw) || t.startsWith(kw + '：') || t.startsWith(kw + ':') || t.startsWith(kw + ' ')) {
      t = t.slice(kw.length).replace(/^\s*[:：]?\s*/, '')
      break
    }
  }
  return t.trim()
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
      ensure(anchor) // 新 section 边界
      // 2026-08-13 修复：锚点行带内容（"语言能力：CET-6、CET-4"）——锚点词后冒号/空格的内容
      // 不能整行丢弃，剩余内容作为该段首行加入（原 continue 致 languages 段恒空）
      const rest = stripAnchorPrefix(line, anchor)
      if (rest) {
        const sec = ensure(anchor)
        sec.rawText += (sec.rawText ? '\n' : '') + rest
        sec.lines.push(rest)
      }
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
  // 2026-08-13 修复：裸 4 位数字（"回收1535份"）误判为年份 → 要求日期形态：
  //   YYYY（后跟 / . 年 -月）| YYYY-至今 | YYYY[-/.]MM[-/.]? - YYYY... | 数字不裸用
  const m = s.match(
    /(\d{4})(?:[-/.年](\d{1,2}))?(?:\s*[-–—至~到]\s*(?:(\d{4})(?:[-/.年](\d{1,2}))?|至今|现在|今))?/
  )
  if (!m) return { rest: s }
  const raw = m[0]
  const isBareYear = !m[2] && !m[3] // 单年且无月（"1535份"、"1535"）
  // 裸单年仅在"YYYY 至今/现在/今"或作为跨度起点（后接 - 至）时才算日期；其余拒绝
  if (isBareYear && !/^\s*[-–—至~到]\s*(?:至今|现在|今|\d{4})/.test(raw.slice(4)) && !/^\s*年/.test(raw.slice(4))) {
    return { rest: s }
  }
  const norm = (y?: string, mo?: string): string | undefined =>
    y ? (mo ? `${y}-${String(Number(mo)).padStart(2, '0')}` : y) : undefined
  const start = norm(m[1], m[2])
  const end = m[3] ? norm(m[3], m[4]) : m[1] && /^\s*[-–—至~到]\s*(?:至今|现在|今)$/.test(raw.slice(4)) ? undefined : undefined
  const rest = s.slice(0, m.index).trim() + ' ' + s.slice((m.index ?? 0) + raw.length).trim()
  return { start, end, rest: rest.trim() }
}

/** 条目拆分：按空格/分隔符拆 token（粗粒度；首 token = 主体名）；2026-08-13 补 "·"（"学校 专业 · 学位"） */
function splitTokens(rest: string): string[] {
  return rest
    .split(/[\s,，、;；·•]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

const TITLE_HINTS = ['工程师', '经理', '总监', '主管', '专员', '开发', '设计', '运营', '产品', '架构', '顾问', '助理', '实习生', '负责人', '调研', '审查', '分析', '制作', '执行', '管理', '策划', '研究员']

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
export function rulesToImportMap(sections: ParsedSection[], pairs?: Array<{ label: string; value: string }>): ImportMap {
  const map: ImportMap = {}
  const pick = (id: LocalSection): ParsedSection | undefined => sections.find((s) => s.id === id)

  // basics：显式 basics 段优先，否则首个 unclassified 段（常见简历开头无"基本信息"标题，
  // 直接姓名+联系方式，归入未分类暂存段）；姓名首行 + 电话/邮箱/网站正则提取。
  // 生效条件 = 命中至少一个联系方式正则（防无锚点正文整篇被误判为 basics）。
  const basics = pick('basics') ?? sections.find((s) => s.id === 'unclassified')
  if (basics) {
    const lines = [...basics.rawText.split('\n'), ...basics.items].filter(Boolean)
    const b: NonNullable<ImportMap['basics']> = {}
    // 2026-08-10 修复：同行多字段拆分——电话/邮箱/网址按 token 独立匹配，地址按片段从行中提取
    // （material 示例"北京市朝阳区 https://zhangsan.dev"同行——原整行 find+行去重致地址被网址抢占丢失）
    const tokens = lines.flatMap((l) => l.split(/\s+/).filter(Boolean))
    // 2026-08-10 修复：token 内提取（容忍"电话：13800138000"等冒号前缀 token）
    const phone = tokens.map((t) => t.match(/1[3-9]\d{9}|0\d{2,3}-\d{7,8}/)?.[0]).find(Boolean)
    const email = tokens.map((t) => t.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0]).find(Boolean)
    const website = tokens.map((t) => t.match(/https?:\/\/[^\s]+|www\.[^\s]+/)?.[0]).find(Boolean)
    // 地址/位置分类（2026-08-10 修复）：含详细门牌（路/街/号/大厦/栋/大道/广场）→ address；
    // 仅省市区县级（material 示例"北京市朝阳区"[json 原始语义 = location]）→ location——
    // 原统一识别为 address 致 basics.location 空 → 编辑器 TagsBlock"位置"格丢失
    const addrMatch = (() => {
      for (const l of lines) {
        const m = l.match(/([\u4e00-\u9fa5]{2,}(?:省|市|区|县|路|街|号|大厦|栋|大道|广场)[^\s]*)/)
        if (m) return { raw: m[1], line: l }
      }
      return undefined
    })()
    const isDetailedAddr = (s: string): boolean => /(路|街|号|大厦|栋|大道|广场)/.test(s)
    const address = addrMatch && isDetailedAddr(addrMatch.raw) ? addrMatch.raw : undefined
    const location = addrMatch ? addrMatch.raw : undefined
    // 状态：① "状态: 值" label 直取（"状态: 可实习6个月以上"）→ 值即状态；② 行内关键词（在职/离职等）
    // 2026-08-13 修复：词表补 可实习/实习/求职/在读——原仅有 在职/离职/待业/应届/退休，"可实习6个月以上" 不命中
    // 值用负向前瞻截断（遇下一 "label: " 即停，防贪婪吞同行"邮箱: …"）
    const statusLabel = lines.find((l) => /^\s*(?:状态|在职状态|求职状态)\s*[:：]\s*((?:(?![\u4e00-\u9fa5]{1,12}\s*[:：])[^:：\n])+)/.test(l))
    const status = statusLabel ? statusLabel.match(/^\s*(?:状态|在职状态|求职状态)\s*[:：]\s*((?:(?![\u4e00-\u9fa5]{1,12}\s*[:：])[^:：\n])+)/)?.[1]?.trim() : lines.find((l) => /(在职|离职|待业|已离职|应届|退休|可实习|实习中|求职|在读)/.test(l))
    // 生日：行内年月（2026-08-10 修正：material 示例"离职 2025/01"的 2025/01 即生日[json 证实]，
    // 原"排除含状态词行/纯日期行"误伤真生日——去掉整行排除，basics 段含年月格式行即生日；
    // 真离职日期行误捕风险由三步核对向导兜底）
    const birth = lines.find((l) => /(\d{4})[年./-](\d{1,2})\s*月?/.test(l))
    // 2026-08-09 T2：职业（headline）——前缀匹配（求职意向/应聘职位等）
    const headline = lines.find((l) => /(求职意向|应聘职位|目标职位|期望职位|职位[:：]|职业[:：])/.test(l))
    // 2026-08-10 修复：裸职业行 fallback——basics 段第 2 行（第 1 行=姓名），若为干净短文本
    // （非联系方式/地址/状态/前缀职业，≤20 字符）则作为 headline（material 示例"高级前端工程师"独立行）
    let headlineRaw: string | undefined
    if (headline) headlineRaw = headline
    else if (lines.length > 1) {
      const cand = lines[1].trim()
      const notContact = !/1[3-9]\d{9}|[\w.-]+@[\w.-]+\.\w+|https?:\/\/|www\.|(?:省|市|区|县|路|街|号|大厦|栋)|(?:在职|离职|待业|已离职|应届|退休)/.test(cand)
      // 2026-08-10 收紧：纯中文短词（无空格无数字——"实习天数 3"式标签行不误判为职业）
      const isPlainChineseWord = !/[\s\d]/.test(cand)
      if (cand.length > 0 && cand.length <= 20 && notContact && isPlainChineseWord) headlineRaw = cand
    }
    if (headlineRaw) b.headline = headlineRaw.replace(/^(求职意向|应聘职位|目标职位|期望职位|职位|职业)[:：]?\s*/i, '').slice(0, 60)
    if (phone) b.phone = phone
    if (email) b.email = email
    if (website) b.website = website
    if (birth) {
      const m = birth.match(/(\d{4})[年./-](\d{1,2})\s*月?/)
      if (m) b.birthDate = `${m[1]}-${m[2].padStart(2, '0')}`
    }
    if (addrMatch) b.address = address?.replace(/^(现居|居住地|地址|现住)[:：]?\s*/i, '').slice(0, 80)
    if (location) b.location = location.replace(/^(现居|居住地|地址|现住|所在地)[:：]?\s*/i, '').slice(0, 80)
    // 2026-08-13 修复：label 直取（"状态: 可实习6个月以上"）用全值；行内关键词命中取关键词本身
    if (status) b.employmentStatus = statusLabel ? status : status.match(/(在职|离职|待业|已离职|应届|退休|可实习|实习中|求职|在读)/)?.[0] ?? ''
    // 2026-08-10 导入标签全量：通用"标签: 值"行识别——未被固定字段命中的 label:value 行 → customFields
    // （用户自定义标签如"年龄/QQ/籍贯/婚育"等任意标签对；label ≤12 字符、冒号分隔；
    //  已知 6 类 label 已走固定字段 + 标准 icon，此处只收未知标签，避免重复显示）
    // 2026-08-10 修复：phone/email/website/addr/location 为 token/片段——按"行包含命中值"排除
    const fixedHits = new Set<string>()
    for (const l of lines) {
      const hit =
        (phone && l.includes(phone)) ||
        (email && l.includes(email)) ||
        (website && l.includes(website)) ||
        (location && l.includes(location)) ||
        l === birth ||
        l === status ||
        (statusLabel !== undefined && l === statusLabel) ||
        l === headline ||
        l === headlineRaw
      if (hit) fixedHits.add(l)
    }
    const customs: NonNullable<ImportMap['basics']>['customFields'] = []
    // 2026-08-10：knownLabels 仅含"固定映射集"（有专门字段）；籍贯/年龄/实习天数等自定义标签保留入库
    // 2026-08-13：补 状态/在职状态/求职状态（已映射 employmentStatus，不进 customFields 防重复）
    const knownLabels = new Set(['姓名', '电话', '手机', '邮箱', '邮件', '地址', '网址', '网站', '生日', '出生', '在职', '职业', '职位', '状态', '在职状态', '求职状态'])
    // 空格分隔候选的动词/介词前缀（"优化 项目…"是描述行）
    const verbPrefix = /^(基于|采用|使用|支持|提供|优化|设计|主导|负责|参与|实现|维护|开发|搭建|推动|管理|通过|作为|具备|熟悉|掌握|精通|了解|协助|组织|协调|撰写|制定|集成)/
    for (const l of lines) {
      // 2026-08-13 修复：同行多字段漏抓——"电话: x 地址: 济南" 整行被 fixedHits 排除致地址丢。
      // 剥离已消费的固定字段值（phone/email/website）后，剩余部分仍尝试 label:value 提取；
      // 同时清理剥离后残留的 label 词（仅带冒号者——"电话: " "邮箱:"，防"电话调研"类词误删）。
      let rest = l
      for (const v of [phone, email, website]) if (v) rest = rest.split(v).join('')
      rest = rest.replace(/(?:电话|手机|邮箱|邮件|网址|网站|邮编)\s*[:：]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
      // 候选对规则 ① 冒号行——全局 matchAll：一行可含多个 "label: 值" 对（"性别: 男 年龄: 23岁" 拆两条）；
      // 值用负向前瞻：遇「中文词+冒号」（下一个 label 起点）即停，防贪婪吞掉后续对（"年龄" 不被吞进 "男" 的值）；
      // "电话调研" 类词无冒号不误拆。
      const pairsOfLine = [
        ...rest.matchAll(/([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9··]{0,10})\s*[:：]\s*((?:(?![\u4e00-\u9fa5]{1,12}\s*[:：])[^:：\n])+)/g)
      ]
      if (pairsOfLine.length > 0) {
        for (const mm of pairsOfLine) {
          const label = mm[1].trim()
          const value = mm[2].trim()
          // 2026-08-13：knownLabels（固定字段已映射）不进 customFields 防重复——规则①此前未查，补上
          if (label && value && !knownLabels.has(label)) customs.push({ label: label.slice(0, 32), value: value.slice(0, 256) })
        }
        continue
      }
      if (fixedHits.has(l)) continue
      // 候选对规则 ② 空格分隔的短标签行（"实习天数 3"式，1+ 空格；不绑定固定字段）
      const m2 = l.match(/^([\u4e00-\u9fa5A-Za-z]{1,8})\s+(\S.*)$/)
      if (m2) {
        const label = m2[1].trim()
        const value = m2[2].trim()
        // 固定字段名直接映射（不进 customFields 防重复）；动词开头/值类行跳过
        if (label && value && !knownLabels.has(label) && !verbPrefix.test(label) && !isValueOnly(value)) customs.push({ label: label.slice(0, 32), value: value.slice(0, 256) })
      }
    }
    // 2026-08-10：候选对规则 ③ 坐标两列候选（pdf.ts extractPdfLines 产出）——左短右长，全部进 customFields
    for (const p of pairs ?? []) {
      const label = p.label.trim().slice(0, 32)
      const value = p.value.trim().slice(0, 256)
      if (!label || !value || knownLabels.has(label) || isValueOnly(value)) continue
      // 与固定字段/既有候选去重
      if ((b.phone && value.includes(b.phone)) || (b.email && value.includes(b.email)) || (b.website && value.includes(b.website)) || (b.address && value.includes(b.address))) continue
      if (customs.some((c) => c.label === label && c.value === value)) continue
      customs.push({ label, value })
    }
    // 2026-08-13 修复：无后缀城市（"地址: 济南"）→ location——直接从 lines 提取 label=地址/现居 的 value，
    // 不依赖 customs（地址在 knownLabels 已不进 customFields）；同行电话需先剥离（"电话: x 地址: 济南"）
    if (!b.location && !b.address) {
      for (const l of lines) {
        let rest = l
        for (const v of [phone, email, website]) if (v) rest = rest.split(v).join('')
        // 清剥离后残留 label（"电话: "），与 customs 规则①同款
        rest = rest.replace(/(?:电话|手机|邮箱|邮件|网址|网站|邮编)\s*[:：]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
        const m = rest.match(/^\s*(?:地址|现居|现住|居住地|所在城市|所在地)\s*[:：]\s*((?:(?![\u4e00-\u9fa5]{1,12}\s*[:：])[^:：\n])+)/)
        if (m && m[1]?.trim()) {
          b.location = m[1].trim().slice(0, 80)
          break
        }
      }
    }
    if (customs.length > 0) b.customFields = customs
    if (b.phone || b.email || b.website || b.birthDate || b.address || b.location || (b.customFields && b.customFields.length > 0)) {
      const nameLine = lines.find((l) => !fixedHits.has(l) && l.trim().length > 0)
      if (nameLine) {
        // 2026-08-10："姓名 张三"/"姓名：张三"式行剥离前缀取真实姓名
        const nameClean = nameLine.replace(/^姓名[:：\s]+/i, '').trim()
        b.name = (nameClean || nameLine).slice(0, 50)
      }
      map.basics = b
    }
  }

  // summary：整段文本
  const summary = pick('summary')
  if (summary && (summary.rawText || summary.items.length)) {
    map.summary = [summary.rawText, ...summary.items].filter(Boolean).join('\n')
  }

  // education：日期行 = 新条目（school + 日期 + 剩余进 description）；要点行并入 description
  // 2026-08-13 修复：解析"学校 专业 · 学位"结构——degree 从学位标记识别（在读/本科/硕士/博士/学士），
  // major 取其余 token（"山东大学 市场营销 · 硕士在读" → school=山东大学 degree=硕士在读 major=市场营销）
  const education = pick('education')
  if (education) {
    const lines = education.lines.length ? education.lines : [...education.items, ...education.rawText.split('\n').filter(Boolean)]
    const arr = buildEntries(
      lines,
      (tokens, start, end) => {
        const school = tokens.shift()
        if (!school) return null
        const DEGREE_RE = /(硕士|博士|本科|学士|专科|大专|在读|研究生)/i
        const degreeIdx = tokens.findIndex((t) => DEGREE_RE.test(t))
        const degree = degreeIdx >= 0 ? tokens.splice(degreeIdx, 1)[0] : undefined
        const major = tokens.length ? tokens.join(' ') : undefined
        return { school, degree, major, startDate: start, endDate: end }
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
      // 2026-08-13 修复：同一行多个语言（"CET-6、CET-4"）按顿号/逗号拆成多条
      for (const seg of item.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)) {
        const tokens = splitTokens(seg)
        const name = tokens.shift()
        if (!name) continue
        arr.push({ name })
      }
    }
    if (arr.length) map.languages = arr
  }

  return map
}

/** 锚点关键词平铺（skills 过滤误判用） */
const SECTION_ANCHORS_KEYS: string[] = Object.values(SECTION_ANCHORS).flatMap((v) => [...v.zh, ...v.en])
