/**
 * IPC 通道契约（M0 冻结 · M1 扩展 · M2 F5 扩展 export:*）
 * 铁律：通道名一经冻结，变更需组长批准（《项目规范.md》三 §8 契约先行）。
 * 命名空间：app:* 应用信息 / print:* 打印导出 / export:* 导出（M2 F5）/ ai:* AI 通道
 *          / resume:* 简历生命周期 / resumes:* 简历聚合（最近/列表）
 *          / backup:* 备份导出导入 / storage:* 存储位置（F21）/ jobs:* 岗位目录（F19）
 */

export const IPC = {
  /** 应用信息（M0 验证 IPC 通信） */
  App: {
    GetInfo: 'app:get-info',
    Ping: 'app:ping'
  },
  /** 打印 / PDF 导出 */
  Print: {
    /** 渲染 HTML → 打印 PDF（M0 端到端验证） */
    Pdf: 'print:pdf'
  },
  /** 导出（M2 F5，取代原规划 pdf:export；v1.0 落地 textPdf + json，图片类 v1.1） */
  Export: {
    /** 导出简历（format 分流；进度经 'export:progress' 事件回传） */
    Run: 'export:run'
  },
  /** AI 通道（M0 流式验证；M3 扩展四分区 + 服务商配置。流式增量事件：'ai:intro:chunk' / 'ai:polish:chunk'） */
  Ai: {
    /** 流式链路验证（无 key 时 mock 回包；M3 起 XM_AI_MOCK 专用） */
    StreamTest: 'ai:stream:test',
    /** 语法纠正（非流式，generateObject → GrammarIssue[]） */
    Grammar: 'ai:grammar',
    /** 自我介绍生成/翻译（流式，mode: generate|translate） */
    Intro: 'ai:intro',
    /** 中断自我介绍流（按 requestId） */
    IntroCancel: 'ai:intro:cancel',
    /** 简历润色（流式） */
    Polish: 'ai:polish',
    /** 中断润色流（按 requestId） */
    PolishCancel: 'ai:polish:cancel',
    /** 岗位匹配打分（非流式，generateObject → MatchScore） */
    Match: 'ai:match',
    /** 读 AI 服务商配置（脱敏形态，apiKey 前4后4） */
    ConfigGet: 'ai:config:get',
    /** 保存 AI 服务商配置（apiKey 入 safeStorage，其余入 electron-store） */
    ConfigSave: 'ai:config:save'
  },
  /** 简历生命周期（F11 WP-P5 定案 + M1 落码；路径 = <storageFolderPath>/<id>.json，F21 #18） */
  Resume: {
    /** 保存简历（主进程校验 Zod → 三件套原子写） */
    Save: 'resume:save',
    /** 关窗前静默保存（单向 send，不依赖回执——P2：beforeunload 中 invoke 回执
     *  无法保证送达，send 消息入队即达，比 invoke 可靠） */
    SaveNow: 'resume:save-now',
    /** 打开简历（读文件 + 刷新 meta.lastOpenedAt 轻量写） */
    Open: 'resume:open',
    /** 复制简历（深拷贝赋新 uuid → 写 <newId>.json） */
    Duplicate: 'resume:duplicate',
    /** 重命名简历（仅改 basics.name，文件不变） */
    Rename: 'resume:rename',
    /** 删除简历（unlink + 同步删 .bak 序列） */
    Delete: 'resume:delete',
    /** 简历摘要列表（F19 反查 boundJobIds 用） */
    List: 'resume:list',
    /** 崩溃恢复：扫描残留 .tmp（三件套 a，启动时渲染进程调用） */
    ScanRecovery: 'resume:scan-recovery',
    /** 崩溃恢复：用 .tmp 覆盖正式文件 */
    Recover: 'resume:recover',
    /** 内置示例简历：生成新 uuid 写入存储目录，返回 {id, resume}（M1 补口 2026-08-07） */
    CreateSample: 'resume:create-sample',
    /** 绑定岗位（F19，v1.1 实现） */
    BindJob: 'resume:bind-job',
    /** 解绑岗位（F19，v1.1 实现） */
    UnbindJob: 'resume:unbind-job'
  },
  /** 简历聚合（F11 WP-T1 定案） */
  Resumes: {
    /** 最近简历列表（按 lastActivityAt 倒序） */
    Recent: 'resumes:recent'
  },
  /** 备份导出 / 导入（F11 WP-P5 三件套 c，F19 扩展含 jobs/） */
  Backup: {
    Export: 'backup:export',
    Import: 'backup:import'
  },
  /** 岗位目录（F19 数据层 M1 顺带冻结，主进程随 v1.1） */
  Jobs: {
    List: 'jobs:list',
    Get: 'jobs:get',
    Save: 'jobs:save',
    Delete: 'jobs:delete'
  }
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC][keyof (typeof IPC)[keyof typeof IPC]]

/** 应用信息（app:get-info 返回值，主进程填充） */
export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
}

/** 最近简历条目（resumes:recent 返回值，F11 WP-T1） */
export interface RecentResume {
  id: string
  name: string
  lastActivityAt: string
  lastEditedAt?: string
  lastOpenedAt?: string
}

/** 简历摘要（resume:list 返回值，F19 反查用） */
export interface ResumeSummary {
  id: string
  name: string
  updatedAt?: string
  boundJobIds: string[]
}

/** 岗位摘要（jobs:list 返回值，F19 v1.1） */
export interface JobSummary {
  id: string
  name: string
  appliedAt?: string
}

// ── M2 F5 导出契约（F5 落地点，冻结）───────────────────────────────────────

/** 导出格式：v1.0 落地 textPdf + json；imagePdf / image 随 v1.1（pdf-lib） */
export type ExportFormat = 'textPdf' | 'imagePdf' | 'image' | 'json'

export interface ExportRunArgs {
  format: ExportFormat
  /** 目标目录：显式 folderPath > SettingsSchema.export.lastFolder > storage.folderPath > 下载目录 */
  folderPath?: string
  /** 仅 image/imagePdf 相关；默认 'png'（v1.1） */
  imageFormat?: 'png' | 'jpg'
  /** 仅 jpg：0–1，默认 0.92（v1.1） */
  quality?: number
  /** 多页语义（D5）：'all' 全部（默认）/ 'first' 仅第一页（v2.0 起 pdf-lib 裁剪） */
  pages?: 'all' | 'first'
  /** 目标简历 id（主进程 openResume 读取；json/textPdf 必填） */
  resumeId?: string
  /** F16 隐私打码：true 时 PDF 敏感字段置 ████（与预览 data-redact 对齐；2026-08-08 v2.0） */
  privacyMode?: boolean
}

export interface ExportRunResult {
  canceled: boolean
  /** image 多页时为数组 */
  filePath?: string | string[]
  error?: string
}

/** 导出进度事件（webContents.send('export:progress')） */
export interface ExportProgress {
  phase: 'measure' | 'render' | 'print' | 'write'
  ratio: number
}

// ── M3 AI 契约（四分区 + 服务商配置，2026-08-09 冻结）────────────────────────

/** AI 失败码（前端按 code 查 i18n；结构化错误 = 常态路径，不抛错） */
export type AiErrorCode =
  | 'PROVIDER_DISABLED' // 目标服务商 enabled=false
  | 'NO_PROVIDER' // 无任何 enabled 服务商
  | 'CONFIG_INVALID' // 配置缺失/非法（custom 缺 modelId、baseURL 非法等）
  | 'TIMEOUT' // AI 调用超时
  | 'NETWORK' // 网络/端点错误
  | 'RATE_LIMIT' // 限流
  | 'INVALID_RESPONSE' // 模型返回无法解析
  | 'CANCELLED' // 用户中断
  | 'UNKNOWN'

export interface AiError {
  code: AiErrorCode
  message?: string
}

/** 四分区 + 配置通道统一返回（流式通道另经 chunk 事件推送增量） */
export type AiResult<T> = { ok: true; data: T } | { ok: false; error: AiError }

/** 流式增量事件负载（webContents.send('ai:intro:chunk' | 'ai:polish:chunk')） */
export interface AiStreamChunk {
  requestId: string
  delta: string
}

/** ai:grammar 入参（F08：scope=selection 时 text 必填；scope=full 主进程按 resumeId 逐字段） */
export interface AiGrammarArgs {
  resumeId: string
  scope: 'selection' | 'full'
  text?: string
  locale?: string
}

/** ai:intro 入参（F20：mode=translate 翻译 summary.content → enContent；禁注入岗位 requirements） */
export interface AiIntroArgs {
  /** 客户端生成（uuid），用于 chunk 匹配与 cancel */
  requestId: string
  resumeId: string
  mode: 'generate' | 'translate'
  locale?: string
}

/** ai:polish 入参（F07：text 为渲染层当前文本；range 失效由渲染层拦截；jobId 可空） */
export interface AiPolishArgs {
  /** 客户端生成（uuid），用于 chunk 匹配与 cancel */
  requestId: string
  resumeId: string
  /** 字段路径（方括号规范：summary.content / work[0].summary / …） */
  field: string
  text: string
  jobId?: string
  locale?: string
}

/** ai:match 入参（F09：jd 由主进程按 resumeId.boundJobIds → jobId.requirements 内部解析） */
export interface AiMatchArgs {
  resumeId: string
  jobId: string
  locale?: string
}

/** 单个服务商配置视图（脱敏：apiKey 仅前 4 后 4 + ••••） */
export interface ProviderConfigView {
  /** 'deepseek' | 'volcengine' | 'openai' | 'google' | 'custom:<uuid>' */
  providerId: string
  kind: 'builtin' | 'custom'
  /** 显示名（custom 用用户填写名） */
  name: string
  apiKeyMasked: string | null
  hasApiKey: boolean
  modelId: string | null
  enabled: boolean
  /** 仅 custom */
  baseURL?: string
}

/** ai:config:get 返回（全量脱敏视图 + 全局参数 + 提示词原文） */
export interface AiConfigView {
  providers: ProviderConfigView[]
  temperature: number
  maxTokens: number
  /** aiPrompts 当前值；null = 未自定义（回退内置默认） */
  prompts: AiPrompts | null
}

// 类型引用（避免循环依赖：settings 不依赖 ipc-channels）
type AiPrompts = {
  grammar: string
  intro: string
  polish: string
  match: string
}
