/**
 * import/docx.ts —— M4a Word（.docx）抽取（mammoth，动态 import——技术栈定案 R3）
 * 流程：动态 import('mammoth') → convertToHtml → 块级转纯文本（语义段落保留换行）→ map.ts。
 * mammoth 为 CJS：主进程 ESM 下必须动态 import（顶层 import 会 CJS/ESM 冲突）。
 */
import { promises as fs } from 'node:fs'
import { ImportError } from './errors'

/** mammoth 运行形态（CJS interop：dynamic import 返回 default） */
type MammothModule = {
  convertToHtml: (input: { buffer: Buffer }) => Promise<{ value: string; messages: unknown[] }>
}

/** 动态加载 mammoth（CJS → ESM 主进程，首次调用时 import，随模块缓存） */
async function loadMammoth(): Promise<MammothModule> {
  const mod = (await import('mammoth')) as unknown
  const m = (mod as { default?: MammothModule }).default ?? (mod as MammothModule)
  if (!m || typeof m.convertToHtml !== 'function') {
    throw new ImportError('PARSE_FAILED', 'mammoth failed to load')
  }
  return m
}

/** HTML → 纯文本：块级标签/li 转行，实体解码，空行合并 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th|ul|ol)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

export interface DocxExtractResult {
  text: string
  warnings: string[]
}

/** 抽取 docx 文本（不含 AI 映射） */
export async function extractDocxText(filePath: string): Promise<DocxExtractResult> {
  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch {
    throw new ImportError('PARSE_FAILED', 'unreadable docx file')
  }
  let result: { value: string; messages: unknown[] }
  try {
    const mammoth = await loadMammoth()
    result = await mammoth.convertToHtml({ buffer })
  } catch {
    throw new ImportError('PARSE_FAILED', 'cannot parse docx (corrupted or unsupported?)')
  }
  const text = htmlToPlainText(result.value)
  const warnings: string[] = []
  if (result.messages?.length > 0) warnings.push('import.warning.docx')
  return { text, warnings }
}
