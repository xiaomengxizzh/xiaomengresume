/**
 * import/pdf.ts —— M4a PDF 文本抽取与分流（unpdf，内部基于 pdf.js）
 * 流程：unpdf.extractText(mergePages) → 行级清洗（剔除乱码行 �>30%）→ 有效字符分流：
 *   < PDF_TEXT_MIN_CHARS → needsVision（扫描件/无文本层，M4b 占位，非错误）；
 *   ≥ 阈值 → 文本交 map.ts 做 AI 语义映射。
 * 依据：《技术栈.md》§三（unpdf 而非 pdfjs-dist，M4 前提修正）。
 */
import { promises as fs } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { getDocumentProxy, extractText, extractTextItems, extractImages } from 'unpdf'
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

/* ── 坐标级结构提取（2026-08-10：unpdf extractTextItems 坐标 → 行聚类 + 两列候选对）────────
 * 业界共识（Google Form Parser 等）："布局感知抽取全部候选键值对 → 用户核对"——本函数产出候选对，
 * 固定 6 类仅作高置信映射，其余交由三步核对向导确认（消除"只认固定字段"局限）。 */

export interface PdfToken {
  x: number
  text: string
}

export interface PdfLine {
  y: number
  /** 行文本（token 按 x 拼接；token 间大间隙补空格） */
  text: string
  tokens: PdfToken[]
}

/** 两列候选键值对（左短标签 + x 大间隙 + 右长值） */
export interface PdfCandidatePair {
  label: string
  value: string
}

export interface PdfLinesResult extends PdfExtractResult {
  /** 按视觉顺序（y 聚类、行内 x 排序）还原的行 */
  lines: PdfLine[]
  /** 两列布局候选键值对（左短右长；供 B 档 customFields 兜底） */
  pairs: PdfCandidatePair[]
}

/** 值类 token（数字/URL/邮箱/日期）——不作为"标签"列 */
function isValueLikeToken(t: string): boolean {
  return /^\d{2,}$/.test(t) || /^https?:\/\/|^www\./.test(t) || /@/.test(t) || /^\d{4}[年./-]\d{1,2}/.test(t) || /^(在职|离职|待业|已离职|应届|退休)$/.test(t)
}

/** 同页 items 按 y 聚类成行（行高阈值 = max(5, 字号×0.5)）。
 *  ⚠️ pdf.js TextItem 的 y 坐标从页面【底部】向上增长（原点左下）——降序排列 = 视觉从上到下。 */
function clusterRows(pageItems: Array<{ str: string; x: number; y: number; width: number; height: number }>): Array<Array<{ str: string; x: number; y: number; width: number; height: number }>> {
  const sorted = [...pageItems].sort((a, b) => b.y - a.y)
  const rows: Array<Array<{ str: string; x: number; y: number; width: number; height: number }>> = []
  for (const it of sorted) {
    const last = rows[rows.length - 1]
    if (last && last.length && Math.abs(it.y - last[0].y) <= Math.max(5, it.height * 0.5)) {
      last.push(it)
    } else {
      rows.push([it])
    }
  }
  return rows
}

/** 2026-08-10：动词/介词开头排除——"基于/采用/使用…"是描述行而非"标签 值"（两列误判过滤） */
const VERB_PREFIX = /^(基于|采用|使用|支持|提供|优化|设计|主导|负责|参与|实现|维护|开发|搭建|推动|管理|通过|作为|负责的|具备|熟悉|掌握|精通|了解|协助|组织|协调|撰写|制定|集成|负责的)/

/** 2026-08-10：两列 x 间隙阈值（pt）——真两列（左标签列右缘 << 右值列左缘）通常 ≥18；
 *  单列文本行内 token 空格间隙（"字节跳动 高级前端工程师"）< 18 → 过滤误判 */
const PAIR_GAP_THRESHOLD = 18

/**
 * 抽取 PDF 文本 + 坐标结构（2026-08-10）：
 * 文本 = extractText（阅读顺序，与 extractPdfText 一致——rules 的"姓名首行/第 2 行职业"假设依赖阅读序）；
 * pairs = extractTextItems 坐标两列候选（左短右长，作 B 档 customFields 兜底，低置信交三步核对）。
 */
export async function extractPdfLines(filePath: string): Promise<PdfLinesResult> {
  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch {
    throw new ImportError('PARSE_FAILED', 'unreadable pdf file')
  }
  let rawText: string
  let pageItems: Array<Array<{ str: string; x: number; y: number; width: number; height: number }>>
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    // ① 阅读序文本（与 extractPdfText 一致）
    const t = await extractText(pdf, { mergePages: true })
    rawText = t.text
    // ② 坐标文本项（两列候选对用）
    const { items } = await extractTextItems(pdf)
    pageItems = items as Array<Array<{ str: string; x: number; y: number; width: number; height: number }>>
  } catch {
    throw new ImportError('PARSE_FAILED', 'cannot parse pdf (encrypted or corrupted?)')
  }

  const lines: PdfLine[] = []
  const pairs: PdfCandidatePair[] = []
  for (const page of pageItems) {
    for (const row of clusterRows(page)) {
      const tokens: PdfToken[] = row
        .map((it) => ({ x: it.x, text: it.str.trim() }))
        .filter((t) => t.text.length > 0)
        .sort((a, b) => a.x - b.x)
      if (tokens.length === 0) continue
      // 行文本：token 间大 x 间隙补空格（还原"北京市朝阳区 https://…"式同行分栏）
      let text = tokens[0].text
      for (let i = 1; i < tokens.length; i++) {
        const gap = tokens[i].x - (tokens[i - 1].x + tokens[i - 1].text.length * 3) // 近似 token 宽
        text += gap > 4 ? ` ${tokens[i].text}` : tokens[i].text
      }
      const y = row[0].y
      lines.push({ y, text, tokens })
      // 两列候选对（收紧）：首 token 短（2-12 字符、非值类、非动词/介词开头、不含标点冒号/斜杠/顿号）
      // + 与次 token 大 x 间隙（真两列）→ 左标签右值；值含中文逗号视为描述行排除
      if (tokens.length >= 2) {
        const first = tokens[0]
        const second = tokens[1]
        const firstW = first.text.length * 3 // 近似宽（px 级启发）
        if (
          first.text.length >= 2 &&
          first.text.length <= 12 &&
          !isValueLikeToken(first.text) &&
          !VERB_PREFIX.test(first.text) &&
          !/[:：/、·|]/.test(first.text) &&
          second.x - (first.x + firstW) > PAIR_GAP_THRESHOLD
        ) {
          const label = first.text.replace(/[:：]$/, '').trim()
          const value = tokens
            .slice(1)
            .map((t) => t.text)
            .join(' ')
            .trim()
          if (
            label &&
            value &&
            !isValueLikeToken(label) &&
            !/[，。；]/.test(value) &&
            // 条目头特征排除（"字节跳动 高级前端工程师 2021/07 - 2024/12" 是条目头非标签值）
            !/\d{4}[/.]\d{1,2}\s*[-–]\s*\d{4}/.test(value)
          ) {
            pairs.push({ label, value })
          }
        }
      }
    }
  }

  const { text, removedLines } = cleanPdfText(rawText)
  const warnings: string[] = []
  if (removedLines > 0) warnings.push('import.warning.garbled')
  const effectiveChars = text.replace(/\s/g, '').length
  if (effectiveChars < PDF_TEXT_MIN_CHARS) {
    warnings.push('import.warning.scanned')
    return { text, effectiveChars, warnings, needsVision: true, lines, pairs }
  }
  return { text, effectiveChars, warnings, needsVision: false, lines, pairs }
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
