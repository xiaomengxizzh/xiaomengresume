/**
 * web-import —— web 端导入实现（渲染端完整管线，纯客户端，2026-09-08）
 *
 * 复用主进程导入解析的纯核心（零 Node 依赖部分）：
 * - PDF：parse-core.ts（unpdf = serverless 友好封装 pdf.js，浏览器可用；坐标聚类/两列候选同一实现）
 * - B 档本地规则：rules.ts（cleanText/splitBySectionAnchors/detectDirtyLayout/rulesToImportMap）
 * - JSON：@shared/schema/resume 的 migrate（版本迁移 + Zod 校验）
 * 与主进程的差异（诚实登记，不造假）：
 * - 文件选择 = 浏览器 <input type="file">（替代主进程 dialog）
 * - 仅 B 档（无 AI 映射）——与主进程 A 档失败后的降级路径同一实现，结果一致
 * - PDF 头像提取：unpdf extractImages + 浏览器 canvas 编码 PNG（替代主进程 node:zlib），
 *   启发式/像素上限/失败回落与主进程一致
 * - 扫描件/图片 → needsVision 占位草稿（与主进程 M4b 占位一致，非错误）
 * 隐私：文件全程不离开浏览器（无上传，符合数据主权承诺）。
 */
import type {
  AiErrorCode,
  AiResult,
  ImportBatchResult,
  ImportDraft,
  ImportFormat,
  ImportProgress,
  ImportRunArgs
} from '@shared/ipc-channels'
import { importMapToResume } from '@shared/schema/import-map'
import { migrate, type Resume } from '@shared/schema/resume'
import { DATE_RANGE_SEP } from '@shared/templates/layout'
import { ImportError } from '../../../main/import/errors'
import { extractPdfLinesFromBytes, visionPlaceholderDraft } from '../../../main/import/parse-core'
import { cleanText, detectDirtyLayout, rulesToImportMap, splitBySectionAnchors } from '../../../main/import/rules'

/** 提取图片上限（像素数，防超大图撑爆内存；与主进程 PDF_PHOTO_MAX_PIXELS 同值） */
const PDF_PHOTO_MAX_PIXELS = 4_000_000
/**
 * web 端照片编码约束：简历存 localStorage（配额约 5-10MB/站点），全分辨率 PNG
 * 单张即可达 ~2MB。按显示尺寸（photoWidth=110pt）× 300DPI 上限缩放 + JPEG 编码，
 * 单张 ~几十 KB；桌面端存文件系统保留原分辨率（两端策略差异，见日志）。
 */
const PHOTO_MAX_SIDE = 460
const PHOTO_JPEG_QUALITY = 0.85

/** 提取结果（dataURL + 原始尺寸，供 photoWidth/photoHeight 等比缩放） */
interface ExtractedPhoto {
  dataUrl: string
  width: number
  height: number
}

/**
 * 提取 PDF 第 1 页面积最大的嵌入图 → PNG dataURL（浏览器版，与主进程 extractPdfPhoto 同启发式）。
 * ⚠️ 不可用 unpdf 的 extractImages：浏览器 pdf.js 将图片解码为 {bitmap: ImageBitmap}
 * （无 .data 字段），其实现只认 .data → 恒返回空（node 下为原始字节所以正常）。
 * 此处直接遍历绘制指令，bitmap 直接 drawImage，data 按 RGBA/RGB/灰度扩转后 putImageData。
 * objs 等待带 5s 超时防挂起；无图/失败/超大图返回 null 不阻断导入（与主进程一致）。
 */
async function extractLargestPhotoCanvas(bytes: Uint8Array): Promise<ExtractedPhoto | null> {
  try {
    const { getDocumentProxy, getResolvedPDFJS } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const { OPS } = await getResolvedPDFJS()
    const page = await pdf.getPage(1)
    const opList = await page.getOperatorList()
    let best: ExtractedPhoto | null = null
    let bestArea = 0
    for (let i = 0; i < opList.fnArray.length; i++) {
      if (opList.fnArray[i] !== OPS.paintImageXObject) continue
      const key = opList.argsArray[i][0] as string
      const img = await new Promise<Record<string, unknown> | undefined>((resolve) => {
        const timer = setTimeout(() => resolve(undefined), 5000)
        const store = key.startsWith('g_') ? page.commonObjs : page.objs
        try {
          store.get(key, (v: Record<string, unknown>) => {
            clearTimeout(timer)
            resolve(v)
          })
        } catch {
          clearTimeout(timer)
          resolve(undefined)
        }
      })
      if (!img) continue
      const width = Number(img.width)
      const height = Number(img.height)
      if (!width || !height) continue
      const area = width * height
      if (area <= bestArea || area > PDF_PHOTO_MAX_PIXELS) continue
      // 全尺寸绘制到临时位面（bitmap 直接 draw；data 按通道扩转 RGBA 后 put）
      const full = document.createElement('canvas')
      full.width = width
      full.height = height
      const fullCtx = full.getContext('2d')
      if (!fullCtx) continue
      const bitmap = img.bitmap as ImageBitmap | undefined
      const data = img.data as Uint8ClampedArray | undefined
      if (bitmap) {
        fullCtx.drawImage(bitmap, 0, 0)
      } else if (data && data.length === width * height * 4) {
        fullCtx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0)
      } else if (data && (data.length === width * height * 3 || data.length === width * height)) {
        // RGB/灰度 → RGBA 扩展
        const ch = data.length / (width * height)
        const rgba = new Uint8ClampedArray(width * height * 4)
        for (let p = 0, q = 0; p < width * height; p++, q += 4) {
          if (ch === 3) {
            rgba[q] = data[p * 3]
            rgba[q + 1] = data[p * 3 + 1]
            rgba[q + 2] = data[p * 3 + 2]
            rgba[q + 3] = 255
          } else {
            rgba[q] = data[p]
            rgba[q + 1] = data[p]
            rgba[q + 2] = data[p]
            rgba[q + 3] = 255
          }
        }
        fullCtx.putImageData(new ImageData(rgba, width, height), 0, 0)
      } else {
        continue
      }
      // 按 300DPI@显示尺寸 缩放 + JPEG 编码（localStorage 配额友好）
      const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(width, height))
      const tw = Math.max(1, Math.round(width * scale))
      const th = Math.max(1, Math.round(height * scale))
      const out = document.createElement('canvas')
      out.width = tw
      out.height = th
      const outCtx = out.getContext('2d')
      if (!outCtx) continue
      outCtx.imageSmoothingQuality = 'high'
      outCtx.drawImage(full, 0, 0, tw, th)
      best = { dataUrl: out.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY), width, height }
      bestArea = area
    }
    return best
  } catch {
    return null
  }
}

/** 照片注入（镜像主进程 applyPhoto：basics.photo 空 → 写入 + 等比缩放到模板基准宽 110） */
function applyPhotoToDraft(
  draft: ImportDraft,
  photo: { dataUrl: string; width: number; height: number } | null
): ImportDraft {
  if (photo && !draft.resume.basics.photo) {
    draft.resume.basics.photo = photo.dataUrl
    const MAX_PHOTO_W = 110
    const scale = photo.width > MAX_PHOTO_W ? MAX_PHOTO_W / photo.width : 1
    draft.resume.basics.photoWidth = Math.max(40, Math.round(photo.width * scale))
    draft.resume.basics.photoHeight = Math.max(40, Math.round(photo.height * scale))
  }
  return draft
}

/** 导入全流程超时兜底（与主进程 IMPORT_TIMEOUT_MS 一致） */
const IMPORT_TIMEOUT_MS = 30_000

/** 浏览器 input accept 映射（对应主进程 FILTERS） */
const ACCEPT_MAP: Record<ImportFormat, string> = {
  pdf: '.pdf',
  docx: '.docx',
  json: '.json',
  image: '.png,.jpg,.jpeg,.webp'
}

/** 扩展名 → 格式（runBatch 混合选择时按实际扩展名分派，与主进程一致） */
function formatOfFileName(name: string): ImportFormat | undefined {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  if (ext === '.pdf') return 'pdf'
  if (ext === '.docx') return 'docx'
  if (ext === '.json') return 'json'
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'image'
  return undefined
}

/* ── 进度事件（对应主进程 webContents.send('import:progress')）────────────── */

const progressCbs = new Set<(p: ImportProgress) => void>()

/** 注册导入进度监听（返回退订函数；mock 的 import.onProgress 委托至此） */
export function onImportProgress(cb: (p: ImportProgress) => void): () => void {
  progressCbs.add(cb)
  return () => {
    progressCbs.delete(cb)
  }
}

function emitProgress(phase: ImportProgress['phase'], ratio: number): void {
  for (const cb of progressCbs) cb({ phase, ratio })
}

/* ── 错误归一（对齐 run.ts toImportAiError 的本地子集；AI SDK 分支 web 无需）── */

function toImportAiError(err: unknown): { code: AiErrorCode; message?: string } {
  if (err instanceof ImportError) return { code: err.code, message: err.message }
  const e = err as { code?: string; message?: string }
  if (e.code === 'aborted') return { code: 'CANCELLED' }
  console.error('[web-import] unhandled error:', err)
  return { code: 'UNKNOWN', message: e.message }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new ImportError('TIMEOUT', `import timeout after ${ms}ms`)), ms)
    })
  ])
}

/* ── 文件选择（替代主进程 dialog.showOpenDialog）─────────────────────────── */

let forcedNextFiles: File[] | null = null

/**
 * 测试/自动化钩子：下一次 pickFiles 直接返回注入文件（不打开选择器）。
 * 仅 dev 层使用；生产路径不受影响（正常调用总会重置为 null）。
 */
export function setNextPickedFiles(files: File[]): void {
  forcedNextFiles = files
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  if (forcedNextFiles) {
    const files = forcedNextFiles
    forcedNextFiles = null
    return Promise.resolve(files)
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    const done = (files: File[]): void => {
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => done([...input.files ?? []]), { once: true })
    input.addEventListener('cancel', () => done([]), { once: true })
    document.body.appendChild(input)
    input.click()
  })
}

/* ── B 档本地规则草稿（与 run.ts rulesDraft 同一实现；run.ts 顶层 electron 不可引入）── */

function rulesDraftLocal(
  text: string,
  fileName: string,
  format: 'pdf' | 'docx',
  warnings: string[],
  pairs?: Array<{ label: string; value: string }>
): ImportDraft {
  const clean = cleanText(text)
  const sections = splitBySectionAnchors(clean)
  const hints = detectDirtyLayout(clean, sections)
  const map = rulesToImportMap(sections, pairs)
  const resume = importMapToResume(map)
  const ws = [...warnings, 'import.warning.localRules']
  if (hints.length > 0) ws.push('import.warning.dirtyLayout')
  return {
    format,
    fileName,
    sourcePreview: clean.slice(0, 2000),
    resume,
    warnings: ws
  }
}

/* ── DOCX（mammoth 浏览器构建；htmlToPlainText 与 docx.ts 同步副本——该文件顶层 node:fs）── */

/** HTML → 纯文本：块级标签/li 转行，实体解码，空行合并（同步自 main/import/docx.ts） */
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

async function parseDocxBytes(bytes: Uint8Array): Promise<{ text: string; warnings: string[] }> {
  type MammothModule = {
    convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: unknown[] }>
  }
  let result: { value: string; messages: unknown[] }
  try {
    const mod = (await import('mammoth')) as unknown
    const m = (mod as { default?: MammothModule }).default ?? (mod as MammothModule)
    if (!m || typeof m.convertToHtml !== 'function') {
      throw new Error('mammoth failed to load')
    }
    // 拷贝出独立 ArrayBuffer（bytes 底层 buffer 可能大于视图范围）
    result = await m.convertToHtml({
      arrayBuffer: bytes.slice().buffer as ArrayBuffer
    })
  } catch {
    throw new ImportError('PARSE_FAILED', 'cannot parse docx (corrupted or unsupported?)')
  }
  const text = htmlToPlainText(result.value)
  const warnings: string[] = []
  if (result.messages?.length > 0) warnings.push('import.warning.docx')
  return { text, warnings }
}

/* ── JSON（与 json.ts importJson 同一逻辑；resumeToPreview 同步副本）──────── */

/** 简��� → 纯文本预览（≤2000 字符；同步自 main/import/json.ts resumeToPreview） */
function resumeToPreview(resume: ReturnType<typeof migrate>): string {
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
    const line = [e.school, e.degree, e.major, [e.startDate, e.endDate].filter(Boolean).join(DATE_RANGE_SEP)]
      .filter(Boolean)
      .join(' · ')
    if (line) parts.push(line)
  }
  for (const w of resume.work) {
    const line = [w.title, w.company, w.location, [w.startDate, w.endDate].filter(Boolean).join(DATE_RANGE_SEP)]
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

function parseJsonText(raw: string, fileName: string): ImportDraft {
  let data: unknown
  try {
    data = JSON.parse(raw) as unknown
  } catch {
    throw new ImportError('PARSE_FAILED', 'invalid JSON')
  }
  let resume: ReturnType<typeof migrate>
  try {
    resume = migrate(data)
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

/* ── 单文件解析分派（镜像 run.ts runImport 的 B 档等价路径）────────────────── */

/** 单文件解析（导出供 vitest / 浏览器自动化直接投喂 File，绕过选择器） */
export async function parseFile(file: File, requested: ImportFormat | undefined): Promise<ImportDraft> {
  const format = formatOfFileName(file.name) ?? requested
  if (!format) throw new ImportError('UNSUPPORTED', `unsupported file: ${file.name}`)

  if (format === 'image') {
    emitProgress('done', 1)
    return visionPlaceholderDraft('image', file.name, '', ['import.warning.vision'])
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  if (format === 'json') {
    emitProgress('parse', 0.3)
    const text = new TextDecoder().decode(bytes)
    emitProgress('done', 1)
    return parseJsonText(text, file.name)
  }

  let text: string
  let warnings: string[]
  let pairs: Array<{ label: string; value: string }> = []
  let pdfPhoto: { dataUrl: string; width: number; height: number } | null = null
  if (format === 'pdf') {
    emitProgress('parse', 0.3)
    const r = await extractPdfLinesFromBytes(bytes)
    if (r.needsVision) {
      emitProgress('done', 1)
      return visionPlaceholderDraft('pdf', file.name, r.text, r.warnings)
    }
    text = r.text
    warnings = r.warnings
    pairs = r.pairs
    // PDF 头像（2026-09-08 web 端补齐）：第二次独立解析提取嵌入图（与主进程 X1 各持拷贝同模式）
    pdfPhoto = await extractLargestPhotoCanvas(bytes)
  } else {
    emitProgress('parse', 0.3)
    const r = await parseDocxBytes(bytes)
    text = r.text
    warnings = r.warnings
  }

  // web 端固定 B 档（无 AI BYOK）——与主进程 A 档失败降级后的路径完全一致
  emitProgress('map', 0.7)
  emitProgress('done', 1)
  const draft = rulesDraftLocal(text, file.name, format, warnings, pairs)
  return format === 'pdf' ? applyPhotoToDraft(draft, pdfPhoto) : draft
}

/* ── 对外入口（mock 的 import.run / import.runBatch 委托至此）──────────────── */

/** 单份导入：选择器 → 解析 → 草稿（契约与主进程 import:run 一致） */
export async function webImportRun(args: ImportRunArgs): Promise<AiResult<ImportDraft>> {
  const requested: ImportFormat | undefined = args?.format
  if (!requested || !(requested in ACCEPT_MAP)) {
    return { ok: false, error: { code: 'UNSUPPORTED' } }
  }
  try {
    const files = await pickFiles(ACCEPT_MAP[requested], false)
    if (files.length === 0) {
      return { ok: false, error: { code: 'CANCELLED' } }
    }
    const draft = await withTimeout(parseFile(files[0], requested), IMPORT_TIMEOUT_MS)
    return { ok: true, data: draft }
  } catch (err) {
    const e = toImportAiError(err)
    return { ok: false, error: { code: e.code, message: e.message } }
  }
}

/** 批量导入：多选 → 逐份解析 → 直接落盘（saveOne 由 localStorage mock 提供） */
export async function webImportRunBatch(
  saveOne: (id: string, resume: Resume) => void
): Promise<AiResult<ImportBatchResult>> {
  try {
    const files = await pickFiles('.pdf,.docx,.json', true)
    if (files.length === 0) {
      return { ok: false, error: { code: 'CANCELLED' } }
    }
    const result: ImportBatchResult = { imported: 0, failed: [] }
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      emitProgress('parse', (i + 0.3) / files.length)
      try {
        const draft = await withTimeout(parseFile(file, undefined), IMPORT_TIMEOUT_MS)
        // 扫描件/图片：不落盘，计入失败提示需视觉识别（与主进程一致）
        if (draft.needsVision) {
          result.failed.push({ fileName: file.name, code: 'VISION_REQUIRED' })
          continue
        }
        const id = crypto.randomUUID()
        const resume = { ...draft.resume, title: file.name.replace(/\.[^.]+$/, '') }
        saveOne(id, resume)
        result.imported++
      } catch (err) {
        const e = toImportAiError(err)
        result.failed.push({ fileName: file.name, code: e.code, message: e.message })
      }
    }
    emitProgress('done', 1)
    return { ok: true, data: result }
  } catch (err) {
    const e = toImportAiError(err)
    return { ok: false, error: { code: e.code, message: e.message } }
  }
}
