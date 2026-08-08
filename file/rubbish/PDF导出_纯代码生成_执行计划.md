# PDF 导出重构 · 纯代码生成执行计划（v2.0）

> 状态：✅ **已完成（2026-08-08 14:45）** | 前置：grill-me 评审推翻 v1.0（《PDF导出_完整解决方案.md》方案 A-E 全部否决）
> 本文档为本次执行的唯一依据；G.7 自检结果见文末 §8。正式文档同步（F05《导出》+《技术栈》§3.8）待集成者按纪律执行。

---

## 1. 背景与结论（评审摘要）

### 1.1 问题本质（用户拍板）
- **产品底线**：文字版 PDF 必须可导出、文字可选中（矢量）；报错不算交付。
- **技术选型缺陷**：v1.0 将 textPdf 完全押注 `printToPDF`（GPU 依赖 Chromium 打印管线）。
  实测本机（非沙箱）：printToPDF 永不 resolve、capturePage 崩溃、SwiftShader/ANGLE 全 FATAL——
  **Chromium 渲染全家桶在无 GPU 机器物理不可用**。RDP/虚拟机/无显示 Linux/混合显卡均为真实用户群，
  「用户有 GPU」不是产品保证。
- **业界标准答案**：纯代码矢量 PDF 生成（@react-pdf/renderer 等）——React 组件描述布局 → 直接生成
  PDF 二进制流，文字矢量可选中，**零 GPU/浏览器渲染依赖**，任何环境可跑。

### 1.2 方案裁决（grill-me 收口）
| 旧方案 | 裁决 | 原因 |
|---|---|---|
| A. GPU 降级+Software | ❌ | offscreen+printToPDF 同管线，无 GPU 照样挂（实测 FATAL） |
| B. 外挂 Chrome headless | ❌ | +150MB、违反零依赖/离线隐私铁律 |
| C. jsPDF+html2canvas | ❌ | 位图、文字不可选，违反矢量铁律 |
| D. 修复 printToPDF+自适应 | ❌ | 主路径已兜底，但无法产出真 PDF |
| E. CDP 直连 | ❌ | 与 printToPDF 同一 Chromium 管线 |
| **新：@react-pdf/renderer 纯代码** | ✅ | 矢量、文字可选、零 GPU、自动换行/分页/文本测量；v4.1+ 官方支持 React 19 |

### 1.3 双轨制
- **主路径（本次落地）**：文字版 PDF = `@react-pdf/renderer` 纯代码生成（主进程），任何环境可用。
- **增强路径（保留）**：printToPDF 相关代码（export/run.ts 旧分支、print/pdf.ts）保留不删，
  作为有 GPU 环境的可选增强/回退；本次不接入，仅保证不被破坏。
- **图片版 PDF / 图片**：维持 v1.1 计划（pdf-lib 合成 #22 已拍板）；pdf-lib 本次提前引入仅用于
  「仅第一页」裁剪（D13 替代方案）。

---

## 2. 架构设计

### 2.1 生成位置：主进程
- 渲染进程无 Node fs 权限（contextIsolation+nodeIntegration:false），读系统字体必须 IPC；
  主进程天然可 `fs.readFile` 字体文件 → `Font.register({ family, src: { data, format } })`。
- 主进程生成 `Buffer` → 直接 `fs.writeFile` 落盘，链路最短；**不创建隐藏窗口、不 loadURL、不碰 GPU**。
- electron-vite main 构建用 esbuild，支持 TS/JSX（`@react-pdf/renderer` 经 externalizeDepsPlugin 外部化）。

### 2.2 新增文件（src/main/export/pdf/）
```
pdf/
├── fonts.ts          # 系统字体解析：FONT_OPTIONS id → 系统字体文件路径（跨平台探测）+ Font.register
├── richtext.ts       # RichText(Tiptap JSON/HTML) → 纯文本提取（粗体/列表/换行 → PDF Text 渲染）
├── template.tsx      # ResumePdfDocument：@react-pdf/renderer 简历 PDF 组件（classic 版式；modern/compact v2.1）
├── build.ts          # 编排：读 resume → 注册字体 → renderToBuffer → (pages=first? pdf-lib 裁第一页) → Buffer
└── __tests__/build.test.ts
```

### 2.3 修改文件
- `src/main/export/run.ts`：textPdf 分支改为调用 `buildTextPdf()`；保留 json 分支；printToPDF 旧路径保留注释标记（v2.1 增强）
- `src/shared/ipc-channels.ts`：契约不变（ExportRunArgs 已含 resumeId/pages/folderPath）
- `tsconfig.node.json`：加 `"jsx": "react-jsx"`（主进程编译 .tsx）

### 2.4 数据流
```
ExportDialog (renderer) → export:run {format:'textPdf', resumeId, folderPath, pages}
  → main: openResume(resumeId) 读 JSON
  → buildTextPdf(resume):
      fonts.resolveAndRegister()   // simhei/msyh 等系统字体 → Font.register
      richtext: RichText → 纯文本段
      renderToBuffer(<ResumePdfDocument resume={...}/>)  // 矢量、文字可选
      pages==='first' ? pdf-lib 裁第一页
  → fs.writeFile(<folderPath>/<name>.pdf)
  → { canceled:false, filePath }
```

---

## 3. 字体策略（关键风险点）

### 3.1 探测优先级（跨平台）
| FONT_OPTIONS id | Windows | macOS | Linux |
|---|---|---|---|
| system/yahei | msyh.ttc | PingFang.ttc | NotoSansCJK-Regular.ttc |
| songti | simsun.ttc | STSong.ttf | NotoSerifCJK-Regular.ttc |
| heiti | simhei.ttf | STHeiti.ttf | NotoSansCJK-Bold.ttc |
| kaiti | simkai.ttf | Kaiti.ttc | (无,回退系统) |
| fangsong | simfang.ttf | STFangsong.ttf | (无,回退系统) |
| times | times.ttf | Times.ttc | LiberationSerif-Regular.ttf |
| arial | arial.ttf | Arial.ttf | LiberationSans-Regular.ttf |
| georgia | georgia.ttf | Georgia.ttf | (无,回退 times) |

### 3.2 实测规则（必须执行）
1. **TTC 兼容性实测**：@react-pdf/fontkit 对 .ttc 支持有限——首选 .ttf（simhei.ttf/times.ttf）；
   .ttc 字体（msyh.ttc/simsun.ttc）若注册失败 → 回退 simhei.ttf（黑体覆盖中文+粗细均可）
2. 注册两组 family：`zh`（黑体，normal/bold）+ `en`（西文）；PDF 组件 fontFamily 取对应
3. 字体文件缺失 → 不抛错，回退默认（Helvetica 兜底中文乱码 → 登记已知限制，日志 warn）

### 3.3 隐私（F16 data-redact）
- privacyMode 已在导出弹窗联动（ExportDialog），data-redact 类由模板 CSS 处理——纯代码 PDF 组件
  需同等处理：字段级 redact（姓名/电话/邮箱/地址等）→ `████` 占位。**本次实现字段级打码**（与 CSS 行为对齐）

---

## 4. 实现清单（执行顺序）

1. ✅ 依赖安装：@react-pdf/renderer@^4.5.1 + pdf-lib@^1.17.1（#22 候选提前引入，仅裁剪用）
2. tsconfig.node.json 加 jsx: react-jsx
3. pdf/fonts.ts：系统字体探测 + Font.register（含 TTC 回退）
4. pdf/richtext.ts：RichText → 纯文本（段落/粗体/列表/换行）
5. pdf/template.tsx：ResumePdfDocument（classic 版式：头部两列+分区标题+条目排版）
6. pdf/build.ts：buildTextPdf() 编排 + pages:'first' pdf-lib 裁剪
7. run.ts 接入 + 旧 textPdf 分支标记退役
8. 单测：build.test.ts（样例简历 → 生成 PDF → 断言 %PDF- 魔数/非空/文字嵌入）
9. typecheck/lint/test 全绿 + 冒烟登记

## 5. 测试与验收

- **单测**（vitest node 环境）：buildTextPdf 对 material/简历示例1.json → Buffer 非空 + %PDF- 魔数
  + PDF 含字体（不依赖 GPU；fontkit 纯 JS 解析）
- **冒烟**：XM_EXPORT_SMOKE=1 走真实 export:run → 校验落盘 PDF（verify-export.ts 逻辑不变，链路自动受益）
- **验收标准**（用户底线）：本机（无 GPU）跑通 textPdf 导出 → 产出可选中文字的矢量 PDF
- **已知限制**：① 排版与预览有细微差异（纯代码 vs HTML，接受）；② .ttc 字体回退黑体（登记）；
  ③ 头像图片 v2.1（本次纯文本）；④ modern/compact 版式 v2.1（本次 classic 单版式通用渲染）

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| @react-pdf/renderer 在 Electron 主进程 ESM 下加载失败 | 用 CJS interop（esModuleInterop 已开）；探针先行验证 |
| fontkit 对 .ttc 不支持 | 首选 .ttf；注册失败回退 simhei.ttf |
| 中文字体体积大（msyh.ttc 19MB） | 仅读 buffer 注册不落盘；PDF 子集嵌入（fontkit 自动子集化） |
| pages='first' pdf-lib 裁剪异常 | 裁剪失败 → 回退全量 PDF（不抛错，登记日志） |
| 本次改动破坏旧 printToPDF 路径 | 旧分支代码保留未删，仅 textPdf 分支换新实现；冒烟双轨验证 |

## 7. 自检（G.7 执行后）
A 完成 / B 一致（文档同步 F5+技术栈§3.8）/ C 质量（typecheck/lint/test 全绿）/ D 纪律（零新违规依赖已过 G.2 三问：纯 JS 无原生编译无二进制）/ E 遗留（登记 v2.1 项）

## 8. G.7 自检结果（2026-08-08 14:45）

| 项 | 结果 |
|---|---|
| A 完成 | ✅ 依赖安装 + pdf/ 四模块 + run.ts 重构 + 契约扩展 + tsconfig jsx，全部落地 |
| B 一致 | ⚠️ 计划文档已更新；F05/技术栈§3.8 正式文档待集成者同步（纪律：集成者唯一写正式文档） |
| C 质量 | ✅ typecheck:node/web 全过；lint 全过；**12 文件 84 用例全绿**（新增 build.test.ts 6 例）；electron-vite build 成功 |
| D 纪律 | ✅ @react-pdf/renderer + pdf-lib 均纯 JS、无原生编译、无额外二进制，过 G.2 三问；已入 deps-cache |
| E 遗留 | ✅ 登记：modern/compact 版式差异、头像图片、非 ttf 字体回退黑体（msyh/simsun 仅 ttc）、CI 无字体中文乱码警告 → v2.1 |

**产品底线验证（决定性）**：沙箱无 GPU 环境产出 `宋哈娜-文字版.pdf`（33.5KB · 2 页 · A4），
PDF 结构确认 `/FontFile2` 嵌入 SimHei + `/ToUnicode` 映射（**文字可选中**）+ `/CIDFontType2 Identity-H`（中文正常）
→ 用户拍板底线「任何环境可导出可选中文字的矢量 PDF」达成。

