/**
 * import/parse-core.ts —— 导入解析纯核心（2026-09-08 从 pdf.ts 拆出，行为零变更）
 * 拆分动机：web 端（dev:web / 上线 web 部署）需在渲染进程复用同一套解析与 B 档规则，
 * 原 pdf.ts 顶层 node:fs / node:zlib 使渲染端无法引入。本文件零 Node 依赖：
 * 输入一律字节（Uint8Array），unpdf（serverless 友好封装 pdf.js）浏览器可用。
 * Node 侧（读盘 / zlib 头像提取）留在 pdf.ts 外壳，main 流程不受影响（导出名兼容）。
 */
import type { ImportDraft } from '../../shared/ipc-channels'
import { createEmptyResume } from '../../shared/schema/resume'
import { ImportError } from './errors'

/**
 * unpdf 懒加载（2026-08-11 A1：WASM 解析器仅首次调用时加载——unpdf 2.5MB + pdf.js，
 * 原顶层静态 import 令 main 启动即解析/WASM 初始化。外部依赖经 externalizeDepsPlugin
 * 外置，动态 import 保留运行时加载，与 docx.ts 的 mammoth 同模式）。
 */
export async function loadUnpdf(): Promise<typeof import('unpdf')> {
  return await import('unpdf')
}

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
export function isValueLikeToken(t: string): boolean {
  return /^\d{2,}$/.test(t) || /^https?:\/\/|^www\./.test(t) || /@/.test(t) || /^\d{4}[年./-]\d{1,2}/.test(t) || /^(在职|离职|待业|已离职|应届|退休)$/.test(t)
}

/** 同页 items 按 y 聚类成行（行高阈值 = max(5, 字号×0.5)）。
 *  ⚠️ pdf.js TextItem 的 y 坐标从页面【底部】向上增长（原点左下）——降序排列 = 视觉从上到下。 */
export function clusterRows(pageItems: Array<{ str: string; x: number; y: number; width: number; height: number }>): Array<Array<{ str: string; x: number; y: number; width: number; height: number }>> {
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
export const VERB_PREFIX = /^(基于|采用|使用|支持|提供|优化|设计|主导|负责|参与|实现|维护|开发|搭建|推动|管理|通过|作为|负责的|具备|熟悉|掌握|精通|了解|协助|组织|协调|撰写|制定|集成|负责的)/

/** 2026-08-10：两列 x 间隙阈值（pt）——真两列（左标签列右缘 << 右值列左缘）通常 ≥18；
 *  单列文本行内 token 空格间隙（"字节跳动 高级前端工程师"）< 18 → 过滤误判 */
export const PAIR_GAP_THRESHOLD = 18

/**
 * 抽取 PDF 文本 + 坐标结构（字节入参，浏览器/Node 通用）：
 * 文本 = extractText（阅读顺序，与 extractPdfText 一致——rules 的"姓名首行/第 2 行职业"假设依赖阅读序）；
 * pairs = extractTextItems 坐标两列候选（左短右长，作 B 档 customFields 兜底，低置信交三步核对）。
 * 入参 bytes 不被转移所有权（内部拷贝后交 pdf.js，防 transfer 置空调用方 buffer）。
 */
export async function extractPdfLinesFromBytes(bytes: Uint8Array): Promise<PdfLinesResult> {
  let rawText: string
  let pageItems: Array<Array<{ str: string; x: number; y: number; width: number; height: number }>>
  try {
    const { getDocumentProxy, extractText, extractTextItems } = await loadUnpdf()
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
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
