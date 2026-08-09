/**
 * import/pdf.ts —— M4a PDF 文本抽取与分流（unpdf，内部基于 pdf.js）
 * 流程：unpdf.extractText(mergePages) → 行级清洗（剔除乱码行 �>30%）→ 有效字符分流：
 *   < PDF_TEXT_MIN_CHARS → needsVision（扫描件/无文本层，M4b 占位，非错误）；
 *   ≥ 阈值 → 文本交 map.ts 做 AI 语义映射。
 * 依据：《技术栈.md》§三（unpdf 而非 pdfjs-dist，M4 前提修正）。
 */
import { promises as fs } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { getDocumentProxy, extractText, extractImages } from 'unpdf'
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

/* ── PDF 图片提取（2026-08-09：导入 PDF 头像显示）────────────────────────── */

/** 提取图片上限（像素数）：防超大图撑爆内存/超大 data URL */
export const PDF_PHOTO_MAX_PIXELS = 4_000_000

/** PNG CRC32（标准查表实现，PNG chunk 校验用） */
function crc32(buf: Buffer): number {
  let table: number[] | null = null
  if (!table) {
    table = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/**
 * RGBA 原始像素 → PNG data URL（自写最小编码器，零新依赖——
 * sharp 等为原生编译依赖违反 G.2；node:zlib deflate 已够）。
 * 每行前置 filter byte 0（None），IHDR(RGBA/8bit) + IDAT + IEND。
 */
export function rgbaToPngDataUrl(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  channels: 1 | 3 | 4
): string {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: None
    for (let x = 0; x < width; x++) {
      const src = y * stride + x * 4
      const dst = y * (stride + 1) + 1 + x * 4
      const si = y * (width * channels) + x * channels
      raw[dst] = data[si] // R
      raw[dst + 1] = data[si + 1] // G
      raw[dst + 2] = data[si + 2] // B
      raw[dst + 3] = channels === 4 ? data[si + 3] : 255 // A
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0))
  ])
  return `data:image/png;base64,${png.toString('base64')}`
}

export interface PdfPhotoResult {
  dataUrl: string
  width: number
  height: number
}

/**
 * 提取 PDF 头像（2026-08-09 修复：导入含图 PDF 后图片不显示——
 * 根因 = 导入流程只抽文本、从未提取图片，basics.photo 恒空）。
 * 启发式：取**第一页面积最大**的嵌入图片（简历头像通常是最大图）；
 * 超大图跳过（PDF_PHOTO_MAX_PIXELS 防撑爆）；无图/失败返回 null（不阻断导入）。
 */
export async function extractPdfPhoto(filePath: string): Promise<PdfPhotoResult | null> {
  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch {
    return null
  }
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const images = await extractImages(pdf, 1)
    // 面积最大图 = 候选头像
    let best: { data: Uint8ClampedArray; width: number; height: number; channels: 1 | 3 | 4 } | null = null
    let bestArea = 0
    for (const img of images) {
      const area = img.width * img.height
      if (area > bestArea) {
        bestArea = area
        best = img
      }
    }
    if (!best || bestArea > PDF_PHOTO_MAX_PIXELS) return null
    return {
      dataUrl: rgbaToPngDataUrl(best.data, best.width, best.height, best.channels),
      width: best.width,
      height: best.height
    }
  } catch {
    return null // 图片提取失败不阻断导入（文本仍可用）
  }
}
