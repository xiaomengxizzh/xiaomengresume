# M4a 导入执行计划（文本导入批）v1.0

> 依据：《技术栈.md》§三 导入技术方案（F6/F10/Word/JSON 定案）+ 2026-08-09 M4 方案评估（修正前提：unpdf 而非 pdfjs-dist、依赖未安装、vision 能力依赖、M4 分批）。
> 范围：M4a = 文本型 PDF（A 档 AI 映射）+ Word（mammoth）+ JSON + 三步核对向导 + 隐私导出头像打码缺口；**B 档兜底 → M4a.1；vision/图片/T3 → M4b**。

## 0. 前置拍板（✅ 2026-08-09 已全部定案）

| 项 | 定案口径 |
|---|---|
| #2 B 档粒度 | **B 档后置 M4a.1**（A 档主路径先行，B 档是兜底非替代） |
| #3 PDF 文本空阈值 | **按定案 100 字符落码**，M4 实测调参（常量集中 `PDF_TEXT_MIN_CHARS`） |
| #4 JSON 外部 schema | **仅接受 `migrate()` 可解析的合法结构**；非标准 schema 拒绝并提示（不猜测） |
| 新建空白默认头像 | **采纳 `photo:'avatar'`**（M4 图片逻辑输入约定） |
| 头像启发式识别 | **归 M4b**（依赖 unpdf 图片提取能力验证，M4a 不做） |
| 覆盖导入撤销语义 | **一次撤销回滚整个导入**：`history.record(prev)` + 整体替换 + save（不走逐字段 setField，防 50 步栈爆炸） |

## 1. 依赖（G.2 已过：纯 JS / 无原生编译 / 活跃）

- `pnpm add unpdf@^1.8`（ESM，~2.1MB，内部基于 pdf.js——技术栈 B 档「复用 pdfjs 坐标」指其坐标输出）
- `pnpm add mammoth@^1.12`（CJS，**动态 `import('mammoth')`**——技术栈定案）

## 2. 契约层（src/shared 冻结，需集成者批准）

```ts
IPC.Import = {
  Run: 'import:run'          // invoke：主进程开文件对话框 → 解析+映射 → 返回草稿
}
事件：'import:progress' { phase: 'parse'|'map'|'done', ratio }
类型：
  ImportFormat = 'pdf' | 'docx' | 'json' | 'image'
  ImportRunArgs = { format: ImportFormat; resumeId?: string }   // 目标简历（覆盖模式）；新建模式省略
  ImportDraft = {
    format: ImportFormat
    fileName: string
    sourcePreview: string          // 提取文本预览（≤2000 字符）
    resume: Resume                 // 已映射草稿（AI 映射后转正式结构）
    warnings: string[]             // 如：字段缺失、疑似乱码已剔除、B 档提示
    needsVision?: true             // 扫描件/图片（M4b 占位）：非错误，标记前端提示
  }
错误码复用 AiErrorCode + 新增：'PARSE_FAILED' | 'UNSUPPORTED'
```

- `src/shared/schema/import-map.ts`：`ImportMapSchema`（AI 映射的**简化结构化输出**——basics 字段/纯文本 summary/education[]/work[]/projects[]/skills[]/certificates[]/languages[]，不含富文本结构）+ `importMapToResume()` 转换器（纯文本 → RichText 单段落、宽松校验 → `migrate()` 收口）
- `import:run` 入参主进程经 Zod 校验；**文件由主进程对话框选择**（渲染层不传路径——防路径穿越，与 backup import 同模式）

## 3. 模块拆解

### 3.1 主进程 `src/main/import/`

| 文件 | 职责 | 要点 |
|---|---|---|
| `pdf.ts` | PDF 文本抽取与分流 | `unpdf.extractText` → 清洗（剔除纯空白/乱码行 `�` 占比 >30%）→ 有效字符 < `PDF_TEXT_MIN_CHARS`(100) → `needsVision`（M4b 占位）；≥ 阈值 → 文本给 map.ts |
| `docx.ts` | Word 抽取 | 动态 `import('mammoth')` → `convertToHtml` → 转纯文本（语义段落保留换行）→ map.ts |
| `json.ts` | JSON 导入 | `JSON.parse` → `migrate()` → 合法直接成草稿（**零 AI、确定性**）；非法 → PARSE_FAILED |
| `map.ts` | AI 语义映射 | `generateObject({ schema: ImportMapSchema })` → `importMapToResume()` → 草稿；模型经 `createActiveModel()`（复用 M3） |
| `run.ts` | 入口 handler | `dialog.showOpenDialog`（filters 按 format）→ 分派 → `import:progress` 事件 → 返回 `AiResult<ImportDraft>`；超时兜底（30s，仿 export/run） |

### 3.2 渲染层

| 文件 | 职责 | 要点 |
|---|---|---|
| `views/ImportHome.tsx` | 导入入口视图 | 4 卡片（PDF/Word/JSON/图片）；图片/扫描件标注 M4b；点击 → `import:run` → 进向导 |
| `components/import/ImportWizard.tsx` | 三步核对向导（**不可跳过**，信任底线） | ①解析预览（源信息 + 文本预览滚动）②字段映射核对（分组字段列表：原文 → AI 映射值可编辑）③确认写入（新建 / 覆盖当前，二次确认） |
| 写入语义 | 新建 = 新 uuid 填充草稿 → `resume:save`；覆盖 = `history.record(prev)` + 整体替换 + save（**一次撤销可回滚导入**，不走逐字段 setField——防 50 步栈爆炸） | 复用现有 store/IPC，无新写入通道 |
| `i18n` | `import.*` 命名空间（zh/en 对称） | 含 VISION_REQUIRED 提示、PARSE_FAILED、映射警告 |
| 接线 | NavBar `import` 项启用（`coming:import` → `import-home`）+ ResumesHome 导入卡启用 | App.tsx 分发 + NavBar SUBS |

### 3.3 图片归口（M4a 只做缺口，提取归 M4b）

- **隐私导出 PDF 头像打码缺口修复**：`src/main/export/pdf/template.tsx` 的 `<Image>` 在 `privacyMode` 下不渲染（与预览端 blur 对齐，F16 口径）——独立小改 + 回归测试
- 头像启发式识别/提取 → M4b（需先验证 unpdf 图片提取能力）

## 4. 用户旅程验收清单（G.3 UI 轨，checkbox）

- [ ] 新建空白 → 导航「导入」→ 选**文本型 PDF** → 解析预览 → 字段核对 → 新建 → 编辑器出现导入内容（自动保存落盘）
- [ ] 同一旅程选 **Word**（.docx）→ 导入成功
- [ ] 选 **JSON**（合法含 schemaVersion）→ 直接草稿 → 核对 → 写入
- [ ] 选**扫描件 PDF / 图片** → VISION_REQUIRED 提示（M4b 占位，不崩溃）
- [ ] 选**非法 JSON** → PARSE_FAILED 提示，不污染现有简历
- [ ] 覆盖当前简历 → 导入前内容可**一次 Ctrl+Z 回滚**
- [ ] 隐私模式导出 PDF → 头像已打码（与预览 blur 一致）
- [ ] 乱码 PDF → 清洗后仍可导入（warnings 提示）
- [ ] 全程无硬编码中文（CH4 扫描过）

## 5. 测试计划

- 主进程（node + mock）：`json.test.ts`（migrate 兼容/拒绝）、`pdf.test.ts`（mock unpdf：清洗/阈值分流/needsVision）、`docx.test.ts`（mock mammoth）、`map.test.ts`（mock generateObject → 映射 → toResume 校验）、`run.test.ts`（handler 分发/超时）
- 渲染层（jsdom + mock electronAPI）：`import-wizard.test.tsx`（三步流转、字段编辑、新建/覆盖、撤销回滚）
- 回归：`build.test.ts` 补 privacyMode 头像打码用例
- 全量：typecheck + lint + vitest + `docs-tool selfcheck`；向导涉及路由跳转/持久化 → `XM_UI_SMOKE=1` 扩展导入旅程（或手工冒烟）

## 6. 文档同步（三文档铁律 §1.3.1，与代码同批 commit）

- 《技术栈.md》§三：unpdf/mammoth 落码注记、`import:*` 契约、ImportMapSchema
- 《项目功能.md》F06 子文档：状态「已落码（M4a）」
- 《项目实现情况.md》：§一 M4a 条目 + §2.4 偏差新编号（扫描件占位 VISION_REQUIRED、头像提取归 M4b、导入覆盖可单次撤销）
- 《项目日志.md》当日条目 + 月度索引；`gen_api_docs.mjs` 重跑

## 7. 风险与假设

| # | 项 | 处置 |
|---|---|---|
| R1 | unpdf 文本抽取质量（复杂排版/加密 PDF） | 三步核对兜底 + warnings；加密/不可解析 → PARSE_FAILED 提示 |
| R2 | AI 映射质量（字段错位/编造） | 三步核对不可跳过（信任底线）；map 提示词硬约束「仅映射已有文本，禁编造」 |
| R3 | mammoth 动态 import 与 ESM 主进程 | 技术栈定案路径，落码即验证 |
| R4 | 大文件解析性能 | `import:progress` 进度事件 + 30s 超时兜底（仿 export/run） |
| R5 | 头像提取能力（unpdf 图片 API 未知） | 已归 M4b，M4a 不受阻 |

## 8. 执行顺序（TDD，每步验证）

1. 拍板收口（§0 五项）→ `pnpm add unpdf mammoth` → typecheck
2. 契约冻结：`import:*` + `import-map.ts` → `gen_api_docs.mjs` 重跑
3. 主进程 TDD：json.ts → pdf.ts → docx.ts → map.ts → run.ts（每文件先测后码）
4. preload 暴露 `window.electronAPI.import.run` + 类型
5. 渲染层：ImportWizard（三步）→ ImportHome + 接线 → i18n `import.*`（zh/en）
6. 打码缺口修复 + 回归测试
7. 全量验证（typecheck/lint/vitest/selfcheck）→ 三文档同步 → commit（Mimosa 拦截处理同 M3：既有文件豁免声明）

## 9. 复盘基线（M4a 收口时对照）

- 验收总标准：**选文件 → 解析 → 核对 → 写入 → 可编辑/可撤销**，全格式走通；扫描件明确提示 M4b
- M4b 前置条件：unpdf 图片提取能力验证 + 视觉模型守卫落码（规范 4.4）
