import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type AppInfo,
  type RecentResume,
  type ResumeSummary,
  type JobSummary,
  type ExportRunArgs,
  type ExportRunResult,
  type ExportProgress,
  type AiResult,
  type AiStreamChunk,
  type AiConfigView,
  type AiGrammarArgs,
  type AiIntroArgs,
  type AiPolishArgs,
  type AiMatchArgs,
  type ImportRunArgs,
  type ImportDraft,
  type ImportBatchResult,
  type ImportProgress,
  type ReadPhotoResult,
  type StorageInfo,
  type StorageSetResult
} from '@shared/ipc-channels'
import type { Resume } from '@shared/schema/resume'
import type { Job } from '@shared/schema/job'
import type { GrammarIssue } from '@shared/schema/grammar'
import type { MatchScore } from '@shared/schema/match'
import type { AiConfigSaveArgs } from '@shared/schema/ai-config'
import type { AiConfigTestArgs } from '@shared/ipc-channels'

/** 订阅流式 chunk（返回退订函数） */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

// F18 首帧注入（M4a 前置）：主进程经 additionalArguments 传 --xm-theme=<appearance>，
// 写 <html data-theme> 防首帧 FOUC（令牌骨架见 styles.css）。
// 2026-08-09 修复：preload 早期 document.documentElement 可能为 null，原裸访问抛 TypeError
// → 中断整个 preload → contextBridge.exposeInMainWorld 未执行 → window.electronAPI 全 undefined
// （用户端表现为"无法读取 import"、所有 IPC 功能失效）。现 try/catch + 可选链 + DOMContentLoaded 兜底，
// 任何异常都不阻塞 electronAPI 暴露。
function injectTheme(): void {
  try {
    const themeArg = process.argv.find((a) => a.startsWith('--xm-theme='))
    const theme = themeArg?.slice('--xm-theme='.length)
    if (!theme) return
    document.documentElement?.setAttribute('data-theme', theme)
  } catch (err) {
    console.warn('[preload] theme inject failed:', err)
  }
}
injectTheme()
// 兜底：documentElement 首帧未就绪时，DOMContentLoaded 后再补一次
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', injectTheme, { once: true })
}

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
    onProgress: (cb: (p: ExportProgress) => void): (() => void) => subscribe('export:progress', cb)
  },
  ai: {
    /** M0 流式链路验证（XM_AI_MOCK 专用） */
    streamTest: (): Promise<{ ok: boolean; full: string }> =>
      ipcRenderer.invoke(IPC.Ai.StreamTest),
    onStreamChunk: (cb: (delta: string) => void): (() => void) =>
      subscribe<{ delta: string }>('ai:stream:chunk', (p) => cb(p.delta)),

    /** M3 F8 语法纠正（非流式） */
    grammar: (args: AiGrammarArgs): Promise<AiResult<GrammarIssue[]>> =>
      ipcRenderer.invoke(IPC.Ai.Grammar, args),
    /** M3 F20 自我介绍生成/翻译（流式，增量经 onIntroChunk） */
    intro: (args: AiIntroArgs): Promise<AiResult<string>> =>
      ipcRenderer.invoke(IPC.Ai.Intro, args),
    introCancel: (requestId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.Ai.IntroCancel, { requestId }),
    onIntroChunk: (cb: (chunk: AiStreamChunk) => void): (() => void) =>
      subscribe('ai:intro:chunk', cb),
    /** M3 F7 润色（流式，增量经 onPolishChunk） */
    polish: (args: AiPolishArgs): Promise<AiResult<string>> =>
      ipcRenderer.invoke(IPC.Ai.Polish, args),
    polishCancel: (requestId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.Ai.PolishCancel, { requestId }),
    onPolishChunk: (cb: (chunk: AiStreamChunk) => void): (() => void) =>
      subscribe('ai:polish:chunk', cb),
    /** M3 F9 匹配打分（非流式） */
    match: (args: AiMatchArgs): Promise<AiResult<MatchScore>> =>
      ipcRenderer.invoke(IPC.Ai.Match, args),

    /** M3 服务商配置（脱敏读 / 保存，apiKey 走 safeStorage） */
    config: {
      get: (): Promise<AiResult<AiConfigView>> => ipcRenderer.invoke(IPC.Ai.ConfigGet),
      save: (args: AiConfigSaveArgs): Promise<AiResult<boolean>> =>
        ipcRenderer.invoke(IPC.Ai.ConfigSave, args),
      // 2026-08-09 T3：检测模型（临时 apiKey+modelId，不入库）
      test: (args: AiConfigTestArgs): Promise<AiResult<boolean>> =>
        ipcRenderer.invoke(IPC.Ai.ConfigTest, args),
      // 2026-08-09：重置全部 AI 配置为系统预设默认值
      reset: (): Promise<AiResult<boolean>> => ipcRenderer.invoke(IPC.Ai.ConfigReset)
    }
  },
  jobs: {
    /** M3 F19 岗位目录 */
    list: (): Promise<JobSummary[]> => ipcRenderer.invoke(IPC.Jobs.List),
    get: (id: string): Promise<Job> => ipcRenderer.invoke(IPC.Jobs.Get, id),
    save: (job: Job): Promise<Job> => ipcRenderer.invoke(IPC.Jobs.Save, job),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke(IPC.Jobs.Delete, id)
  },
  resumes: {
    /** F11 简历生命周期（M1 落码） */
    save: (id: string, resume: Resume): Promise<Resume> =>
      ipcRenderer.invoke(IPC.Resume.Save, { id, resume }),
    /** 关窗前静默保存（单向 send，不等待回执；P2） */
    saveNow: (id: string, resume: Resume): void =>
      ipcRenderer.send(IPC.Resume.SaveNow, { id, resume }),
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
    createSample: (): Promise<{ id: string; resume: Resume }> => ipcRenderer.invoke(IPC.Resume.CreateSample),
    /** 2026-08-11 B1：读取照片文件 → dataURL（photo 为路径引用时模板/导出用；data: 内嵌无需此通道） */
    readPhoto: (photoRef: string): Promise<ReadPhotoResult> =>
      ipcRenderer.invoke(IPC.Resume.ReadPhoto, { photoRef }),
    /** M3 F19 岗位绑定 */
    bindJob: (resumeId: string, jobId: string): Promise<Resume> =>
      ipcRenderer.invoke(IPC.Resume.BindJob, { resumeId, jobId }),
    unbindJob: (resumeId: string, jobId: string): Promise<Resume> =>
      ipcRenderer.invoke(IPC.Resume.UnbindJob, { resumeId, jobId })
  },
  backup: {
    exportZip: (): Promise<string | null> => ipcRenderer.invoke(IPC.Backup.Export),
    importZip: (): Promise<number> => ipcRenderer.invoke(IPC.Backup.Import)
  },
  storage: {
    /** F21 简历存储位置（技术栈 §3.11.3 · 2026-08-11 落码；设置屏 UI 随 M5） */
    choose: (): Promise<string | null> => ipcRenderer.invoke(IPC.Storage.Choose),
    get: (): Promise<StorageInfo> => ipcRenderer.invoke(IPC.Storage.Get),
    set: (dir: string): Promise<StorageSetResult> => ipcRenderer.invoke(IPC.Storage.Set, dir),
    reset: (): Promise<string> => ipcRenderer.invoke(IPC.Storage.Reset),
    open: (): Promise<void> => ipcRenderer.invoke(IPC.Storage.Open)
  },
  import: {
    /** M4a：导入简历（主进程开对话框选文件；返回草稿进三步核对向导）；进度经 onProgress */
    run: (args: ImportRunArgs): Promise<AiResult<ImportDraft>> =>
      ipcRenderer.invoke(IPC.Import.Run, args),
    /** R8：批量导入（多选 → 逐份落盘为独立新简历，无需三步核对） */
    runBatch: (): Promise<AiResult<ImportBatchResult>> => ipcRenderer.invoke(IPC.Import.RunBatch),
    onProgress: (cb: (p: ImportProgress) => void): (() => void) => subscribe('import:progress', cb)
  },
  window: {
    /** M5 D4：窗口控制（无边框自绘三按钮）——最小化 / 最大化还原 / 关闭（→托盘） */
    minimize: (): void => ipcRenderer.send(IPC.Window.Minimize),
    maximizeToggle: (): void => ipcRenderer.send(IPC.Window.MaximizeToggle),
    close: (): void => ipcRenderer.send(IPC.Window.Close),
    /** 最大化态广播（主进程 win maximize/unmaximize → 渲染层图标切换） */
    onMaximized: (cb: (maximized: boolean) => void): (() => void) => subscribe('window:maximized', cb),
    /** 关窗→托盘前保存通知（主进程 close 拦截后发送；渲染层立即 saveNow） */
    onBeforeHide: (cb: () => void): (() => void) => subscribe('window:before-hide', cb)
  }
}

export type ElectronAPI = typeof electronAPI

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
