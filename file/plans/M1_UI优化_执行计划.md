# M1 UI 优化执行计划

> **定位**：解决 M1 编辑器里程碑中已落码但 UI 未按《技术栈.md》§3.15.1 规范完整落地的问题。本计划遵循《项目规范.md》全流程纪律，含用户旅程验收清单。
> **创建日期**：2026-08-07
> **所属里程碑**：M1 编辑器（收口补强）

---

## 一、背景与目标

### 1.1 问题来源
M1 编辑器里程碑代码已落地（`project/` 目录，CI 四连绿），但 UI 存在 **「有规范无代码」** 核心缺口：
- **主题系统**：`styles.css` 定义了 4 色令牌表（light/dark/beige/green），但 `main.tsx`/`App.tsx` 无 `data-theme` 注入逻辑，主题切换完全不生效
- **窗口控制**：规范要求「主壳/欢迎面板/各模态面板右上角统一 3 枚 24×24 圆角 6px 细线图标按钮（放到后台/全屏/关闭）」，全项目零实现
- **视觉参数**：首页卡片、左导航、右内容区背景、编辑器顶栏等多处与 §3.15.1 定案参数不符

### 1.2 优化目标
按《技术栈.md》§3.15.1「柔顺卡片风」五次定案参数，**全量落地 UI 规范**，使应用达到可发布的桌面应用视觉与交互标准。

---

## 二、执行范围（按优先级分组）

### P0 核心阻塞（必须先闭环）
| 编号 | 任务 | 规范依据 | 产出文件 |
|------|------|----------|----------|
| P0-1 | 主题系统接入：`data-theme` 首帧注入 + `electron-store` 读取 `appearance` + 设置页联动 | §3.15.1 落地要点、FOUC 防御 | `main.tsx`、`preload/index.ts`、`src/renderer/src/main.tsx`、设置页 | **2026-08-08 部分完成**：`:root` 补 `--selected`、`[data-theme]` 三块自包含 6 令牌、硬编码色全部换 `var()`（换肤条件已具备）；仍待 data-theme 注入 / electron-store / 设置页（M5） |
| P0-2 | 窗口控制三按钮：全局右上角 + 模态面板右上角，双态硬编码 (`#666` → Hover `#1A1A1A`) | §3.15.1 窗口控制按钮 | `WindowControls.tsx`、各面板集成 | **2026-08-08 修订**：死 CSS `.window-controls/.control-btn` 已删除（JSX 零引用），按钮未建，随无边框窗口一并延 M5 |
| P0-3 | 右内容区背景色修正：`.main-area` / `.workspace` 使用 `var(--background)`，与侧栏白卡片区分 | §3.15.1 布局「右内容区背景 = 主题主背景色」 | `styles.css`、相关组件类名 |

### P1 视觉参数对齐
| 编号 | 任务 | 规范依据 | 产出文件 |
|------|------|----------|----------|
| P1-1 | 左侧导航清理：删除旧 `.navbar`/`.navbar.collapsed`，统一 `.navbar-v2` 参数（左圆角 16、右投影、品牌居中、项间距 28px、hover 上浮 -2px） | §3.15.1 左导航 | `styles.css`、 `NavBar.tsx` |
| P1-2 | 首页卡片参数对齐：宽 90% 右缩 (`margin-right: auto`) / 高 56px / 间距 14px / 圆角 12px / 字号 17px/500 / 左距 24px / 第一卡与左导航首菜单项顶部拉齐线 | §3.15.1 右内容「分区选单卡片」 | `styles.css`、 `HomeView.tsx`、 `ResumesHome.tsx`、 `AiHome.tsx`、 `SettingsHome.tsx` | 2026-08-08：硬编码色已换 `var(--surface/--foreground/--selected)`，参数不变 |
| P1-3 | 编辑器顶栏补窗口控制 + 保存状态显示 | §3.15.1 右内容顶部、F2 顶栏 | `TopBar.tsx`、 `WindowControls.tsx` |

### P2 交互完善
| 编号 | 任务 | 规范依据 | 产出文件 |
|------|------|----------|----------|
| P2-1 | ResumesList 列表项 active 下沉态 | §3.15.1 状态信号 | `styles.css` | 2026-08-08：已落并换 `var(--selected)` |
| P2-2 | ComingSoon 占位页使用 `.coming-soon-card` 规范样式 | §3.15.1 Coming Soon | `ComingSoon.tsx`、 `styles.css` | 2026-08-08：背景/投影已换令牌 |
| P2-3 | 预览 hover 定位暗示：`[data-rm-path]:hover` 增加浅色描边 + tooltip 提示 | F2 §3.7 预览反查 | `styles.css`、 `ClassicTemplate.tsx` |
| P2-4 | 字体下拉合并导入字体（`SettingsSchema.importedFonts`） | §3.7.4 字体选择、§3.15.1 设置屏整合 | `TemplateBar.tsx`、 `useResumeStore.ts`、设置页 |

---

## 三、用户旅程验收清单（硬要求）

> **规则**（《项目规范.md》三 §3 角色卡 1 + 4.7 G.7 A）：每个验收步骤必须映射到具体 UI 控件/入口 + 落码工作项；无映射 = 计划漏项。

| # | 用户操作步骤 | 对应 UI 控件/入口 | 对应落码工作项 | 验收判据 |
|---|--------------|-------------------|----------------|----------|
| 1 | 启动应用，观察无白闪（FOUC 防御） | 首帧 `<html data-theme="light">` | P0-1 preload 首帧注入 | 启动瞬间即为浅色主题，无白屏闪烁 |
| 2 | 点击左侧导航「设置」→ 进入设置首页 | NavBar `settings` 主项 + ▾ 展开 | P1-1 NavBar v2 | 左导航项可点击、子项展开（2026-08-08 已落：0.4s 双向动画）、完全收起浮按钮显示 |
| 3 | 在设置 → 外观 切换主题为 `dark` | 单选卡 `dark` + `appearanceMode` 2选1 | P0-1 设置页联动 + `data-theme` 实时切换 | 界面瞬间变深色，侧栏 `#202124`、卡片 `#202124`、前景 `#E0E0E0`、无绿字 |
| 4 | 切换 `beige` / `green` 验证 4 色完整 | 单选卡 `beige` / `green` | P0-1 4色令牌自包含 | 各主题令牌自包含声明，颜色与 §3.15.1 令牌表一致 |
| 5 | 打开编辑器（新建/打开示例），右上角见窗口控制三按钮 | TopBar 右侧 `WindowControls` | P0-2 + P1-3 窗口控制集成 | 三按钮 24×24 圆角 6px、常态 `#666`、Hover `#1A1A1A`、距顶/右 12px |
| 6 | 拖拽编辑器/预览分割条，预览面板缩放完整展示 | `.splitter` 拖拽 + `BasicPreview` `--preview-scale` | M1 已有 + P0-3 背景色 | 2026-08-08 修订机制：纸张固定一页 A4（794×1123）水平居中、`scale = min(面板宽/794, 面板高/1123, 1)` 封顶 100%、内容超高时纸内纵向滚动；无横向滚动条 |
| 7 | 点击预览区某 section（如「工作经历」），左侧编辑器滚动定位 + 高亮闪烁 | `SectionBlock` `data-rm-path` + `EditorPane` 反查 | M1 已有 + P2-3 hover 暗示 | hover 显示浅色描边、点击左侧滚动到对应卡片、1.2s 闪烁动画 |
| 8 | 重启应用，验证主题持久化 + 最近简历恢复 | `electron-store` `appearance` + `resume:open` 恢复 | P0-1 持久化 + M1 `loadResumeIntoEditor` | 重启后主题保持、打开示例自动切入编辑器视图 |
| 9 | 设置 → 外观 切换语言 `en`，UI 文案全英、简历数据不变 | 语言单选卡 `en` | P0-1 设置页语言联动（T5 已定） | 所有 `t('key')` 渲染为英文、用户填写的中文简历内容原样保留 |
| 10 | 完全收起左侧导航，仅显示浮出按钮「»」，点击展开 | NavBar `sidebarCollapsed=true` + `.nav-edge-toggle` | P1-1 NavBar 完全收起态 | 导航宽度 0、左侧边缘浮按钮「»」可见、点击展开恢复 168px |

---

## 四、依赖与约束

| 依赖项 | 说明 |
|--------|------|
| `electron-store` | 已引入 v11.0.2，用于持久化 `appearance`/`appearanceMode`/`language` |
| `safeStorage` | 已在依赖，API Key 加密用，主题无需加密 |
| `@electron-toolkit/preload` | 已引入，preload 暴露 `electronAPI` |
| `settings.appearance` 设置页 | T5/S1 已在文档定案，UI 需落码（本计划 P0-1 含设置页联动） |
| `gen_nav_proto.py` | 如涉及导航/功能分区变更，需走三步铁律（本计划仅视觉参数对齐，**不改线框/交互原型**） |

---

## 五、执行顺序与里程碑

| 阶段 | 任务组 | 预计工时 | 验收节点 |
|------|--------|----------|----------|
| Phase 1 | P0-1、P0-2、P0-3 | 1.5 天 | 主题可切换、窗口控制可见、右侧背景色正确 |
| Phase 2 | P1-1、P1-2、P1-3 | 1 天 | 导航/首页/顶栏参数全对齐 |
| Phase 3 | P2-1、P2-2、P2-3、P2-4 | 0.5 天 | 交互细节完善 |
| Phase 4 | 全量 lint/typecheck/test + 用户旅程走查 | 0.5 天 | CI 全绿 + 10 条验收清单逐项通过 |

---

## 六、风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| `data-theme` 注入时机过晚导致 FOUC | 启动白闪 | preload 首帧前同步读取 `electron-store` 注入 `<html data-theme>`，参考 S1 草稿 FOUC 防御方案 |
| 窗口控制按钮在 macOS 与原生冲突 | 三按钮重叠 | Windows/Linux 显示自定义；macOS 可隐藏自定义用原生（`BrowserWindow` `titleBarStyle: 'hiddenInset'`），但规范要求统一，暂全平台自定义 |
| dark 主题绿字回归 | 违反防绿字护栏 | 每个 `[data-theme]` 块自包含声明全部 6 令牌，CI 增加色相断言校验 |
| 设置页 `appearance` 联动未实现 | 主题切换无入口 | 本计划 P0-1 含设置页最小联动落码（单选卡 + mode 2选1 + 300ms 实时预览） |

---

## 七、交付物清单

### 代码文件（新增/修改）
- `project/src/main/index.ts` — preload 注入 `data-theme` 钩子（或 `preload/index.ts`）
- `project/src/preload/index.ts` — 首帧前读取 `electron-store` `appearance` 注入 `document.documentElement.dataset.theme`
- `project/src/renderer/src/main.tsx` — 兜底初始化 `data-theme`
- `project/src/renderer/src/components/ui/WindowControls.tsx` — **新增** 窗口控制三按钮组件
- `project/src/renderer/src/components/topbar/TopBar.tsx` — 集成 `WindowControls`、保存状态
- `project/src/renderer/src/components/nav/NavBar.tsx` — 清理旧类名、参数对齐
- `project/src/renderer/src/views/HomeView.tsx` — 卡片参数对齐（宽/高/间距/拉齐线）
- `project/src/renderer/src/views/ComingSoon.tsx` — 使用 `.coming-soon-card`
- `project/src/renderer/src/views/ResumesList.tsx` — active 态下沉
- `project/src/renderer/src/preview/ClassicTemplate.tsx` — hover 定位暗示 tooltip
- `project/src/renderer/src/components/topbar/TemplateBar.tsx` — 字体下拉合并导入字体
- `project/src/renderer/src/styles.css` — 删除旧 `.navbar`、修正右内容区背景、补充 active 态、tooltip 样式

### 文档更新
- 《项目日志.md》追加「M1 UI 优化执行」条目（含自检结果）
- 《项目实现情况.md》更新 M1 状态（UI 规范落地完成）

---

## 八、自检清单（G.7 结构化自检，交付前强制跑）

### A. 完成度
- [ ] 10 条用户旅程验收清单逐项有明确落码工作项映射
- [ ] 所有 P0/P1/P2 任务有交付文件、可验证
- [ ] 最小用户旅程可走通：启动→设置切主题→打开编辑器→拖拽分割→预览点击定位→重启恢复

### B. 文档一致性
- [ ] 改动落点准确（内容进对应文件，§1.3 落点规则）
- [ ] 索引/总览同步（涉及 F18/F13/F4 章节时功能总览无断裂）
- [ ] 引用无断裂（提及的文件/章节/编号真实存在）
- [ ] 术语统一（`appearance`/`appearanceMode`/`data-theme`/`WindowControls` 与既有文档一致）
- [ ] 《项目日志.md》已登记当日条目

### C. 质量门
- [ ] `pnpm run typecheck` / `lint` / `test` / `build` 全绿
- [ ] 契约冻结（`src/shared/` 无越权改动）
- [ ] 禁硬编码中文（文案走 i18n）
- [ ] UI 入口断言：新增 `WindowControls` 组件在 i18n、TSX、IPC 三处闭环

### D. 纪律红线
- [ ] AI 定位铁律未违反
- [ ] 架构铁律未违反（主进程承载副作用、渲染进程纯 UI）
- [ ] 新依赖过 G.2 三问（本计划**零新依赖**）
- [ ] 配色边界未违反（4 色令牌权威唯一、自包含声明、`--resume-*` 正交）

### E. 遗留登记
- [ ] 无 blockers / 沙箱假阳性 / 待用户拍板项

---

> **执行原则**：单 AI 顺序执行，每完成一组任务即跑自检；**不攒批、不并行写同一文件**；Phase 4 全量验收通过后才可宣布"落码完成"。