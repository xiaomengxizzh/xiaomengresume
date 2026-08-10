/**
 * import/run.ts —— M4a import:run 入口（2026-08-09）
 * 流程：format 校验 → 主进程 dialog 选文件（渲染层不传路径，防路径穿越，与 backup import 同模式）
 *   → 分派（json 零 AI / pdf+docx AI 映射 / image M4b 占位）→ import:progress 事件 → AiResult<ImportDraft>。
 * 超时兜底 30s（仿 export/run，R4）；错误统一转 AiResult（ImportError + AiServiceError 保留结构化码）。
 * 对话框 label 用英文（主进程无 i18n，CH4 豁免，与 backup import 一致）。
 */
import { BrowserWindow, dialog, ipcMain } from 'electron'
import * as path from 'node:path'
import {
  IPC,
  type AiError,
  type AiResult,
  type ImportBatchResult,
  type ImportDraft,
  type ImportFormat,
  type ImportProgress,
  type ImportRunArgs
} from '../../shared/ipc-channels'
import { AiServiceError } from '../ai/config'
import { ImportError } from './errors'
import { importJson } from './json'
import { extractPdfLines, extractPdfPhoto, visionPlaceholderDraft, type PdfPhotoResult } from './pdf'
import { extractDocxText } from './docx'
import { mapTextToDraft } from './map'
import { cleanText, splitBySectionAnchors, detectDirtyLayout, rulesToImportMap } from './rules'
import { importMapToResume } from '../../shared/schema/import-map'
import { saveResume } from '../files/resume-store'

/** 导入全流程超时兜底（R4 大文件/网络慢兜底；仿 export/run） */
export const IMPORT_TIMEOUT_MS = 30_000

const FILTERS: Record<ImportFormat, Electron.FileFilter[]> = {
  pdf: [{ name: 'PDF', extensions: ['pdf'] }],
  docx: [{ name: 'Word', extensions: ['docx'] }],
  json: [{ name: 'JSON', extensions: ['json'] }],
  image: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
}

/** 通知渲染进程导入进度（import:progress） */
function emitProgress(sender: Electron.WebContents, phase: ImportProgress['phase'], ratio: number): void {
  if (sender && !sender.isDestroyed()) {
    sender.send('import:progress', { phase, ratio } satisfies ImportProgress)
  }
}

/**
 * 统一错误 → AiResult 错误码（ImportError + AiServiceError 保留结构化码；
 * AI SDK 错误码映射与 register-ai 的 toAiError 对齐——2026-08-09 修复：
 * 原未映射 APICallError（网络/限流/超时）全落 UNKNOWN，用户只见"请重试"无法定位）。
 */
export function toImportAiError(err: unknown): AiError {
  if (err instanceof ImportError) return { code: err.code, message: err.message }
  if (err instanceof AiServiceError) return { code: err.code, message: err.message }
  const e = err as { name?: string; statusCode?: number; code?: string; message?: string }
  if (e.name === 'AbortError' || e.code === 'aborted') return { code: 'CANCELLED' }
  if (e.statusCode === 429 || e.code === 'rate_limit') return { code: 'RATE_LIMIT' }
  if (e.statusCode !== undefined && e.statusCode >= 500) return { code: 'NETWORK' }
  if (e.code === 'timeout' || /timeout|timed out/i.test(e.message ?? '')) return { code: 'TIMEOUT' }
  if (e.code === 'INVALID_RESPONSE' || /parse|schema|json/i.test(e.message ?? '')) {
    return { code: 'INVALID_RESPONSE', message: e.message }
  }
  // 未知错误：打印真实错误辅助定位（dev 终端可见），前端按 UNKNOWN 提示
  console.error('[import] unhandled error:', err)
  return { code: 'UNKNOWN', message: e.message }
}

/** 超时包装：超时 → ImportError('TIMEOUT')（Promise.race 泄漏防护：原 promise 仍会 settle，仅忽略） */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ImportError('TIMEOUT', `import timeout after ${ms}ms`)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

/**
 * B 档本地规则兜底（M4a.1，定案 §3.19 A）：A 档（AI）失败/不可用时纯本地解析。
 * 只负责"先分段"，字段归属由三步核对向导兜底；dirtyLayout 提示切 A 档。
 * warnings 走 i18n key（CH4）。
 */
export async function rulesDraft(
  text: string,
  fileName: string,
  format: 'pdf' | 'docx',
  warnings: string[],
  pairs?: Array<{ label: string; value: string }>
): Promise<ImportDraft> {
  const clean = cleanText(text)
  const sections = splitBySectionAnchors(clean)
  const hints = detectDirtyLayout(clean, sections)
  // 2026-08-10：坐标两列候选对（pdf extractPdfLines 产出）并入 B 档映射
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

/** 分派解析：json 零 AI；pdf/docx 抽取后 AI 映射（A 档失败自动降级 B 档本地规则）；image 直接 M4b 占位 */
export async function runImport(
  format: ImportFormat,
  filePath: string,
  fileName: string,
  sender: Electron.WebContents
): Promise<ImportDraft> {
  if (format === 'image') {
    emitProgress(sender, 'done', 1)
    return visionPlaceholderDraft('image', fileName, '', ['import.warning.vision'])
  }

  if (format === 'json') {
    emitProgress(sender, 'parse', 0.3)
    const draft = await importJson(filePath, fileName)
    emitProgress(sender, 'done', 1)
    return draft
  }

  // pdf / docx：抽取（含扫描件分流）
  let text: string
  let warnings: string[]
  let pdfPhoto: PdfPhotoResult | null = null
  // 2026-08-10：坐标两列候选对（pdf extractPdfLines 产出；B 档 customFields 兜底）
  let pairs: Array<{ label: string; value: string }> = []
  if (format === 'pdf') {
    emitProgress(sender, 'parse', 0.3)
    const r = await extractPdfLines(filePath)
    if (r.needsVision) {
      emitProgress(sender, 'done', 1)
      return visionPlaceholderDraft('pdf', fileName, r.text, r.warnings)
    }
    text = r.text
    warnings = r.warnings
    pairs = r.pairs
    // 2026-08-09：提取 PDF 头像（文本型 PDF；扫描件走 M4b vision 不在此处理）
    pdfPhoto = await extractPdfPhoto(filePath)
  } else {
    emitProgress(sender, 'parse', 0.3)
    const r = await extractDocxText(filePath)
    text = r.text
    warnings = r.warnings
  }

  // A 档 AI 映射（M4a.1：失败自动降级 B 档本地规则——无 AI/网络失败也能导入）
  emitProgress(sender, 'map', 0.7)
  const applyPhoto = (draft: ImportDraft): ImportDraft => {
    if (pdfPhoto && !draft.resume.basics.photo) {
      draft.resume.basics.photo = pdfPhoto.dataUrl
      // 2026-08-09 T2 修复：照片渲染尺寸等比缩放到模板基准宽 110（CLASSIC_PHOTO 110×110，
      // PDF 端 ×0.75 换算）——原直接写提取图像原始像素尺寸，大图导入后占满整张 A4
      const MAX_PHOTO_W = 110
      const scale = pdfPhoto.width > MAX_PHOTO_W ? MAX_PHOTO_W / pdfPhoto.width : 1
      draft.resume.basics.photoWidth = Math.max(40, Math.round(pdfPhoto.width * scale))
      draft.resume.basics.photoHeight = Math.max(40, Math.round(pdfPhoto.height * scale))
    }
    return draft
  }
  try {
    const draft = await mapTextToDraft(text, fileName, format, warnings)
    emitProgress(sender, 'done', 1)
    return applyPhoto(draft)
  } catch (err) {
    // B 档兜底：任何 A 档失败（NO_PROVIDER/网络/脏输出）都降级本地规则，不阻断导入
    console.warn(`[import] A 档映射失败，降级 B 档本地规则（${format}）:`, err)
    const draft = await rulesDraft(text, fileName, format, warnings, pairs)
    emitProgress(sender, 'done', 1)
    return applyPhoto(draft)
  }
}

/** import:run 注册入口（register.ts 调用） */
export function registerImportIpc(): void {
  ipcMain.handle(
    IPC.Import.Run,
    async (event, args: ImportRunArgs): Promise<AiResult<ImportDraft>> => {
      const sender = event.sender
      const win = BrowserWindow.fromWebContents(sender)
      if (!win) {
        // 诊断日志：sender 非窗口 webContents（异常时序），返回 UNKNOWN 前记录
        console.warn('[import] BrowserWindow.fromWebContents 返回 null，sender 非窗口上下文')
        return { ok: false, error: { code: 'UNKNOWN' } }
      }

      const format: ImportFormat | undefined = args?.format
      if (!format || !(format in FILTERS)) {
        return { ok: false, error: { code: 'UNSUPPORTED' } }
      }

      let filePath: string | undefined
      try {
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
          title: 'Import resume',
          filters: FILTERS[format],
          properties: ['openFile']
        })
        if (canceled || filePaths.length === 0) {
          return { ok: false, error: { code: 'CANCELLED' } }
        }
        filePath = filePaths[0]
      } catch (err) {
        // 对话框异常（平台差异/时序）——记录并转结构化错误，不让 handler 裸 reject
        console.error('[import] showOpenDialog 异常:', err)
        return { ok: false, error: toImportAiError(err) }
      }
      const fileName = path.basename(filePath)

      try {
        const draft = await withTimeout(runImport(format, filePath, fileName, sender), IMPORT_TIMEOUT_MS)
        return { ok: true, data: draft }
      } catch (err) {
        return { ok: false, error: toImportAiError(err) }
      }
    }
  )

  // ── 2026-08-09 R8：批量导入（多选 → 逐份解析 → 直接落盘为独立新简历，无需三步核对）──
  ipcMain.handle(
    IPC.Import.RunBatch,
    async (event): Promise<AiResult<ImportBatchResult>> => {
      const sender = event.sender
      const win = BrowserWindow.fromWebContents(sender)
      if (!win) {
        console.warn('[import] BrowserWindow.fromWebContents 返回 null，sender 非窗口上下文')
        return { ok: false, error: { code: 'UNKNOWN' } }
      }

      // 多选：混合格式（pdf/docx/json）统一过滤；image 走 M4b 占位（计入 failed，提示需视觉）
      let filePaths: string[]
      try {
        const r = await dialog.showOpenDialog(win, {
          title: 'Import resumes (batch)',
          filters: [
            { name: 'Resumes', extensions: ['pdf', 'docx', 'json'] },
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'Word', extensions: ['docx'] },
            { name: 'JSON', extensions: ['json'] }
          ],
          properties: ['openFile', 'multiSelections']
        })
        if (r.canceled || r.filePaths.length === 0) {
          return { ok: false, error: { code: 'CANCELLED' } }
        }
        filePaths = r.filePaths
      } catch (err) {
        console.error('[import] showOpenDialog（batch）异常:', err)
        return { ok: false, error: toImportAiError(err) }
      }

      const result: ImportBatchResult = { imported: 0, failed: [] }
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]
        const fileName = path.basename(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const format: ImportFormat | undefined = ext === '.pdf' ? 'pdf' : ext === '.docx' ? 'docx' : ext === '.json' ? 'json' : undefined
        emitProgress(sender, 'parse', (i + 0.3) / filePaths.length)
        try {
          if (!format) throw new ImportError('UNSUPPORTED', `unsupported file: ${fileName}`)
          const draft = await withTimeout(runImport(format, filePath, fileName, sender), IMPORT_TIMEOUT_MS)
          // 扫描件/图片（M4b 占位）：不落盘，计入失败提示需视觉识别
          if (draft.needsVision) {
            result.failed.push({ fileName, code: 'VISION_REQUIRED' })
            continue
          }
          // 直接落盘为独立新简历（标题 = 文件名去扩展名；id = uuid，文件存储）
          const id = crypto.randomUUID()
          const resume = { ...draft.resume, title: fileName.replace(/\.[^.]+$/, '') }
          await saveResume(id, resume)
          result.imported++
        } catch (err) {
          const e = toImportAiError(err)
          result.failed.push({ fileName, code: e.code, message: e.message })
        }
      }
      emitProgress(sender, 'done', 1)
      return { ok: true, data: result }
    }
  )
}
