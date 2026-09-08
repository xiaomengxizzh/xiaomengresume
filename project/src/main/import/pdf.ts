/**
 * import/pdf.ts —— M4a PDF 抽取（Node 侧外壳：读盘 + zlib 头像提取）
 * 2026-09-08 拆分（行为零变更）：解析纯核心（常量/清洗/坐标聚类/两列候选/
 * 字节入参抽取/占位草稿）移入 parse-core.ts（零 Node 依赖，web 渲染端复用同一实现）；
 * 本文件保留：① 文件路径入参外壳（loadPdfSource 读盘）② node:zlib PNG 编码头像提取。
 * 全部历史导出名不变（run.ts / 测试经此引用）。
 */
import { promises as fs } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { ImportError } from './errors'
import {
  cleanPdfText,
  extractPdfLinesFromBytes,
  loadUnpdf,
  PDF_TEXT_MIN_CHARS,
  type PdfCandidatePair,
  type PdfExtractResult,
  type PdfLine,
  type PdfLinesResult,
  type PdfToken
} from './parse-core'

// ── 纯核心转出口（历史导出名兼容；实现唯一事实源在 parse-core.ts）─────────
export {
  cleanPdfText,
  GARBAGE_RATIO,
  PAIR_GAP_THRESHOLD,
  PDF_TEXT_MIN_CHARS,
  VERB_PREFIX,
  visionPlaceholderDraft
} from './parse-core'
export { isValueLikeToken } from './parse-core'
export type { PdfCandidatePair, PdfExtractResult, PdfLine, PdfLinesResult, PdfToken }

/**
 * X1（2026-08-25）：PDF 来源统一装载——路径时读盘，bytes 时直通。
 * run.ts 对同一文件只读盘一次，extractPdfLines 与 extractPdfPhoto 共用同一 buffer，
 * 消除大 PDF「双次 readFile + 双次完整解析」的耗时/内存开销；各自 new Uint8Array 拷贝
 * 保证 pdf.js transfer 不互相影响。
 */
async function loadPdfSource(source: string | Uint8Array): Promise<Uint8Array> {
  if (typeof source !== 'string') return source
  try {
    return await fs.readFile(source)
  } catch {
    throw new ImportError('PARSE_FAILED', 'unreadable pdf file')
  }
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
    const { getDocumentProxy, extractText } = await loadUnpdf()
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

/**
 * 抽取 PDF 文本 + 坐标结构（2026-08-10）：路径/字节入参外壳；核心在 parse-core.ts
 * （文本 = extractText 阅读序；pairs = extractTextItems 坐标两列候选）。
 */
export async function extractPdfLines(source: string | Uint8Array): Promise<PdfLinesResult> {
  const buffer = await loadPdfSource(source)
  return await extractPdfLinesFromBytes(buffer)
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
export async function extractPdfPhoto(source: string | Uint8Array): Promise<PdfPhotoResult | null> {
  let buffer: Uint8Array
  try {
    buffer = await loadPdfSource(source)
  } catch {
    return null // 读盘失败不阻断导入（与原路径入参行为一致）
  }
  try {
    const { getDocumentProxy, extractImages } = await loadUnpdf()
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
