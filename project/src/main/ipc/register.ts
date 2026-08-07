/**
 * IPC 注册（M0 扩展 · M1）
 * 契约冻结于 src/shared/ipc-channels.ts；渲染进程一律经 preload 暴露的 electronAPI 调用。
 * resume:* 通道（F11）：save / open / duplicate / rename / delete / list + resumes:recent
 * + backup:export/import（F19 数据层契约已冻结，jobs:* 主进程实现随 v1.1）。
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC, type AppInfo, type RecentResume, type ResumeSummary } from '@shared/ipc-channels'
import { printHtmlToPdf } from '../print/pdf'
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
  importBackup
} from '../files/resume-store'
import { createSampleResume } from '../files/sample-resume'

export function registerIpc(): void {
  // app:ping —— 通信冒烟
  ipcMain.handle(IPC.App.Ping, () => ({ pong: true, at: Date.now() }))

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
    const { data, mimeType } = await printHtmlToPdf(html)
    return { data: data.buffer as ArrayBuffer, mimeType }
  })

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
}
