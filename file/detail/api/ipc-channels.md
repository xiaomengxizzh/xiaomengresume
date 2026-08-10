# IPC 通道契约（自动生成）

> 本文件由 `scripts/gen_api_docs.mjs` 自动生成，**禁止手写**。事实源 = `src/shared/ipc-channels.ts`（契约冻结区，变更需组长批准，见《项目规范.md》§三.8）。

IPC 通道契约（M0 冻结 · M1 扩展 · M2 F5 扩展 export:*）
铁律：通道名一经冻结，变更需组长批准（《项目规范.md》三 §8 契约先行）。
命名空间：app:* 应用信息 / print:* 打印导出 / export:* 导出（M2 F5）/ ai:* AI 通道
         / resume:* 简历生命周期 / resumes:* 简历聚合（最近/列表）
         / backup:* 备份导出导入 / storage:* 存储位置（F21）/ jobs:* 岗位目录（F19）
         / import:* 导入（M4a：PDF/Word/JSON，M4b 扩展图片）

## 通道总览

| 命名空间 | 通道 | 说明 |
|---|---|---|
| App | `app:get-info` | — |
| App | `app:ping` | — |
| Print | `print:pdf` | 渲染 HTML → 打印 PDF（M0 端到端验证） |
| Export | `export:run` | 导出简历（format 分流；进度经 'export:progress' 事件回传） |
| Ai | `ai:stream:test` | 流式链路验证（无 key 时 mock 回包；M3 起 XM_AI_MOCK 专用） |
| Ai | `ai:grammar` | 语法纠正（非流式，generateObject → GrammarIssue[]） |
| Ai | `ai:intro` | 自我介绍生成/翻译（流式，mode: generate\|translate） |
| Ai | `ai:intro:cancel` | 中断自我介绍流（按 requestId） |
| Ai | `ai:polish` | 简历润色（流式） |
| Ai | `ai:polish:cancel` | 中断润色流（按 requestId） |
| Ai | `ai:match` | 岗位匹配打分（非流式，generateObject → MatchScore） |
| Ai | `ai:config:get` | 读 AI 服务商配置（脱敏形态，apiKey 前4后4） |
| Ai | `ai:config:save` | 保存 AI 服务商配置（apiKey 入 safeStorage，其余入 electron-store） |
| Ai | `ai:config:test` | 2026-08-09 T3：检测模型（临时 apiKey+modelId 发最小请求验证） |
| Ai | `ai:config:reset` | 2026-08-09：重置全部 AI 配置为系统预设默认值（服务商覆盖/Key/自定义/参数/提示词） |
| Resume | `resume:save` | 保存简历（主进程校验 Zod → 三件套原子写） |
| Resume | `resume:save-now` | 关窗前静默保存（单向 send，不依赖回执——P2：beforeunload 中 invoke 回执 |
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
| Import | `import:run` | 导入简历：主进程开文件对话框 → 解析+映射 → 返回草稿（渲染层不传路径，防路径穿越） |
| Import | `import:runBatch` | 2026-08-09 R8：批量导入（多选 → 逐份解析 → 直接落盘为独立新简历，无需三步核对） |

## 分命名空间明细

### App

应用信息（M0 验证 IPC 通信）

- `GetInfo` → `app:get-info`
- `Ping` → `app:ping`

### Print

打印 / PDF 导出

- `Pdf` → `print:pdf`：渲染 HTML → 打印 PDF（M0 端到端验证）

### Export

导出（M2 F5，取代原规划 pdf:export；v1.0 落地 textPdf + json，图片类 v1.1）

- `Run` → `export:run`：导出简历（format 分流；进度经 'export:progress' 事件回传）

### Ai

AI 通道（M0 流式验证；M3 扩展四分区 + 服务商配置。流式增量事件：'ai:intro:chunk' / 'ai:polish:chunk'）

- `StreamTest` → `ai:stream:test`：流式链路验证（无 key 时 mock 回包；M3 起 XM_AI_MOCK 专用）
- `Grammar` → `ai:grammar`：语法纠正（非流式，generateObject → GrammarIssue[]）
- `Intro` → `ai:intro`：自我介绍生成/翻译（流式，mode: generate|translate）
- `IntroCancel` → `ai:intro:cancel`：中断自我介绍流（按 requestId）
- `Polish` → `ai:polish`：简历润色（流式）
- `PolishCancel` → `ai:polish:cancel`：中断润色流（按 requestId）
- `Match` → `ai:match`：岗位匹配打分（非流式，generateObject → MatchScore）
- `ConfigGet` → `ai:config:get`：读 AI 服务商配置（脱敏形态，apiKey 前4后4）
- `ConfigSave` → `ai:config:save`：保存 AI 服务商配置（apiKey 入 safeStorage，其余入 electron-store）
- `ConfigTest` → `ai:config:test`：2026-08-09 T3：检测模型（临时 apiKey+modelId 发最小请求验证）
- `ConfigReset` → `ai:config:reset`：2026-08-09：重置全部 AI 配置为系统预设默认值（服务商覆盖/Key/自定义/参数/提示词）

### Resume

简历生命周期（F11 WP-P5 定案 + M1 落码；路径 = <storageFolderPath>/<id>.json，F21 #18）

- `Save` → `resume:save`：保存简历（主进程校验 Zod → 三件套原子写）
- `SaveNow` → `resume:save-now`：关窗前静默保存（单向 send，不依赖回执——P2：beforeunload 中 invoke 回执
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

### Import

导入（M4a 文本批冻结；M4b 扩展图片能力）

- `Run` → `import:run`：导入简历：主进程开文件对话框 → 解析+映射 → 返回草稿（渲染层不传路径，防路径穿越）
- `RunBatch` → `import:runBatch`：2026-08-09 R8：批量导入（多选 → 逐份解析 → 直接落盘为独立新简历，无需三步核对）

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
/** 2026-08-09 T8：岗位状态（在投/已过/已拒） */
status?: string
```

### `ExportRunArgs`

```ts
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
```

### `ExportRunResult`

```ts
canceled: boolean
/** image 多页时为数组 */
filePath?: string | string[]
error?: string
```

### `ExportProgress`

```ts
phase: 'measure' | 'render' | 'print' | 'write'
ratio: number
```

### `AiError`

```ts
code: AiErrorCode
message?: string
```

### `AiStreamChunk`

```ts
requestId: string
delta: string
```

### `AiGrammarArgs`

```ts
resumeId: string
scope: 'selection' | 'full'
text?: string
locale?: string
```

### `AiIntroArgs`

```ts
/** 客户端生成（uuid），用于 chunk 匹配与 cancel */
requestId: string
resumeId: string
mode: 'generate' | 'translate'
locale?: string
```

### `AiPolishArgs`

```ts
/** 客户端生成（uuid），用于 chunk 匹配与 cancel */
requestId: string
resumeId: string
/** 字段路径（方括号规范：summary.content / work[0].summary / …） */
field: string
text: string
jobId?: string
locale?: string
```

### `AiMatchArgs`

```ts
resumeId: string
jobId: string
locale?: string
```

### `ProviderConfigView`

```ts
/** 'deepseek' | 'volcengine' | 'openai' | 'google' | 'custom:<uuid>' */
providerId: string
kind: 'builtin' | 'custom'
/** 显示名（custom 用用户填写名） */
name: string
apiKeyMasked: string | null
hasApiKey: boolean
modelId: string | null
enabled: boolean
/** 2026-08-09 T3：内置与 custom 均有接口地址（builtin 默认端点） */
baseURL?: string
/** 2026-08-09 R3：默认显示名（重置按钮回退值；内置 = BUILTIN_INFO.name，custom = 添加时名） */
defaultName?: string
/** 2026-08-09 R3：默认接口地址（重置按钮回退值；内置 = BUILTIN_INFO.baseURL） */
defaultBaseURL?: string
```

### `AiConfigTestArgs`

```ts
providerId: string
apiKey: string
modelId: string
/** 2026-08-09 R3：custom/volcengine 兼容通道 baseURL（检测用输入值） */
baseURL?: string
```

### `AiConfigView`

```ts
providers: ProviderConfigView[]
temperature: number
maxTokens: number
/** aiPrompts 当前值；null = 未自定义（回退内置默认） */
prompts: AiPrompts | null
```

### `ImportRunArgs`

```ts
format: ImportFormat
/** 目标简历（覆盖模式）；省略 = 新建模式 */
resumeId?: string
```

### `ImportRunBatchArgs`

```ts
/** 2026-08-09 R8：预留——批量导入不需要格式参数（多选混合格式） */
format?: ImportFormat
```

### `ImportBatchResult`

```ts
imported: number
failed: Array<{ fileName: string; code: string; message?: string }>
```

### `ImportDraft`

```ts
format: ImportFormat
fileName: string
/** 提取文本预览（≤2000 字符，向导①解析预览用） */
sourcePreview: string
/** 已映射草稿（AI 映射后转正式结构；image 占位时为空简历） */
resume: Resume
/** 如：字段缺失、疑似乱码已剔除、B 档提示 */
warnings: string[]
/** 扫描件/图片（M4b 占位）：非错误，前端据此提示需视觉识别 */
needsVision?: true
```

### `ImportProgress`

```ts
phase: 'parse' | 'map' | 'done'
ratio: number
```

