# B 档迁移：回归 printToPDF 单引擎 · 执行计划（v1.0 · 待拍板）

> **状态**：待拍板（D1–D6）。动因 = 2026-08-10 网络调研 + 本地 spike + 真实模板对照实证推翻 2026-08-08 定案依据（见 §一）。
> **定位**：架构级决策（导出引擎回归单引擎），正式存档 `file/plans/`。配套：F05 detail + 《技术栈.md》§3.8 修订。
> **证据基准**：本次对照实验产物（scripts/tmp_b_A.pdf / tmp_b_B.pdf）+ doubao 视觉分析 + pymupdf bbox 量化（见 §一.3）。

---

## 一、背景与动因（实证链，防误判）

### 1.1 历史定案（2026-08-08，现被推翻）
- M2 D10 原方案 = 单引擎（隐藏窗口加载同源应用 → Chromium `printToPDF`）。
- 同日实测 printToPDF 在沙箱挂起 → 归档诊断（Coze 生成《PDF导出_完整解决方案.md》）归因"GPU 依赖导致"→ F05/技术栈定案"原 printToPDF 依赖 GPU 合成，无 GPU 机器 100% 失败已退役"→ 切 @react-pdf 纯代码（双引擎）。

### 1.2 网络调研实证（2026-08-10，双代理一手来源）
- **PDF 合成与 GPU 无因果**：Chromium `PrintCompositor`（独立服务进程）用 Skia（SkPicture→SkPDF）**CPU 合成**，无任何 GPU 类型（源码 `print_compositor_impl.h`）；官方文档 "Headless Chrome does not require a GPU, software rendering by default"；官方用法即 `--headless --disable-gpu --print-to-pdf`。
- **Electron 挂起根因与 GPU 无关**（全为版本 bug，已修复）：≤21 旧打印管线（#29324/#27605/#30753，21/22 重构 #33654 修复）；2026-04 队列卡死 #51145（40.9.3/41.3.0/42.0.0 修复）。**本项目 Electron 43.3.0 已含全部修复**。
- Electron 官方 CI 即无 GPU 环境跑 printToPDF：`xvfb-run` + setuid sandbox，不加 GPU flag。

### 1.3 本地 spike + 真实模板对照（2026-08-10，本次会话）
- **无 GPU 不挂起**：`disableHardwareAcceleration()` 下 printToPDF 1650ms（简单 HTML）/ 1913ms（真实模板）正常完成，30s 超时未触发。
- **真实模板链路零重造**：App.tsx **D10 export 模式原样保留**（`?export=1&resumeId=` → ExportView 渲染真实模板 + `__exportReady` 就绪信号 + `print-first-page-only` 截断类）；`print/pdf.ts` 打印窗口服务保留；`resume:open` IPC 已注册。
- **对照差异（A=printToPDF vs B=@react-pdf，同 sample 数据，bbox+doubao 双证）**：

| 维度 | A（printToPDF 真实模板） | B（@react-pdf 现状） |
|---|---|---|
| 无 GPU 挂起 | ✅ 1913ms | — |
| 页数/尺寸 | 2 页 / A4 | 2 页 / A4 |
| 字体 | DengXian + DengXian-Bold 子集嵌入 | DengXian 系 + ArialMT |
| 文本完整性 | 965 字符（headline 渲染 ✓） | 964 字符 |
| **内容边距** | **≈30mm**（bbox 84.8pt；doubao 14%） | **≈15mm**（bbox 42.0pt；doubao 7%） |
| **头部信息布局** | **两列网格**（bbox 双 x 簇） | **单列列表**（bbox 单 x 簇） |
| **website 渲染** | **2 次**（模板重复渲染，预览同源） | 1 次 |
| 邮箱长值 | 截断 `zhangsan@exampl…` | 完整 |
| 分页断点 | 页1 742 字符（y→782.6） | 页1 629 字符 |

- **差异根因判定**：5 处差异全部 = 渲染端模板逻辑 vs @react-pdf 端模板逻辑的**既有双引擎漂移**（A 忠实呈现渲染端模板现状 = 预览现状），非 printToPDF 引擎缺陷。**即：用户当前"预览（两列/30mm 边距）与导出（单列/15mm）"本就不一致**。

### 1.4 结论
定案依据（"printToPDF 依赖 GPU、无 GPU 100% 失败"）**不成立**。回归单引擎 printToPDF：导出=预览由构造保证（同一模板同源渲染），双引擎漂移修复批（pt 换算/行高/间距公式）架构性作废。

---

## 二、范围

**包含**：
1. textPdf 导出引擎切换：@react-pdf → 隐藏窗口 export 模式 + `printToPDF`
2. 打印排版收敛（`@page margin` 0 + 模板 `pagePadding` 全权，对齐预览）
3. export 模式隐私传参（privacyMode → `data-redact`，模板已消费）
4. 页数估算改渲染后测量（D12 恢复：scrollHeight ÷ A4 内容高）
5. `仅第一页` 改回 CSS 截断（D13 原方案，pdf-lib 裁页退役）
6. @react-pdf 退役（依赖移除 + `main/export/pdf/` 删除 + 测试替换）
7. 结构守卫测试更新（PDF 端适配器退役断言）
8. CI：GitHub Actions Linux 无 GPU 跑通（xvfb-run）
9. 文档四连 + 偏差登记（修订"无 GPU 失败"口径 + 新偏差）

**不包含**（显式排除，防范围蔓延）：
- imagePdf / image（capturePage 本就渲染端，本次不动；v1.1 落地时再统一）
- M4b vision / M5 全部（不变）
- 预览分页语义改造（预览单页滚动 vs 导出多页，M5 后评估）

---

## 三、待拍板（D1–D6，括号=推荐值）

| # | 决策点 | 选项 | 说明 |
|---|---|---|---|
| **D1** | 打印边距口径 | **@page margin 0 + 模板 pagePadding 全权（推荐）** vs 保留 @page 15mm 且预览同步加 | 现状：print = @page 15mm + pagePadding 叠加（30mm），预览 = 仅 pagePadding（~8.5mm）→ 不一致根因。推荐交模板统一，print=预览。需对照实验复跑实证 |
| **D2** | 模板现状缺陷（重复 website / 邮箱截断） | **同批修复（推荐）** vs 仅登记 | "导出=预览"成立后缺陷即在预览暴露；且 B 端本无双缺（B 端 1 次/完整）——修复方向以预览为真相源统一。修复需先判定重复根因（customFields 与固定字段冗余渲染）|
| **D3** | 分页验收口径 | 边距/字号/间距/断行一致，**分页按 A4 断页为 print 特性**（推荐） | 预览=单页滚动（preview-paper 794×1123 overflow-y:auto），print=多页——语义天生不同，不强求预览分页 |
| **D4** | 回退策略 | **git 版本回退（推荐）** vs feature flag 过渡 | flag（EXPORT_ENGINE）增加维护面且双引擎漂移仍在；git 基线（本次 6 commit 已提交）回退即恢复 @react-pdf |
| **D5** | CI xvfb | **GitHub Actions xvfb-run（推荐）** | 官方做法（Electron 自身 CI）；ubuntu runner 自带 xvfb。属 CI 配置变更（L2 授权） |
| **D6** | 依赖处理 | @react-pdf/renderer + types **移除**；**pdf-lib 待定** | pdf-lib 当前用途 = textPdf first 裁剪（B 档退役）+ imagePdf v1.1 计划依赖——建议保留（v1.1 已规划），移除则后续 imagePdf 需重引 |

---

## 四、技术方案

### 4.1 主进程导出管线（textPdf，run.ts 重写 textPdf 分支）
```
readResumeOrThrow(resumeId)             // 校验存在性（复用）
→ createPdfWindow()                     // 复用 print/pdf.ts 隐藏窗口（sandbox:false + preload）
→ 加载：dev loadURL(vite?export=1&resumeId&pages&privacyMode) / prod loadFile(out/renderer/index.html + query)
→ 轮询 __exportReady（30s 超时）        // 已有信号
→ document.fonts.ready（3s 兜底）        // print/pdf.ts 铁律
→ 页数测量 executeJavaScript（scrollHeight ÷ A4 内容高）→ pageCount
→ printToPDF({ printBackground:true, preferCSSPageSize:true }) + 30s 超时
→ 失败重建窗口（防打印队列污染，2026 调研建议）
→ 写盘 + 路径穿越防护 + lastFolder 记忆（复用现有）
```
- **隐私**：`privacyMode` 经 URL query 传入 → `useAppBootstrap` export 分支 setState → 模板 `data-redact`（ResumeBody 359 行已消费 store.privacyMode）
- **`仅第一页`**：query `pages=first` → ExportView 挂 `print-first-page-only`（D13 CSS 已存在，max-height 267mm 截断）——pdf-lib 裁剪退役
- **进度事件**：`export:progress` 相位保持（render/write）

### 4.2 export 模式补丁（渲染端）
- `useAppBootstrap.ts` export 分支：读 `privacyMode` query → `useResumeStore.setState({ privacyMode })`
- `App.tsx` ExportView：无改动（store 驱动 data-redact 已有）；补页数测量脚本（可内嵌或主进程 executeJavaScript 注入）

### 4.3 排版收敛（打印 = 预览，批 2）
- `styles.css` `@media print @page margin: 15mm → 0`（D1 定案后）；边距全权 = 模板 `pagePadding`（ResumeBody 根 div `pagePad = lv(layout,'pagePadding',preset)`）
- **实证闭环（复用本次对照脚本）**：复跑 A 路径 → bbox 断言 print 边距 = 预览边距（pagePadding 效果）；doubao 视觉复核"导出 vs 预览"（用户视角一致性）
- 结构守卫（layout-consistency.test.ts）：PDF 端 `toPdf` 适配器退役 → 守卫改为断言"主进程导出无 @react-pdf 引用 + 排版数值单一来源仍为 layout.ts"

### 4.4 @react-pdf 退役（批 3）
- 删除：`main/export/pdf/{template.tsx, build.ts, fonts.ts, richtext.ts, dates.ts}` + `__tests__/{build, tags-export, verify-export, tmp_b_compare}.test.ts`
- 依赖：`pnpm remove @react-pdf/renderer @react-pdf/types`（连带锁 9 内部包）；pdf-lib 按 D6
- 替换测试：export 管线测试（窗口创建/就绪/超时/隐私传参——纯函数 + 契约断言）+ buildTextPdf 引用清理（run.ts/tmp 脚本）

### 4.5 CI（批 4）
- `.github/workflows/ci.yml` test 步骤包 `xvfb-run -a`（ubuntu runner）；确认项目 printToPDF smoke 在无 GPU Linux 跑通（本次 spike 等价）

---

## 五、分批执行（每批 typecheck/lint/vitest 兜底 + commit）

| 批 | 内容 | 验证 |
|---|---|---|
| **批 1 管线** | export 模式补丁（privacyMode 传参）+ run.ts textPdf 切 printToPDF + 页数测量 + 超时/窗口重建 | 对照脚本复跑（A.pdf 产出）+ 契约测试 + typecheck/lint |
| **批 2 排版收敛 + 模板缺陷** | @page margin 0（D1）+ 重复 website/邮箱截断修复（D2） | 对照实验复跑（print 边距=预览 bbox 断言）+ doubao 视觉 |
| **批 3 退役** | main/export/pdf 删除 + 依赖移除 + 测试替换 + 结构守卫更新 | vitest 全量（替换后基线）+ typecheck/lint + build 三端 |
| **批 4 CI + 收口** | xvfb + G.7 四连 + 文档四连 + 偏差登记 + 归档 | CI Linux 绿 + selfcheck 全绿 |

---

## 六、验收标准（G.3 双轨）

**用户旅程（UI 轨）**：选模板→填内容→导出 textPdf→打开 PDF：边距/字号/间距/断行与预览一致（doubao 视觉复核）；隐私模式导出脱敏（data-redact）一致；`仅第一页` 截断正确；中文/等线字体嵌入（无乱码）；无 GPU 环境（本机 VM/RDP 或沙箱）可导出不挂起。

**自动化（IPC 轨）**：export:run 契约不变（参数/结果字段保持，pageCount 语义=渲染后实测）；vitest 新基线；结构守卫绿；`XM_UI_SMOKE` textPdf 导出；CI Linux（xvfb）绿。

**契约**：`src/shared/` 预计无变更（export:run 通道/参数保持）——若有（如 pageCount 语义）先集成者批准。

---

## 七、风险与回退

| 风险 | 缓解 |
|---|---|
| printToPDF 分页断点行为与 @react-pdf 不同（已实证断点不同） | 验收以预览一致为准；半页空白用大数据简历真机验证（break-inside:avoid 行为） |
| Linux 无等线字体 → 打印 fallback 字体（CI/真机） | CI 实证；若需跨端一致，打包 OFL 黑体（M5 字体策略已有） |
| 打印窗口加载时序（React 就绪竞态） | `__exportReady` 数据就绪条件已有（2026-08-08 修复）+ 30s 超时 |
| 打印队列污染（一次失败后卡死） | 保留 30s 超时 + **失败重建窗口**（2026 调研 #51174 已修复 43.3.0，双保险） |
| 回退 | git 恢复 @react-pdf 基线（本次对照前 commit）；放弃即回滚批 1–4 |

---

## 八、文档同步清单（三文档铁律 §1.3.1 + 日志归口）

- 《技术栈.md》§3.8（引擎：printToPDF + 边距口径 + 依赖清单移除 react-pdf）+ §依赖清单
- `file/detail/functions/F05_导出.md`（textPdf 实现重构 + 历史注释修订——**移除"无 GPU 100% 失败"错误口径，注明实证修订**）
- 《项目功能.md》F5（若引擎描述超出既有范围）
- 《项目实现情况.md》§一（新条目）+ §2.4（偏差登记：⑰ 依据修订/新偏差"导出引擎回归单引擎"，注明 2026-08-08 定案误判 + 本次实证链）
- 《项目日志.md》当日条目 + 月度索引 + `file/detail/logs/2026-08.md` 对应批次条目
- 记忆：milestone-status / pdf-export-discrepancies / consistency-reference-principle 同步（定案依据修正）

## 九、遗留与不确定项（如实标注）
- 预览容器（preview-paper 无 padding，边距=模板 pagePadding）与 print 对齐的精确毫米值，批 2 实证后定
- Linux 打印 fallback 字体行为（CI 验证）
- imagePdf v1.1 若落地时统一引擎（capturePage 已渲染端，天然一致）

---

*v1.0 · 2026-08-10 · 基于本次对照实证（scripts/tmp_b_*.pdf/png + doubao 双证）· 待拍板 D1–D6*
