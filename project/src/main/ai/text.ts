/**
 * ai/text.ts —— 简历文本化（F9 匹配 / F20 自我介绍共用，R 批 WP-R3 定案）
 * buildResumeText：结构化简历 → 分区标题 + 字段纯文本（供 AI 消费，事实唯一来源）。
 * richTextToPlain：Tiptap JSON（doc/paragraph/text/…）→ 纯文本（列表项换行）。
 */
import type { Resume, RichText } from '../../shared/schema/resume'

/** Tiptap JSON → 纯文本（段落/列表项间换行，文本节点拼接） */
export function richTextToPlain(rt?: RichText | null): string {
  if (!rt) return ''
  if (typeof rt === 'string') return rt
  const parts: string[] = []
  const collect = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (n.type === 'text' && typeof n.text === 'string') parts.push(n.text)
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        collect(child)
        const t = (child as { type?: string }).type
        if (t === 'paragraph' || t === 'listItem') parts.push('\n')
      }
    }
  }
  collect(rt)
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim()
}

/** 简历全文文本化（仅含事实字段；photo/email 等联系方式不喂 AI，防泄漏与编造） */
export function buildResumeText(resume: Resume): string {
  const lines: string[] = []
  lines.push(`姓名：${resume.basics.name || '（未填写）'}`)
  if (resume.basics.headline) lines.push(`职位头衔：${resume.basics.headline}`)
  if (resume.basics.employmentStatus) lines.push(`在职状态：${resume.basics.employmentStatus}`)
  if (resume.basics.birthDate) lines.push(`出生年月：${resume.basics.birthDate}`)

  const summaryText = richTextToPlain(resume.summary.content)
  if (summaryText) lines.push(`自我评价：\n${summaryText}`)

  const pushSection = (title: string, items: string[]): void => {
    const nonEmpty = items.filter((x) => x.trim().length > 0)
    if (nonEmpty.length === 0) return
    lines.push(`${title}：`)
    nonEmpty.forEach((x, i) => lines.push(`${i + 1}. ${x}`))
  }

  pushSection(
    '教育经历',
    resume.education.map((e) =>
      [e.school, e.degree, e.major, e.startDate && e.endDate ? `${e.startDate}–${e.endDate}` : e.startDate || e.endDate, richTextToPlain(e.description)]
        .filter(Boolean)
        .join(' | ')
    )
  )

  pushSection(
    '工作经历',
    resume.work.map((w) => {
      const head = [w.company, w.title, w.startDate && w.endDate ? `${w.startDate}–${w.endDate}` : w.startDate || (w.current ? '至今' : w.endDate)]
        .filter(Boolean)
        .join(' | ')
      const highlights = w.highlights.map(richTextToPlain).filter(Boolean)
      const summary = richTextToPlain(w.summary)
      return [head, summary, ...highlights].filter(Boolean).join('\n')
    })
  )

  pushSection(
    '项目经历',
    resume.projects.map((p) => {
      const head = [p.name, p.role, p.startDate && p.endDate ? `${p.startDate}–${p.endDate}` : p.startDate || p.endDate]
        .filter(Boolean)
        .join(' | ')
      const highlights = p.highlights.map(richTextToPlain).filter(Boolean)
      return [head, richTextToPlain(p.description), ...highlights].filter(Boolean).join('\n')
    })
  )

  pushSection('技能', resume.skills.map((s) => [s.name, s.level].filter(Boolean).join('（') + (s.level ? '）' : '')))
  pushSection('证书', resume.certificates.map((c) => [c.name, c.issuer, c.date].filter(Boolean).join(' | ')))
  pushSection('语言', resume.languages.map((l) => [l.name, l.proficiency].filter(Boolean).join('（') + (l.proficiency ? '）' : '')))

  return lines.join('\n')
}
