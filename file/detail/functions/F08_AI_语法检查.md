# F8 · AI 语法检查 — M3

> 本文件由 `scripts/split_docs.py` 从《项目功能.md》拆分（2026-08-08 路由化定案）；真相源 = 本文档。

### F8 · AI 语法检查 — M3
- **需求**：检查语法/拼写/表达问题，原位标记并给建议。
- **实现框架**：`ipcRenderer.invoke('ai:grammar', { text })` → 返回 `{ from, to, message, suggestion }[]`；渲染进程用 **class 作用域**标记（`.grammar-error`），清理带 `className`（纪律见《项目规范.md》4.2）；点击标记展示建议，一键替换。
- **用户视角**：点「语法检查」→ 问题处**原位**标波浪线（专属 class 不误清其他高亮）→ 点标记弹建议 → 一键替换。

#### F8 语法检查落地点（WP-P3 · P 阶段定案）

**定位**：检查语法/拼写/表达问题，**原位标记**并给建议，可一键替换。只检查不改写，用户决定是否替换（辅助编辑，非生成）。

**1. 返回结构（AI 结构化输出）**

主进程 `generateObject({ schema: GrammarIssueSchema })` 返回数组，每项定义：

```ts
// src/shared/schema/grammar.ts
import { z } from 'zod/v4'; // AI SDK v7 peer 要求 zod/v4（见《技术栈.md》§3.6）

export const GrammarIssueSchema = z.object({
  from: z.number().int().nonnegative(),          // 问题起点字符偏移（相对被检查文本）
  to: z.number().int().nonnegative(),            // 问题终点字符偏移（exclusive）
  message: z.string(),                           // 人类可读的问题说明（如"搭配不当"）
  suggestion: z.string(),                        // 建议替换文本（为空字符串表示仅提示无替换）
});

export const GrammarResultSchema = z.array(GrammarIssueSchema);
export type GrammarIssue = z.infer<typeof GrammarIssueSchema>;
```

偏移语义：`from`/`to` 为相对「被检查文本」的字符偏移（0-based，`to` 不含），渲染进程据此在 Tiptap 文档内定位选区；多字段检查时逐字段独立调用，偏移各自归零。

**2. 渲染进程标记（class 作用域铁律）**

- 高亮 class 名集中定义于 `src/shared/constants.ts`：`HIGHLIGHT.GRAMMAR_ERROR = 'grammar-error'`（见《项目规范.md》4.2 高亮 class 作用域铁律）。
- Tiptap 用 `Decoration` + `Mark` 标波浪线，**必须带 `className: 'grammar-error'`**，与 F9 匹配度高亮（如 `match-found`）**同域隔离、互不误清**。
- **清理纪律（铁律）**：重新检查或用户关闭语法面板时，只允许：
  ```ts
  // 正确：带 className 精确清除语法高亮
  editor.commands.unmark({ className: 'grammar-error' });
  // ❌ 禁止：无参 unmark() —— 会误清匹配度高亮等其他功能标记
  ```
- 在 `src/shared/constants.ts` 登记所有高亮 class 白名单，CI/lint 可加规则禁止无参 `unmark()`。

**3. 点击标记 → 弹建议 → 一键替换**

- 点击波浪线标记 → 弹出小卡片：显示 `message` + 建议 `suggestion`。
- 两个动作：
  - **替换**：`editor.chain().insertContentAt({ from, to }, suggestion).run()`（用偏移换算为文档坐标），覆盖选中范围；替换后该标记自动消失。
  - **忽略**：关闭卡片，保留原文不改动。
- 全部替换/忽略由用户逐一决定，**无"全部自动修复"批量改写**（防盲信、保人工掌控）。

**4. IPC 契约要点**

```ts
// 调用（渲染 → 主，invoke）
ipcRenderer.invoke('ai:grammar', {
  text: string;            // 被检查字段/选区纯文本
  locale?: 'zh-CN' | 'en';
}): Promise<GrammarIssue[]>; // 直接返回 GrammarResultSchema 解析结果

// 渲染进程侧不直连 AI；主进程 generateObject（见《技术栈.md》§3.9 结构化输出）
```

> 通道名 `'ai:grammar'` 冻结于 `src/shared/ipc-channels.ts`；preload 暴露 `window.electronAPI.ai.grammar`。

#### F8 语法纠正 R 批扩展（WP-R3 · R 阶段定案）

> 对应《项目实现情况.md》§2.1 WP-R3：AI 四分区之一「语法纠正」（F8 扩展）。

1. **提示词来源**：instructions 由 `SettingsSchema.aiPrompts.grammar` 提供（设置屏可编辑），缺省回退内置默认（见《技术栈.md》§3.11）。
2. **检查范围**：`scope: 'selection' | 'full'`——① 选中文本（有选区时仅检查该选区）；② 当前简历全文（无选区时对全部文本字段逐项检查，偏移各自归零，渲染进程按字段归位标记）。
3. **原位标记 + 一键替换**：复用 `HIGHLIGHT.GRAMMAR_ERROR` class 作用域标记与「点击弹建议 → 替换/忽略」交互；高亮作用域铁律不变（清理必须带 `className: 'grammar-error'`，禁止无参 `unmark()`）。
4. **IPC 增补**：`ai:grammar` 入参增 `scope: 'selection' | 'full'`，返回 `GrammarIssue[]` 结构不变。

---
