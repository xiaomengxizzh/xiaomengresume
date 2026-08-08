# F7 · AI 润色（辅助定位）— M3

> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）；真相源 = 本文档。
> **✅ 已落码（2026-08-09 M3）**：编辑器内 AiAssistPanel——SectionCard「AI 润色」入口，选区优先（冻结 from/to，range 失效提示重选）/无选中整字段；流式结果 取消/刷新/应用（应用入 F3 撤销栈）；选岗注入 `requirements`（AiContextBar 所选岗位）；AI 屏 AiPolish 为引导页。

### F7 · AI 润色（辅助定位）— M3
- **需求**：选中文本/字段，AI 改写为更专业/简洁的表达，流式返回。**定位为辅助编辑——用户掌控最终内容，不做整篇自动生成。**
- **实现框架**：`ipcRenderer.invoke('ai:polish', { text, field, resumeId, jobId? })` → 主进程 `streamText({ model, instructions: <润色角色提示>, prompt: text })` → chunk 经 `webContents.send('ai:polish:chunk')` 实时写回 → 提供"接受/放弃"对比。`resumeId` 标识「所选简历」（AI 屏顶栏选择器），用于解析其 `boundJobIds` 取所选岗位 `requirements` 注入 instructions。
- **用户视角**：选中一段文字 → 点「AI 润色」→ AI 流式改写**逐字**出现在对比框 → 「接受 / 放弃」二选一。

#### F7 润色落地点（WP-P3 · P 阶段定案）

**定位**：用户选中已有文本或某字段 → AI 改写得"更专业/更简洁/更贴岗"，**流式逐字返回**，**接受 / 放弃二选一**。AI 只改写用户已写出的内容，不凭空生成整篇简历（呼应《项目介绍.md》「人工掌控」承诺与《项目规范.md》五「AI 定位铁律」）。

**1. 润色角色提示词（instructions，可复用模板）**

> 注意：SDK v7 用 `instructions` 选项承载角色设定（`system` 已被拒绝，见《技术栈.md》§3.9 设计决策）。下方模板中 `<占位符>` 由主进程按字段填充。

```text
你是一个严谨的简历文字润色助手，只做"辅助编辑"，绝不替用户生成整篇简历。

# 任务
改写用户提供的【已有文本】，使其表达更专业、简洁、有信息量。你只能对【用户提供的内容】做措辞/语序/重点的优化，不得凭空添加用户未写过的经历、技能或量化成果。

# 硬性约束
- 保留用户原意的全部事实，不编造、不夸大、不虚构数据。
- 不改动专有名词（公司名、技术名、院校名）；中英文混排按用户习惯。
- 输出只给改写后的文本本身，不要解释、不要前缀（如"改写："）、不要 Markdown 代码块。
- 若原文已足够好，直接返回原文，不要强行改写。

# 语境（可选）
- 当前字段：<fieldName>（如 summary / work.bullet / project.bullet）
- 目标岗位：<targetJobName>（若用户填了岗位 JD，可让表达更贴岗；否则通用专业风格）
- 语言：<locale>（zh-CN 或 en）
```

主进程填充 `fieldName` / `targetJobName` / `locale` 后，作为 `streamText({ instructions, prompt: text })` 的 `prompt` 传原文。

**2. 流式实现（主进程 → 渲染进程）**

主进程 handler 直接调 `streamText`（薄封装，不要包"AI 服务层"，见《项目规范.md》4.4 薄封装纪律）：

```ts
// src/main/ai/polish.ts  —— 薄封装，一个 handler 直接调 streamText
import { streamText } from 'ai';
import { getModel } from './sdk-helpers'; // 统一 import，藏 SDK v7 陷阱

export async function handlePolish(
  event: Electron.IpcMainInvokeEvent,
  { text, field, locale, targetJobName }: PolishArgs,
) {
  const model = getModel(); // 从 safeStorage 解出的 BYOK Key
  const instructions = buildPolishInstructions({ field, locale, targetJobName });
  const result = streamText({ model, instructions, prompt: text });

  // v7 用 stream 而非已弃用的 fullStream
  for await (const chunk of result.stream) {
    if (chunk.type === 'text-delta') {
      event.sender.send('ai:polish:chunk', {
        requestId: event.requestId, // 关联 request，支持多字段并发
        delta: chunk.textDelta,      // 增量字符
      });
    }
  }
}
```

要点：
- `instructions` + `prompt` 分置（角色 vs 用户原文），符合 SDK v7。
- 推流用 `event.sender.send('ai:polish:chunk', { requestId, delta })`，由 `webContents` 推到渲染进程（见《技术栈.md》§3.9 流式输出）。
- `requestId` 关联请求，避免多个润色并发时串流。
- 主进程是 AI 唯一承载点，渲染进程不直连供应商（见《项目规范.md》五架构铁律）。

**3. 渲染进程"接受 / 放弃"对比交互**

- 用户在富文本字段或表单字段选中文字 → 点「AI 润色」。
- 弹出对比框：**左栏原文（只读）** / **右栏改写（流式逐字拼接 `delta`）**。
- 流式过程中右栏实时增长；提供「停止」可中断（`result.abort()`）。
- 结束给两个按钮：
  - **接受**：把右栏最终文本写回对应字段（经 Zustand store 提交级更新，触发 F3 撤销入栈）。
  - **放弃**：关闭弹窗，**不改动任何数据**——用户掌控最终内容。
- 文案/交互不得出现"生成简历"类表述，仅"润色 / 改写已有内容"。

**4. IPC 契约要点（冻结于 `src/shared/`）**

```ts
// 调用（渲染 → 主，invoke）
ipcRenderer.invoke('ai:polish', {
  text: string;            // 选中或字段原文
  field: string;           // 来源字段名，用于提示词语境
  locale?: 'zh-CN' | 'en';
  targetJobName?: string;  // 可选，来自 F9 的 targetJobDescription 关联
}): Promise<void>;         // 正文走事件流，invoke 仅作发起

// 推流（主 → 渲染，event）
ipcRenderer.on('ai:polish:chunk', (_e, {
  requestId: string;
  delta: string;
}) => void);

// 中断（渲染 → 主，invoke）
ipcRenderer.invoke('ai:polish:cancel', { requestId: string }): Promise<void>;
```

> 通道名冻结在 `src/shared/ipc-channels.ts`；preload 暴露 `window.electronAPI.ai.polish / onPolishChunk / cancelPolish`（见《技术栈.md》§3.10 类型安全）。改动须集成者批准（契约先行，《项目规范.md》三 §6）。

#### F7 润色 R 批扩展（WP-R3 · R 阶段定案，T 批 WP-T2 多值扩展）

> 对应《项目实现情况.md》§2.1 WP-R3：AI 四分区之一「简历润色」。待拍板 #13/#14 按默认建议落定；#21（T 批）落定多简历多岗位消费方式。

1. **提示词来源**：instructions 由 `SettingsSchema.aiPrompts.polish` 提供（设置屏可编辑，见 F11「AI 提示词设置区」）；缺省回退内置默认（权威定稿见《技术栈.md》§3.11 `DEFAULT_AI_PROMPTS.polish`）。
2. **选岗注入岗位要求（多值）**：`ai:polish` 入参 `resumeId` 解析所选简历 `boundJobIds`；选中 `jobId` 时，主进程经 job-store（WP-R1，见 F19）取该岗位 `JobSchema.requirements` 填充 instructions 的 `<requirements>` 占位符——仅作「风格对齐」参考，提示词显式约束「不得据此编造内容」；未绑岗位时为空、走通用专业风格。**复用 F7 已有「目标岗位」占位符 `<targetJobName>`**，不新增占位符。
3. **作用范围**：选中的分区/字段（`field` 参数标识，如 `summary` / `work.0.bullets`）；接受时经 Zustand store 精确回写对应字段（提交级更新、入撤销栈）。
4. **IPC 增补（多值）**：`ai:polish` 入参增 `resumeId: string`（所选简历 id）与可选 `jobId?: string`（所选岗位 id，来自 AI 屏顶栏「岗位」选择器）；`requirements?` 改为由主进程据 `resumeId`+`jobId` 内部解析，不再由渲染进程传入；`targetJobName` / 推流 / 中断契约不变。未选简历时入口禁用（`ai.noResumeHint`）。

#### F7 润色交互修订（2026-08-07 用户拍板 · 覆盖原弹窗交互，IPC 契约不变）

> **决策**：AI 润色入口移入**简历编辑界面**（非基本信息字段的可用选项），交互从「弹窗对比」改为「编辑器内垂直分半」；**右侧预览保留全程在线**。只做局部润色（禁整篇生成，守 AI 定位铁律）。契约（`ai:polish` / `ai:polish:chunk` / `ai:polish:cancel`）一行不改——交互形态变化零契约成本。

- **入口**：非基本信息字段（见白名单）的富文本控件/表单字段旁提供「AI 润色」按钮；basic 数据型字段（name/phone/email/title 等）**不出现入口**。
- **字段白名单**：`summary.content` / `education[].description` / `work[].summary` + `work[].highlights[]` / `projects[].description` + `projects[].highlights[]` / `skillContent`（若结构化则按条目级）。
- **交互（垂直分半）**：点「AI 润色」→ 编辑器左栏（表单区）**垂直分半**——上半 = 编辑区（滚动位置保持不动），下半 = 润色结果面板；右侧预览**不变、持续在线**。
- **三操作**：**取消**（放弃，不改数据）/ **刷新**（重新生成，覆盖当前结果区，新 requestId，不做多版本历史）/ **应用**（写回字段，经 store 提交级更新，入 F3 撤销栈）。流式逐字 + 「停止」可中断（复用 `ai:polish:cancel`）。
- **Tiptap 选中范围防坑（落码必读）**：点「AI 润色」时**冻结记录 selection 的 from/to**（非动态引用）；应用时 range 仍有效 → 精确替换；已失效（用户改过原文）→ 提示「原文已变化，请重新选中润色」，**不静默覆盖**。
- **会话生命周期**：取消/应用后结果面板收起，左栏恢复整高；会话期间字段切换 = 结束当前会话（未应用结果丢弃，需重新触发）。
- **AI 屏入口保留**（F7 R 批）：AI 屏「润色」入口带 `resumeId`+`jobId` 上下文打开编辑器并进入润色模式（选岗注入岗位要求逻辑不变）。

---
