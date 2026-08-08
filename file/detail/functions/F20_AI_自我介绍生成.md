# F20 · AI 自我介绍生成（R 批新增）— M3 / v1.1

> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）；真相源 = 本文档。
> **✅ 已落码（2026-08-09 M3）**：AiIntro 视图——生成/翻译（mode: generate|translate）流式 + 接受/放弃；接受写 `summary.content` / `summary.enContent`（入撤销栈 + 立即保存）；编辑器 summary 区中/英切换可编辑；翻译铁律附加于 `aiPrompts.intro`（禁编造、忠实翻译）；模板/导出英文消费推后（见实现情况偏差 ⑮）。

### F20 · AI 自我介绍生成（R 批新增）— M3 / v1.1
- **需求**：基于当前简历全文，AI 提炼 / 归纳一段「自我评价（summary）」单字段草稿，流式返回，用户**接受 / 放弃**二选一。
- **铁律（自检必查）**：提示词**禁编造简历外事实**——只能使用简历中已出现的信息（姓名 / 经历 / 技能 / 项目 / 教育等），不虚构、不夸大、不补脑；守「AI 定位铁律」（只做辅助编辑，不算"一键生成简历"）。
- **实现框架**：输入 = 简历全文文本化（`buildResumeText(resume)`，与 F9 `buildMatchPrompt` 共用同一文本化函数；**不注入 `targetJobDescription` 或岗位要求**，防诱导编造贴岗事实）；输出 = `summary.content` 单字段草稿（接受时由纯文本转 RichText 单段落文档，与 `RichTextSchema` 兼容）；IPC `ai:intro`（invoke 发起）+ `ai:intro:chunk`（流式 `{requestId, delta}`）+ `ai:intro:cancel`（中断）；instructions 来自 `aiPrompts.intro`（设置屏可编辑，见 F11）。
- **交互**：AI 辅助屏「自我介绍」→ 流式逐字 → 对比框（右栏草稿实时增长，可「停止」）→ 「接受」（写回 `summary.content`，经 Zustand 提交级更新、触发 F3 撤销入栈）/「放弃」（不改动任何数据）。文案禁「生成简历」，仅「提炼 / 归纳自我评价」。

#### F20 IPC 契约要点（冻结于 `src/shared/`）

```ts
ipcRenderer.invoke('ai:intro', { resume: ResumeSchemaInput; locale?: 'zh-CN' | 'en' }): Promise<void>;
ipcRenderer.on('ai:intro:chunk', (_e, { requestId: string; delta: string }) => void);
ipcRenderer.invoke('ai:intro:cancel', { requestId: string }): Promise<void>;
```

通道名 `'ai:intro'` 冻结于 `src/shared/ipc-channels.ts`；preload 暴露 `window.electronAPI.ai.intro / onIntroChunk / cancelIntro`。

> **F20 自我介绍 · 同享选择器决策（T 批 #21 默认建议，WP-T2 落定）**：自我介绍（F20）**同享 AI 屏顶栏「当前简历」选择器**——四分区（语法纠正 / 自我介绍 / 简历润色 / 匹配打分）统一切换数据源，避免各自维护选中状态。F20 `ai:intro` 入参增 `resumeId`（与 F7/F9 同构），输入 = 所选简历全文文本化（`buildResumeText`），**不注入岗位 `requirements`**（守「禁编造简历外事实」铁律，与 R 批一致）。未选简历时入口禁用并提示（`ai.noResumeHint`）。

#### F20 翻译模式（WP-T6 · T 阶段定案，对应待拍板 #25）

- **需求**：基于当前 `summary.content`（自我评价正文）的纯文本，AI 将其**翻译**为英文版自我评价草稿，流式返回，用户**接受 / 放弃**二选一，接受时写入 `summary.enContent`。
- **铁律（自检必查）**：提示词**禁编造简历外事实**——只翻译简历已有内容（`summary.content` 及其对应事实），不虚构、不夸大、不补脑任何简历未涵盖的经历 / 技能 / 量化成果；术语准确；输出纯文本。守「AI 定位铁律」（只做辅助编辑，不算"一键生成简历"）。
- **实现框架（复用通道族，不新开）**：在既有 `ai:intro` 通道族上**增 `mode: 'translate'`**（与既有 `'generate'` 同族复用 `ai:intro` / `ai:intro:chunk` / `ai:intro:cancel`）。输入 = 当前 `summary.content` 纯文本（**可选注入 `basics` 上下文**如姓名 / 职位标语，仅作语境、不供编造）；输出 = 英文版 summary 草稿（接受时由纯文本转 RichText 单段落文档，与 `RichTextSchema` 兼容）；`instructions` 来自 `aiPrompts.intro`（设置屏可编辑，见 F11），复用 F20 已有提示词设置区。
- **UI（AI 辅助屏「自我介绍」分区）**：
  - 「自我介绍」分区在既有「AI 生成」入口下方增 **「AI 翻译」按钮**（`t('ai.intro.translate.button')`，生成草稿后可用）。
  - 点击 → 流式逐字 → 弹出**对比框**：**左栏原文（`summary.content`，只读）/ 右栏英文稿（流式逐字拼接 `delta`）**。
  - 流式过程中提供「停止」（`t('ai.intro.translate.stop')`，调用 `ai:intro:cancel`）可中断。
  - 结束给两个按钮：
    - **接受**（`t('ai.intro.translate.accept')`）：把右栏英文文本经纯文本 → RichText 单段落转换后写回 `summary.enContent`，经 Zustand 提交级更新、触发 F3 撤销入栈。
    - **放弃**（`t('ai.intro.translate.discard')`）：关闭弹窗，**不改动任何数据**——用户掌控最终内容。
  - 文案禁「生成简历」，仅「翻译 / 译写已有自我评价」；`summary.content` 为空时「AI 翻译」按钮禁用并提示「请先填写自我评价正文」（`t('ai.intro.translate.emptyHint')`）。

##### F20 翻译模式 IPC 契约增补（冻结于 `src/shared/`）

> 在 F20 既有 `ai:intro` IPC 契约上增补 `mode` 入参；推流（`ai:intro:chunk`）/ 中断（`ai:intro:cancel`）契约不变，复用既有的 `{requestId, delta}` 结构。

```ts
// 调用（渲染 → 主，invoke）—— 在 F20 既有 ai:intro 上扩 mode
ipcRenderer.invoke('ai:intro', {
  resume: ResumeSchemaInput;          // 当前简历（同 F20 generate 模式）
  mode: 'generate' | 'translate';     // 【新增】'translate' = 翻译模式（WP-T6）
  locale?: 'zh-CN' | 'en';
  basicsContext?: string;             // 【新增】可选注入 basics 上下文（译写语境，禁用其编造）
}): Promise<void>;
// 推流（主 → 渲染，event）：复用 ai:intro:chunk { requestId, delta }
// 中断（渲染 → 主，invoke）：复用 ai:intro:cancel { requestId }
```

通道名 `'ai:intro'` 冻结于 `src/shared/ipc-channels.ts`；preload 暴露 `window.electronAPI.ai.intro / onIntroChunk / cancelIntro`（不变）。

##### #25 拍板默认（WP-T6 按默认建议落定）

1. **v1 仅产出可编辑文本**：接受后写入 `summary.enContent`（英文版自我评价草稿）；**v1 不联动模板**——英文版简历显示英文 summary 列为 **v1.x 增强**（模板消费 `summary.enContent` 延后）。数据层先就位，模板联动留 v1.x。
2. **翻译方向 v1 单向 zh→en**：仅支持中文 `summary.content` → 英文 `summary.enContent`；用户需求仅英文版，v1 不做 en→zh 反向。
