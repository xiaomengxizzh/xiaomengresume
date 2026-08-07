# IPC 通道契约（自动生成）

> 本文件由 `scripts/gen_api_docs.mjs` 自动生成，**禁止手写**。事实源 = `src/shared/ipc-channels.ts`（契约冻结区，变更需组长批准，见《项目规范.md》§三.8）。

IPC 通道契约（M0 冻结 · M1 扩展）
铁律：通道名一经冻结，变更需组长批准（《项目规范.md》三 §8 契约先行）。
命名空间：app:* 应用信息 / print:* 打印导出 / ai:* AI 通道 / resume:* 简历生命周期
         / resumes:* 简历聚合（最近/列表）/ backup:* 备份导出导入 / storage:* 存储位置（F21）
         / jobs:* 岗位目录（F19，契约冻结于 M1，主进程实现随 v1.1）

## 通道总览

| 命名空间 | 通道 | 说明 |
|---|---|---|
| App | `app:get-info` | — |
| App | `app:ping` | — |
| Print | `print:pdf` | 渲染 HTML → 打印 PDF（M0 端到端验证） |
| Ai | `ai:stream:test` | 流式测试（无 key 时 mock 回包，验证 IPC 链路） |
| Resume | `resume:save` | 保存简历（主进程校验 Zod → 三件套原子写） |
| Resume | `resume:open` | 打开简历（读文件 + 刷新 meta.lastOpenedAt 轻量写） |
| Resume | `resume:duplicate` | 复制简历（深拷贝赋新 uuid → 写 <newId>.json） |
| Resume | `resume:rename` | 重命名简历（仅改 basics.name，文件不变） |
| Resume | `resume:delete` | 删除简历（unlink + 同步删 .bak 序列） |
| Resume | `resume:list` | 简历摘要列表（F19 反查 boundJobIds 用） |
| Resume | `resume:scan-recovery` | 崩溃恢复：扫描残留 .tmp（三件套 a，启动时渲染进程调用） |
| Resume | `resume:recover` | 崩溃恢复：用 .tmp 覆盖正式文件 |
| Resume | `resume:create-sample` | 内置示例简历：生成新 uuid 写入存储目录，返回 {id, resume}（M1 补口 2026-08-07） |
| Resume | `resume:bind-job` | 绑定岗位（F19，v1.1 实现） |
| Resume | `resume:unbind-job` | 解绑岗位（F19，v1.1 实现） |
| Resumes | `resumes:recent` | 最近简历列表（按 lastActivityAt 倒序） |
| Backup | `backup:export` | — |
| Backup | `backup:import` | — |
| Jobs | `jobs:list` | — |
| Jobs | `jobs:get` | — |
| Jobs | `jobs:save` | — |
| Jobs | `jobs:delete` | — |

## 分命名空间明细

### App

应用信息（M0 验证 IPC 通信）

- `GetInfo` → `app:get-info`
- `Ping` → `app:ping`

### Print

打印 / PDF 导出

- `Pdf` → `print:pdf`：渲染 HTML → 打印 PDF（M0 端到端验证）

### Ai

AI 通道（M0 流式 IPC 验证；M3 扩展四分区）

- `StreamTest` → `ai:stream:test`：流式测试（无 key 时 mock 回包，验证 IPC 链路）

### Resume

简历生命周期（F11 WP-P5 定案 + M1 落码；路径 = <storageFolderPath>/<id>.json，F21 #18）

- `Save` → `resume:save`：保存简历（主进程校验 Zod → 三件套原子写）
- `Open` → `resume:open`：打开简历（读文件 + 刷新 meta.lastOpenedAt 轻量写）
- `Duplicate` → `resume:duplicate`：复制简历（深拷贝赋新 uuid → 写 <newId>.json）
- `Rename` → `resume:rename`：重命名简历（仅改 basics.name，文件不变）
- `Delete` → `resume:delete`：删除简历（unlink + 同步删 .bak 序列）
- `List` → `resume:list`：简历摘要列表（F19 反查 boundJobIds 用）
- `ScanRecovery` → `resume:scan-recovery`：崩溃恢复：扫描残留 .tmp（三件套 a，启动时渲染进程调用）
- `Recover` → `resume:recover`：崩溃恢复：用 .tmp 覆盖正式文件
- `CreateSample` → `resume:create-sample`：内置示例简历：生成新 uuid 写入存储目录，返回 {id, resume}（M1 补口 2026-08-07）
- `BindJob` → `resume:bind-job`：绑定岗位（F19，v1.1 实现）
- `UnbindJob` → `resume:unbind-job`：解绑岗位（F19，v1.1 实现）

### Resumes

简历聚合（F11 WP-T1 定案）

- `Recent` → `resumes:recent`：最近简历列表（按 lastActivityAt 倒序）

### Backup

备份导出 / 导入（F11 WP-P5 三件套 c，F19 扩展含 jobs/）

- `Export` → `backup:export`
- `Import` → `backup:import`

### Jobs

岗位目录（F19 数据层 M1 顺带冻结，主进程随 v1.1）

- `List` → `jobs:list`
- `Get` → `jobs:get`
- `Save` → `jobs:save`
- `Delete` → `jobs:delete`

## 返回类型

### `AppInfo`

```ts
name: string
version: string
electron: string
chrome: string
node: string
```

### `RecentResume`

```ts
id: string
name: string
lastActivityAt: string
lastEditedAt?: string
lastOpenedAt?: string
```

### `ResumeSummary`

```ts
id: string
name: string
updatedAt?: string
boundJobIds: string[]
```

### `JobSummary`

```ts
id: string
name: string
appliedAt?: string
```

