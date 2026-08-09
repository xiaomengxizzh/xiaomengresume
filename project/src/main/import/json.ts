/**
 * import/json.ts —— M4a JSON 导入（零 AI、确定性）
 * 定案（#4）：仅接受 migrate() 可解析的合法结构（含 schemaVersion）；非标准 schema 拒绝并提示（不猜测）。
 * 流程：JSON.parse → migrate()（版本迁移 + Zod 校验）→ 直接成草稿。
 */
import { promises as fs } from 'node:fs'
import { migrate } from '../../shared/schema/resume'
import type { ImportDraft } from '../../shared/ipc-channels'
import { ImportError } from './errors'

/** 简历 → 纯文本预览（≤2000 字符，向导①解析预览） */
export function resumeToPreview(resume: ReturnType<typeof migrate>): string {
  const parts: string[] = []
  const b = resume.basics
  const head = [b.name, b.headline, b.phone, b.email, b.location].filter(Boolean).join(' · ')
  if (head) parts.push(head)
  const textOf = (rt: unknown): string => {
    if (typeof rt === 'string') return rt
    const doc = rt as { content?: { content?: { text?: string }[] }[] }
    if (!doc?.content) return ''
    return doc.content
      .map((p) => p.content?.map((t) => t.text ?? '').join('') ?? '')
      .join('\n')
      .trim()
  }
  const summary = textOf(resume.summary.content)
  if (summary) parts.push(summary)
  for (const e of resume.education) {
    const line = [e.school, e.degree, e.major, [e.startDate, e.endDate].filter(Boolean).join(' – ')]
      .filter(Boolean)
      .join(' · ')
    if (line) parts.push(line)
  }
  for (const w of resume.work) {
    const line = [w.title, w.company, w.location, [w.startDate, w.endDate].filter(Boolean).join(' – ')]
      .filter(Boolean)
      .join(' · ')
    if (line) parts.push(line)
  }
  for (const p of resume.projects) {
    const line = [p.name, p.role, p.organization].filter(Boolean).join(' · ')
    if (line) parts.push(line)
  }
  return parts.join('\n').slice(0, 2000)
}

export async function importJson(filePath: string, fileName: string): Promise<ImportDraft> {
  let raw: unknown
  try {
    raw = JSON.parse(await fs.readFile(filePath, 'utf-8')) as unknown
  } catch {
    throw new ImportError('PARSE_FAILED', 'invalid JSON')
  }
  let resume: ReturnType<typeof migrate>
  try {
    // 版本迁移 + Zod 校验收口：无 schemaVersion（v0）或结构非法在此抛错
    resume = migrate(raw)
  } catch {
    throw new ImportError('PARSE_FAILED', 'unsupported resume schema')
  }
  return {
    format: 'json',
    fileName,
    sourcePreview: resumeToPreview(resume),
    resume,
    warnings: []
  }
}
