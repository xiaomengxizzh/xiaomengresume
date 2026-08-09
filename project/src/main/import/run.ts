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

/** 统一错误 → AiResult 错误码（ImportError + AiServiceError 保留结构化码） */
export function toImportAiError(err: unknown): AiError {
  if (err instanceof ImportError) return { code: err.code, message: err.message }
  if (err instanceof AiServiceError) return { code: err.code, message: err.message }
  const e = err as { name?: string; code?: string; message?: string }
  if (e.name === 'AbortError' || e.code === 'aborted') return { code: 'CANCELLED' }
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
      if (!win) return { ok: false, error: { code: 'UNKNOWN' } }

      const format: ImportFormat | undefined = args?.format
      if (!format || !(format in FILTERS)) {
        return { ok: false, error: { code: 'UNSUPPORTED' } }
      }

      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Import resume',
        filters: FILTERS[format],
        properties: ['openFile']
      })
      if (canceled || filePaths.length === 0) {
        return { ok: false, error: { code: 'CANCELLED' } }
      }
      const filePath = filePaths[0]
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
