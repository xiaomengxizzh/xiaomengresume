/**
 * import/pdf.ts —— M4a PDF 文本抽取与分流（unpdf，内部基于 pdf.js）
 * 流程：unpdf.extractText(mergePages) → 行级清洗（剔除乱码行 �>30%）→ 有效字符分流：
 *   < PDF_TEXT_MIN_CHARS → needsVision（扫描件/无文本层，M4b 占位，非错误）；
 *   ≥ 阈值 → 文本交 map.ts 做 AI 语义映射。
 * 依据：《技术栈.md》§三（unpdf 而非 pdfjs-dist，M4 前提修正）。
 */
import { promises as fs } from 'node:fs'
import { getDocumentProxy, extractText } from 'unpdf'
import type { ImportDraft } from '../../shared/ipc-channels'
import { createEmptyResume } from '../../shared/schema/resume'
import { ImportError } from './errors'

/** 文本型阈值（#3 拍板：100 字符落码；M4 实测调参集中此常量） */
export const PDF_TEXT_MIN_CHARS = 100
/** 乱码行阈值：� 替换字符占行长度比例超过此值 → 整行剔除 */
export const GARBAGE_RATIO = 0.3

export interface PdfExtractResult {
  text: string
  /** 有效字符数（去空白）——分流依据 */
  effectiveChars: number
  warnings: string[]
  needsVision: boolean
}

/** 行级清洗：空行合并 + 乱码行剔除（� 占比 > GARBAGE_RATIO），返回清洗统计 */
export function cleanPdfText(raw: string): { text: string; removedLines: number } {
  const lines = raw.split('\n')
  let removedLines = 0
  const kept = lines.filter((line) => {
    const t = line.trim()
    if (!t) return false // 空行剔除（合并连续空白）
    const garble = (t.match(/�/g) ?? []).length / t.length
    if (garble > GARBAGE_RATIO) {
      removedLines += 1
      return false
    }
    return true
  })
  return { text: kept.join('\n'), removedLines }
}

/** 抽取 PDF 文本并分流（不含 AI 映射；≥ 阈值时 resume 由 map.ts 填充） */
export async function extractPdfText(filePath: string): Promise<PdfExtractResult> {
  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch {
    throw new ImportError('PARSE_FAILED', 'unreadable pdf file')
  }
  let rawText: string
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    rawText = text
  } catch {
    // 加密 / 损坏 / 无文本层解析失败 → 明确提示（R1）
    throw new ImportError('PARSE_FAILED', 'cannot parse pdf (encrypted or corrupted?)')
  }

  const { text, removedLines } = cleanPdfText(rawText)
  const warnings: string[] = []
  // warnings 用 i18n key（CH4：禁主进程硬编码中文；前端 t(key) 渲染）
  if (removedLines > 0) warnings.push('import.warning.garbled')
  const effectiveChars = text.replace(/\s/g, '').length
  if (effectiveChars < PDF_TEXT_MIN_CHARS) {
    // 扫描件/图片 PDF：文本不足 → M4b 占位（非错误，前端提示 VISION_REQUIRED）
    warnings.push('import.warning.scanned')
    return { text, effectiveChars, warnings, needsVision: true }
  }
  return { text, effectiveChars, warnings, needsVision: false }
}

/** M4b 占位草稿（扫描件/图片）：空简历 + needsVision 标记，前端提示不崩溃 */
export function visionPlaceholderDraft(
  format: 'pdf' | 'image',
  fileName: string,
  sourcePreview: string,
  warnings: string[]
): ImportDraft {
  return {
    format,
    fileName,
    sourcePreview: sourcePreview.slice(0, 2000),
    resume: createEmptyResume(),
    warnings,
    needsVision: true
  }
}
