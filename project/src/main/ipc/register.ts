/**
 * IPC 注册（M0 扩展 · M1 · M3 AI/岗位）
 * 契约冻结于 src/shared/ipc-channels.ts；渲染进程一律经 preload 暴露的 electronAPI 调用。
 * resume:* 通道（F11）：save / open / duplicate / rename / delete / list + resumes:recent
 * + backup:export/import；jobs:*（F19）+ resume:bind-job/unbind-job（M3 实现）；
 * ai:* 四分区 + ai:config:*（M3，见 registerAiIpc）。
 */
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import Store from 'electron-store'
import { IPC, type AppInfo, type RecentResume, type ResumeSummary, type StorageInfo, type StorageSetResult } from '@shared/ipc-channels'
import type { Settings } from '../../shared/schema/settings'
import { SettingsSchema } from '../../shared/schema/settings'
import { printHtmlToPdf } from '../print/pdf'
import { registerExportIpc } from '../export/run'
import { registerAiIpc } from '../ai/register-ai'
import { registerImportIpc } from '../import/run'
import {
  saveResume,
  openResume,
  renameResume,
  duplicateResume,
  deleteResume,
  listResumes,
  recentResumes,
  scanPendingRecovery,
  recoverPending,
  exportBackup,
  importBackup,
  bindJob,
  unbindJob
} from '../files/resume-store'
import { listJobs, getJob, saveJob, deleteJob } from '../files/job-store'
import { createSampleResume } from '../files/sample-resume'
import { getStorageDir, clearStorageFallback } from '../files/resume-store'
import { readPhotoFile } from '../files/photo-store'
import { saveFontFile, deleteFontFile, type ImportedFontFile } from '../files/font-store'
import { createZip, type ZipEntry } from '../files/zip'
import { migrateStorage } from '../files/storage-migrate'

const store = new Store<Settings>()

export function registerIpc(): void {
  // app:ping —— 通信冒烟
  ipcMain.handle(IPC.App.Ping, () => ({ pong: true, at: Date.now() }))

  // ── M5 设置读写（2026-08-12；渲染层唯一 settings 链路——外观/模板/字体/存储 UI 共用）──
  ipcMain.handle(IPC.Settings.Get, (): Settings => store.store as Settings)
  ipcMain.handle(IPC.Settings.Set, (_e, patch: unknown): Settings => {
    // 局部更新：merge + SettingsSchema 全量校验（defaults 补齐缺省），再逐键写回
    const merged = SettingsSchema.parse({ ...store.store, ...(patch as object) })
    for (const [k, v] of Object.entries(merged)) {
      store.set(k as never, v as never)
    }
    return store.store as Settings
  })

  // ── M5 D5 字体系统（font:import/font:remove，契约 M5-1 冻结）──
  ipcMain.handle(IPC.Font.Import, async (): Promise<ImportedFontFile | null> => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const entry = await saveFontFile(res.filePaths[0], path.basename(res.filePaths[0]))
    const fonts = store.get('importedFonts') ?? []
    store.set('importedFonts', [...fonts, entry])
    return entry
  })
  ipcMain.handle(IPC.Font.Remove, async (_e, id: string): Promise<void> => {
    const fonts = store.get('importedFonts') ?? []
    const entry = fonts.find((f) => f.id === id)
    if (!entry) return
    await deleteFontFile(id, entry.fileName)
    store.set('importedFonts', fonts.filter((f) => f.id !== id))
  })

  // ── M5-6 D6 本地日志导出（logs:export，契约 M5-1 冻结；打包 logs/*.log* → zip，二次扫描脱敏）──
  ipcMain.handle(IPC.Logs.Export, async (): Promise<string | null> => {
    const logsDir = path.join(app.getPath('userData'), 'logs')
    const files = await fs.readdir(logsDir).catch(() => [] as string[])
    const logs = files.filter((f) => f.endsWith('.log'))
    if (logs.length === 0) return null
    const entries: ZipEntry[] = []
    for (const f of logs) {
      let content = await fs.readFile(path.join(logsDir, f), 'utf-8')
      // 二次扫描剔除 Key 痕迹（sk- 前缀等疑似凭据）
      content = content.replace(/sk-[A-Za-z0-9_-]{8,}/g, '<redacted>')
      entries.push({ name: f, data: Buffer.from(content, 'utf-8') })
    }
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const res = await dialog.showSaveDialog({
      defaultPath: `xiaomengresume-logs-${date}.zip`,
      filters: [{ name: 'Zip', extensions: ['zip'] }]
    })
    if (res.canceled || !res.filePath) return null
    await fs.writeFile(res.filePath, createZip(entries))
    return res.filePath
  })

  // app:get-info —— 版本信息展示
  ipcMain.handle(IPC.App.GetInfo, (): AppInfo => {
    return {
      name: 'xiaomengresume',
      version: app.getVersion(),
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node ?? ''
    }
  })

  // print:pdf —— 端到端验证
  ipcMain.handle(IPC.Print.Pdf, async (_evt, html: string) => {
    // 2026-08-08 低危加固：渲染进程被攻破时可传任意内容 → 限长度 + 限类型，防异常大 payload
    if (typeof html !== 'string' || html.length > 1_000_000) {
      throw new Error('print:pdf: bad payload')
    }
    const { data, mimeType } = await printHtmlToPdf(html)
    return { data: data.buffer as ArrayBuffer, mimeType }
  })

  // M2 F5：export:run（导出管线：textPdf / json；imagePdf / image v1.1）
  registerExportIpc()

  // ai:stream:test —— AI 流式 IPC 链路验证（M0）
  ipcMain.handle(IPC.Ai.StreamTest, async (event) => {
    // 演示用 mock 流：无 key 环境下验证 IPC 链路；M3 替换为真实 AI SDK streamText
    const chunks = ['你好，', '这是 xiaomengresume 的', 'AI 流式链路验证。']
    for (const chunk of chunks) {
      event.sender.send('ai:stream:chunk', { delta: chunk })
      await new Promise((r) => setTimeout(r, 60))
    }
    return { ok: true, full: chunks.join('') }
  })

  // ── F11 简历生命周期（M1）─────────────────────────────────────────────

  // resume:save —— 自动保存（主进程校验 Zod → 三件套原子写）
  ipcMain.handle(
    IPC.Resume.Save,
    async (_evt, payload: { id: string; resume: unknown }) => {
      if (!payload || typeof payload.id !== 'string') throw new Error('resume:save: bad payload')
      return saveResume(payload.id, payload.resume as never)
    }
  )

  // resume:save-now —— 关窗前静默保存（P2：单向 send，beforeunload 时渲染进程
  // 入队即达、不依赖回执；复用 saveResume 的 Zod 校验 + 三件套原子写）
  ipcMain.on(IPC.Resume.SaveNow, (_evt, payload: { id: string; resume: unknown }) => {
    if (!payload || typeof payload.id !== 'string') return
    void saveResume(payload.id, payload.resume as never).catch(() => {
      /* 关窗静默保存失败不阻塞退出 */
    })
  })

  // resume:open —— 打开简历（读 + migrate + 刷新 lastOpenedAt 轻量写）
  ipcMain.handle(IPC.Resume.Open, async (_evt, id: string) => openResume(id))

  // resume:duplicate —— 复制简历（新 uuid + 重置 meta）
  ipcMain.handle(IPC.Resume.Duplicate, async (_evt, id: string) => duplicateResume(id))

  // resume:rename —— 仅改 basics.name
  ipcMain.handle(IPC.Resume.Rename, async (_evt, payload: { id: string; name: string }) => {
    if (!payload || typeof payload.id !== 'string' || typeof payload.name !== 'string') {
      throw new Error('resume:rename: bad payload')
    }
    return renameResume(payload.id, payload.name)
  })

  // resume:delete —— 删除 + 同步删 .bak
  ipcMain.handle(IPC.Resume.Delete, async (_evt, id: string) => deleteResume(id))

  // resume:list —— 摘要列表（F19 反查 boundJobIds）
  ipcMain.handle(IPC.Resume.List, async (): Promise<ResumeSummary[]> => listResumes())

  // resumes:recent —— 最近简历（按 lastActivityAt 倒序，WP-T1）
  ipcMain.handle(IPC.Resumes.Recent, async (): Promise<RecentResume[]> => recentResumes())

  // backup:export / import —— 三件套 c（zip 零依赖）
  ipcMain.handle(IPC.Backup.Export, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    return exportBackup(win)
  })
  ipcMain.handle(IPC.Backup.Import, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return 0
    return importBackup(win)
  })

  // 崩溃恢复（三件套 a）—— 启动时渲染进程调用
  ipcMain.handle(IPC.Resume.ScanRecovery, async (): Promise<string[]> => scanPendingRecovery())
  ipcMain.handle(IPC.Resume.Recover, async (_evt, id: string) => recoverPending(id))

  // 内置示例简历（M1 补口）：新 uuid + 写盘（三件套 + meta 补齐）→ 返回可直接 loadResume
  ipcMain.handle(IPC.Resume.CreateSample, async (): Promise<{ id: string; resume: unknown }> => {
    const id = crypto.randomUUID()
    const resume = await saveResume(id, createSampleResume())
    return { id, resume }
  })

  // ── F19 岗位绑定（M3，契约 M1 已冻结）───────────────────────────────────
  ipcMain.handle(IPC.Resume.BindJob, async (_e, payload: { resumeId: string; jobId: string }) =>
    bindJob(payload.resumeId, payload.jobId)
  )
  ipcMain.handle(IPC.Resume.UnbindJob, async (_e, payload: { resumeId: string; jobId: string }) =>
    unbindJob(payload.resumeId, payload.jobId)
  )
  // B1：resume:read-photo —— 读取照片文件（photo 为路径引用时渲染/导出用；主进程限
  // photos/ 目录 + basename/UUID 白名单防路径穿越；data: 内嵌无需此通道）
  ipcMain.handle(IPC.Resume.ReadPhoto, async (_e, payload: { photoRef: string }) => {
    if (!payload || typeof payload.photoRef !== 'string') return null
    return readPhotoFile(getStorageDir(), payload.photoRef)
  })

  // ── F21 存储位置（技术栈 §3.11.3 定案 · 2026-08-11 落码；设置屏 UI 随 M5）──────
  ipcMain.handle(IPC.Storage.Choose, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: getStorageDir()
    })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })
  ipcMain.handle(IPC.Storage.Get, async (): Promise<StorageInfo> => {
    const currentPath = getStorageDir()
    let exists = false
    try {
      exists = (await fs.stat(currentPath)).isDirectory()
    } catch {
      /* 目录不存在 */
    }
    return { defaultPath: path.join(app.getPath('documents'), 'xiaomengresume'), currentPath, exists }
  })
  ipcMain.handle(IPC.Storage.Set, async (_e, newDir: unknown): Promise<StorageSetResult> => {
    if (typeof newDir !== 'string' || newDir.length === 0) return { ok: false, error: 'invalid path' }
    if (newDir === getStorageDir()) return { ok: true, migrated: 0 }
    try {
      // 校验可写 + 迁移（.json/.bak.*/photos/）；失败不切换、旧数据不动
      const migrated = await migrateStorage(getStorageDir(), newDir)
      store.set('storage.folderPath', newDir)
      clearStorageFallback() // 新目录已校验可写，会话兜底不再必要
      return { ok: true, migrated }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
  ipcMain.handle(IPC.Storage.Reset, async (): Promise<string> => {
    store.delete('storage.folderPath')
    clearStorageFallback()
    return getStorageDir()
  })
  ipcMain.handle(IPC.Storage.Open, (): void => {
    void shell.openPath(getStorageDir())
  })

  // ── F19 岗位目录（M3，契约 M1 已冻结；rename/duplicate 由渲染层 get→改→save 组合）──
  ipcMain.handle(IPC.Jobs.List, async () => listJobs())
  ipcMain.handle(IPC.Jobs.Get, async (_e, id: string) => getJob(id))
  ipcMain.handle(IPC.Jobs.Save, async (_e, job: unknown) => saveJob(job as never))
  ipcMain.handle(IPC.Jobs.Delete, async (_e, id: string) => deleteJob(id))

  // ── M3 AI：四分区 + 服务商配置（registerAiIpc 内部注册 ai:* 全部通道）──────
  registerAiIpc()

  // ── M4a 导入：import:run（PDF/Word/JSON + 图片 M4b 占位）────────────────
  registerImportIpc()
}
