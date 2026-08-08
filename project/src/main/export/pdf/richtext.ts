/**
 * pdf/richtext.ts —— RichText（Tiptap JSON / 降级 HTML）→ 纯文本提取（2026-08-08）
 * @react-pdf/renderer 的 <Text> 只接受文本 + 内联样式，不接受 HTML；
 * 这里把 RichText 转成「段落数组 + 内联标记（bold）」，供 PDF 组件逐段渲染。
 *
 * 与 preview/richtext-html.ts 的关系：那是转 HTML（编辑器预览用）；
 * 本模块是转纯文本+标记（PDF 用），二者独立、互不复用（HTML 解析到 PDF 无意义）。
 */
import type { RichText } from '@shared/schema/resume'

/** PDF 内联文本段：文本 + 标记（bold/italic/strike/link） */
export interface PdfTextRun {
  text: string
  bold: boolean
  italic?: boolean
  strike?: boolean
  /** 链接 href（渲染为 accent 色 + 下划线） */
  link?: string
}

/** PDF 段落：一组 run（含列表前缀标记） */
export interface PdfParagraph {
  runs: PdfTextRun[]
  /** 列表样式：'bullet' | 'ordered' | 无 */
  list?: 'bullet' | 'ordered'
  /** 有序列表序号（list==='ordered' 时有值） */
  order?: number
}

interface RichTextNode {
  type?: string
  text?: string
  content?: unknown[]
  marks?: unknown[]
  attrs?: Record<string, unknown>
}

interface RichTextMark {
  type: string
  attrs?: Record<string, unknown>
}

/** 节点 → 文本 run 列表（bold/italic/strike/link 标记展开；P2：补 italic/strike/link，
 *  原只识别 bold——斜体/删除线/链接在 PDF 中退化为普通文本） */
function nodeToRuns(node: unknown): PdfTextRun[] {
  const n = node as RichTextNode
  switch (n.type) {
    case 'text': {
      const marks = (n.marks ?? []) as RichTextMark[]
      const run: PdfTextRun = {
        text: n.text ?? '',
        bold: marks.some((m) => m.type === 'bold'),
        italic: marks.some((m) => m.type === 'italic') || undefined,
        strike: marks.some((m) => m.type === 'strike') || undefined,
        link: (marks.find((m) => m.type === 'link')?.attrs?.href as string | undefined) || undefined
      }
      return [run]
    }
    case 'hardBreak':
      return [{ text: '\n', bold: false }]
    default:
      return []
  }
}

/** 节点树 → run 列表（拼接子节点） */
function nodesToRuns(nodes: unknown[]): PdfTextRun[] {
  const out: PdfTextRun[] = []
  for (const node of nodes) {
    const n = node as RichTextNode
    if (n.type === 'paragraph' || n.type === 'listItem' || n.type === 'heading') {
      out.push(...nodesToRuns(n.content ?? []))
    } else {
      out.push(...nodeToRuns(n))
    }
  }
  return out
}

/** 合并相邻同标记的 run（减少 PDF 组件渲染节点数） */
function sameMark(a: PdfTextRun, b: PdfTextRun): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.strike === b.strike && a.link === b.link
}

function mergeRuns(runs: PdfTextRun[]): PdfTextRun[] {
  const out: PdfTextRun[] = []
  for (const r of runs) {
    const last = out[out.length - 1]
    if (last && sameMark(last, r)) last.text += r.text
    else out.push({ text: r.text, bold: r.bold, italic: r.italic, strike: r.strike, link: r.link })
  }
  return out.filter((r) => r.text.length > 0)
}

/**
 * RichText → PdfParagraph[]。
 * - Tiptap JSON：paragraph/bulletList/orderedList/listItem/heading/hardBreak/粗体
 * - 降级 HTML 字符串：去除标签按纯文本（不解析 HTML 语义，与预览一致——预览也仅转义展示）
 */
export function richTextToPdfParagraphs(rt: RichText | undefined): PdfParagraph[] {
  if (!rt) return []
  if (typeof rt === 'string') {
    const text = rt.replace(/<[^>]*>/g, '').trim()
    return text ? [{ runs: mergeRuns([{ text, bold: false }]) }] : []
  }

  const paragraphs: PdfParagraph[] = []
  const content = rt.content ?? []
  let order = 0

  for (const node of content) {
    const n = node as RichTextNode
    if (n.type === 'bulletList' || n.type === 'orderedList') {
      const isOrdered = n.type === 'orderedList'
      // 进入列表：listItem 子节点逐个转段落
      for (const item of n.content ?? []) {
        const runs = mergeRuns(nodesToRuns([item]))
        if (runs.length > 0) {
          order = isOrdered ? order + 1 : 0
          paragraphs.push({ runs, list: isOrdered ? 'ordered' : 'bullet', order: isOrdered ? order : undefined })
        }
      }
      order = 0
      continue
    }
    if (n.type === 'paragraph' || n.type === 'heading') {
      const runs = mergeRuns(nodesToRuns([n]))
      if (runs.length > 0) paragraphs.push({ runs })
    }
  }
  return paragraphs
}

/** 段落 → 单行纯文本（测试/日志辅助） */
export function paragraphsToPlainText(paragraphs: PdfParagraph[]): string {
  return paragraphs
    .map((p) => {
      const prefix = p.list === 'bullet' ? '• ' : p.list === 'ordered' ? `${p.order ?? 1}. ` : ''
      return prefix + p.runs.map((r) => r.text).join('')
    })
    .join('\n')
}
