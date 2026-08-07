/**
 * IPC 通道契约（M0 冻结 · M1 扩展）
 * 铁律：通道名一经冻结，变更需组长批准（《项目规范.md》三 §8 契约先行）。
 * 命名空间：app:* 应用信息 / print:* 打印导出 / ai:* AI 通道 / resume:* 简历生命周期
 *          / resumes:* 简历聚合（最近/列表）/ backup:* 备份导出导入 / storage:* 存储位置（F21）
 *          / jobs:* 岗位目录（F19，契约冻结于 M1，主进程实现随 v1.1）
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
  /** AI 通道（M0 流式 IPC 验证；M3 扩展四分区） */
  Ai: {
    /** 流式测试（无 key 时 mock 回包，验证 IPC 链路） */
    StreamTest: 'ai:stream:test'
  },
  /** 简历生命周期（F11 WP-P5 定案 + M1 落码；路径 = <storageFolderPath>/<id>.json，F21 #18） */
  Resume: {
    /** 保存简历（主进程校验 Zod → 三件套原子写） */
    Save: 'resume:save',
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
