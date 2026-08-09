# M5 无边框窗口 spike（可行性验证方案）v0.1

> 依据：《技术栈.md》§3.15.1（窗口控制三按钮定案：主壳/欢迎面板/模态右上角 3 枚 24×24 圆角 6px 细线图标：放到后台/全屏/关闭，距顶 12px 距右 12px，双态硬编码 #666→Hover 变深）+ 2026-08-08 评估（无边框 = M5 最大技术风险，先 spike 验证）。
> 前置（2026-08-09 已落）：F18 data-theme 首帧注入（M5 设置屏/窗口壳不再二次适配）。
> **本 spike 需真机验证**：沙箱无 GPU 无法起 Electron（M3 后实测），spike 结论以用户本机跑通为准。

## 1. 目标

验证 Windows 11 无边框窗口全链路可行性，收口 M5 窗口改造的技术方案与风险：

1. `frame: false` 下窗口可拖动（自定义标题栏拖拽区）。
2. 三按钮（最小化/最大化还原/关闭）经 IPC 控制主窗口，点击区域可命中。
3. 窗口阴影/圆角在 Win11 正常（frameless 默认行为）。
4. 最大化/还原状态正确（拖拽区双击还原、按钮图标态切换）。
5. 不破坏既有功能（F12 devtools、模态、多窗口打印窗不受影响）。

## 2. 技术方案（候选）

| 项 | 方案 | 说明 |
|---|---|---|
| 窗口形态 | `frame: false`（保留 `autoHideMenuBar`；`titleBarStyle` Win 无效可省） | macOS 用 `titleBarStyle:'hiddenInset'` + traffic lights（M5 跨平台时补） |
| 拖拽区 | 顶栏容器 CSS `-webkit-app-region: drag`；三按钮/交互元素 `no-drag` | 与 F18 主题壳同层；仅标题栏横条可拖 |
| 窗口控制 IPC | `window:minimize` / `window:maximize-toggle` / `window:close`（主进程 `ipcMain.on`，无返回值单向） | 冻结于 ipc-channels（M5 开工时过契约批准） |
| 最大化状态 | 主进程 `win.on('maximize'/'unmaximize')` → `webContents.send('window:maximized', bool)`；渲染层按钮图标切换 | 双击拖拽区还原由系统默认处理（frameless 保留该行为） |
| 全屏按钮 | 按定案为「全屏」（`win.setFullScreen(!isFullScreen)`）而非最大化？——**待确认**：技术栈写"放到后台 / 全屏 / 关闭"，需与最大化语义对齐 | spike 时实测三按钮语义 |

## 3. 风险与验证清单（真机逐项打勾）

- [ ] 拖拽：`drag` 区拖动窗口流畅，标题栏空白处可拖，输入框/按钮（`no-drag`）点击不触发拖动
- [ ] 三按钮：最小化→任务栏；关闭→应用退出（主窗口 `closed` 逻辑不变）；中间按钮最大化/还原 + 图标态切换（`maximize`/`unmaximize` 事件驱动）
- [ ] Win11 圆角阴影：frameless 默认 DWM 圆角/阴影正常（若异常：`win.setWindowButtonVisibility` 或系统设置回退）
- [ ] 双击拖拽区最大化/还原（系统行为，验证不被 `no-drag` 覆盖）
- [ ] F12 devtools 可用（`optimizer.watchWindowShortcuts` 不受 frameless 影响）
- [ ] 打印窗口（`print:pdf` 隐藏窗）不套无边框/三按钮（仅主窗口改造）
- [ ] 模态/下拉/对话框定位不被自定义标题栏遮挡（顶栏高度 + 12px 按钮区）
- [ ] 多显示器：拖到副屏、最大化边界正确
- [ ] 缩放（Win 125%/150%）下按钮 24×24 可点（CSS px 与 DIP 换算）

## 4. 落点（spike 通过后 → M5 正活）

- 主进程：`createMainWindow` 加 `frame:false` + 三 IPC handler + maximize 事件广播
- preload：`window.controls` 命名空间（minimize/maximizeToggle/close + onMaximized）
- 渲染层：F18 壳内加 `.window-controls`（三按钮组件，复用既定样式参数）+ 顶栏拖拽区
- i18n：`window.*` 无文案（图标按钮，tooltip 可加 zh/en）
- 契约冻结 + 三文档同步 + 日志（M5 里程碑开工时）

## 5. 回退预案

若 Win11 frameless 圆角/阴影异常且无低成本方案：保留 `frame: true` + `titleBarOverlay`（Windows 原生标题栏按钮覆盖，`titleBarOverlay: { color, symbolColor, height }`）——三按钮由系统渲染，拖拽区自绘，风险最低。spike 优先验证 `frame:false`，失败转 `titleBarOverlay`。
