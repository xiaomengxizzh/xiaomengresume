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
  type ImportDraft,
  type ImportFormat,
  type ImportProgress,
  type ImportRunArgs
} from '../../shared/ipc-channels'
import { AiServiceError } from '../ai/config'
import { ImportError } from './errors'
import { importJson } from './json'
import { extractPdfText, visionPlaceholderDraft } from './pdf'
import { extractDocxText } from './docx'
import { mapTextToDraft } from './map'

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

/** 分派解析：json 零 AI；pdf/docx 抽取后 AI 映射；image 直接 M4b 占位 */
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
  if (format === 'pdf') {
    emitProgress(sender, 'parse', 0.3)
    const r = await extractPdfText(filePath)
    if (r.needsVision) {
      emitProgress(sender, 'done', 1)
      return visionPlaceholderDraft('pdf', fileName, r.text, r.warnings)
    }
    text = r.text
    warnings = r.warnings
  } else {
    emitProgress(sender, 'parse', 0.3)
    const r = await extractDocxText(filePath)
    text = r.text
    warnings = r.warnings
  }

  // A 档 AI 映射（B 档兜底归 M4a.1）
  emitProgress(sender, 'map', 0.7)
  const draft = await mapTextToDraft(text, fileName, format, warnings)
  emitProgress(sender, 'done', 1)
  return draft
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
}
