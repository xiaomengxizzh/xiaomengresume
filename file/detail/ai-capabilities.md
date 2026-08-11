# AI 开发能力档案 —— UI 启动与截图

> **定位**：AI 开发期辅助能力记录（2026-08-09 实测验证），供后续任务直接复用，无需重复验证。
> **性质**：非产品功能文档，不进产品代码；产品文档体系见 6 主文档（`file/`）。

## 1. 测试目标

验证 AI 能否**自行启动项目 UI 并对完整界面及各功能区截图**（完整窗口 / 左编辑面板 / 右实时预览 / 导出弹窗 / 导入功能区 / 状态栏提示）。

## 2. 测试结果：✅ 成功

7 类界面区域**全部截图成功**，并经 doubao 视觉模型（`vision-analyze.mjs`）逐张识别确认内容对应，console 零错误。

### 2.1 截图文件清单（`ui_screenshots/`）

| 文件 | 界面区域 | 结果 |
|---|---|---|
| `01_home_full.png` | 完整首页（欢迎栏 + 左侧导航 + 5 功能卡片） | ✅ |
| `02_editor_full.png` | 完整编辑器（顶栏 + 左编辑面板 + 右实时预览） | ✅ |
| `03_editor_left_panel.png` | 左侧编辑面板（模块卡片列表） | ✅（底部滚动条属窗口高度限制，正常） |
| `04_preview_right.png` | 右侧实时预览（A4 纸张完整显示） | ✅（空模板占位，新建空白预期） |
| `05_export_dialog.png` | 导出弹窗（模态，4 格式 + 目标位置） | ✅ |
| `06_privacy_mode.png` | 隐私打码模式（底部状态栏 + 弹窗红色提示条） | ✅（空简历无数据，打码效果未体现） |
| `07_import_dialog.png` | 导入功能区（PDF/Word/JSON 格式选择） | ✅（导入为**内嵌页**非模态弹窗） |

### 2.2 已发现 UI 缺陷（截图副产品，未修复）

- **P1 源码注释泄漏进预览**：预览区"自我评价"板块渲染出 `/* 2026-08-09 模块排序... */`（02/04/06 均现）——疑 `templates/shared/ResumeBody.tsx` 最近改动把注释写入 JSX 渲染路径。
- **P2 导出弹窗布局溢出**：取消/导出按钮溢出容器下边界、"重置为默认"被截断、说明文字错位（05/06）。
- **P2 隐私状态栏文案重复**："隐私模式已开启"连续拼接两次（06）。

## 3. 工具与方法

| 项 | 说明 |
|---|---|
| 启动 | `pnpm build` 产出 `out/` → 独立 Electron 主进程加载 `out/renderer/index.html`（不走 `pnpm dev`，dev 模式无法注入自动化） |
| 截图 | Electron `webContents.capturePage()` + `nativeImage.crop()`（按 CSS 选择器裁剪子区域，按 DPR 换算物理像素） |
| 交互 | 主进程 `executeJavaScript` 文本匹配点击 / 快捷键（Ctrl+Shift+P） |
| 视觉验证 | 火山 doubao：`node ~/.agents/scripts/vision-analyze.mjs <图> "<问题>"` |
| 依赖 | **零新增**（复用项目自带 electron 二进制）；`userData` 指向 `%TEMP%\xm-ui-cap-*` 防污染真实数据 |

## 4. 一键复现

```bat
cd project
pnpm.cmd build        REM 先构建 out/（node 需在 PATH 前缀）
node_modules\electron\dist\electron.exe ..\scripts\ui_capture.cjs
```

- 截图脚本：**`scripts/ui_capture.cjs`**（AI 开发期工具，非产品代码）。
- 输出：`ui_screenshots/01..07_*.png` + stdout `UI_CAP` JSON（含每张结果与 console 错误）。
- 复用方式：新增功能区截图 → 仿照 `captureRegion(selector)` / `CLICK_JS(文本)` 增补步骤；改窗口尺寸 → 调 `BrowserWindow` 的 width/height。

## 5. 限制与需人工干预环节

| 限制 | 说明 |
|---|---|
| 隐私打码效果 | 空简历无敏感信息无法体现打码——需先"打开示例"（Ctrl+Shift+O）再截图 |
| 未开放功能区 | 图片版 PDF 导出（v1.1）、岗位目录卡片（置灰）为产品未开放，按钮不可点 |
| 模块拖拽交互 | 实时交互单帧截图意义有限，未单独捕获（导出弹窗已覆盖"可展开功能区"项） |
| 首次截图 GPU 错误 | `UnknownVizError` 偶发 → 脚本已内置 3 次重试（实测 attempt:1 成功） |
| 编辑器就绪时序 | 点击"新建空白"后编辑器渲染有延迟 → 脚本轮询 `.editor-pane` 出现再截（曾截到首页，已修） |
| 环境 | Windows system shell 下 `findstr`/`grep` 不可用、pnpm 需 `set PATH=<node安装目录>;%PATH%` |

## 6. 关联

- doubao 视觉工具：记忆 `doubao-vision-tool`（key 自动从 `~/.zcode/v2/config.json` 读取，脚本内不落盘）。
- 相关目录：截图输出 `ui_screenshots/`（可重建，非产品资产）。
