import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AppInfo,
  type RecentResume,
  type ResumeSummary,
  type ExportRunArgs,
  type ExportRunResult,
  type ExportProgress
} from '@shared/ipc-channels'
import type { Resume } from '@shared/schema/resume'

/** preload 暴露的 API（类型见 index.d.ts 全局增强） */
const electronAPI = {
  app: {
    ping: (): Promise<{ pong: boolean; at: number }> =>
      ipcRenderer.invoke(IPC.App.Ping),
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.App.GetInfo)
  },
  print: {
    pdf: (html: string): Promise<{ data: ArrayBuffer; mimeType: string }> =>
      ipcRenderer.invoke(IPC.Print.Pdf, html)
  },
  export: {
    /** M2 F5：导出（textPdf/json v1.0；imagePdf/image v1.1）；进度经 onProgress 订阅 */
    run: (args: ExportRunArgs): Promise<ExportRunResult> => ipcRenderer.invoke(IPC.Export.Run, args),
    onProgress: (cb: (p: ExportProgress) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, p: ExportProgress): void => cb(p)
      ipcRenderer.on('export:progress', listener)
      return () => {
        ipcRenderer.removeListener('export:progress', listener)
      }
    }
  },
  ai: {
    streamTest: (): Promise<{ ok: boolean; full: string }> =>
      ipcRenderer.invoke(IPC.Ai.StreamTest),
    onStreamChunk: (cb: (delta: string) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: { delta: string }): void =>
        cb(payload.delta)
      ipcRenderer.on('ai:stream:chunk', listener)
      return () => {
        ipcRenderer.removeListener('ai:stream:chunk', listener)
      }
    }
  },
  resumes: {
    /** F11 简历生命周期（M1 落码） */
    save: (id: string, resume: Resume): Promise<Resume> =>
      ipcRenderer.invoke(IPC.Resume.Save, { id, resume }),
    open: (id: string): Promise<Resume> => ipcRenderer.invoke(IPC.Resume.Open, id),
    duplicate: (id: string): Promise<{ id: string; resume: Resume }> =>
      ipcRenderer.invoke(IPC.Resume.Duplicate, id),
    rename: (id: string, name: string): Promise<Resume> =>
      ipcRenderer.invoke(IPC.Resume.Rename, { id, name }),
    remove: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.Resume.Delete, id),
    list: (): Promise<ResumeSummary[]> => ipcRenderer.invoke(IPC.Resume.List),
    recent: (): Promise<RecentResume[]> => ipcRenderer.invoke(IPC.Resumes.Recent),
    scanRecovery: (): Promise<string[]> => ipcRenderer.invoke(IPC.Resume.ScanRecovery),
    recover: (id: string): Promise<Resume | null> => ipcRenderer.invoke(IPC.Resume.Recover, id),
    createSample: (): Promise<{ id: string; resume: Resume }> => ipcRenderer.invoke(IPC.Resume.CreateSample)
  },
  backup: {
    exportZip: (): Promise<string | null> => ipcRenderer.invoke(IPC.Backup.Export),
    importZip: (): Promise<number> => ipcRenderer.invoke(IPC.Backup.Import)
  }
}

export type ElectronAPI = typeof electronAPI

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
