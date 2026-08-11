# ui-config — UI 配置体系（设计阶段产物）

> **不进最终产物打包**：本目录是 AI/设计期维护的配置源，由生成器在构建期消费；
> 渲染层只消费生成的 CSS 变量（`var(--ui-*)`），不 import 本目录任何文件。

## 变更流程

1. 改 `layout.ts`（或未来的 `type.ts` / `color.ts`）里的值
2. `node scripts/gen_ui_config.mjs` —— 重新生成 `project/src/renderer/src/ui-config.generated.css`（已 gitignore）
3. 重新 `pnpm build`（build 已自动前置生成器）

## 词汇表（用户口语 ↔ 配置键）

| 你说的 | 配置键 | 当前值 | 说明 |
|---|---|---|---|
| 卡片长度 / 宽度 | `layout.listMaxWidth` | 860px | 列表容器最大宽度，0=通栏 |
| 列表左右留白 | `layout.listPaddingX` | 40px | 列表容器水平内边距（卡片实际宽 = maxWidth − 2×此值） |
| 顶部拉齐 | `layout.homeTopPadding` | 96px | home-view 顶部 padding（对齐左导航首项） |
| 底部留白 | `layout.homeBottomPadding` | 40px | home-view 底部 padding |
| 内容纵向间距 | `layout.homeGap` | 14px | home-view 子元素间距 |
| AI 内容卡宽 | `layout.contentMaxWidth` | 560px | AI 功能区窄卡（AiMatch/AiPolish）最大宽度 |
| 卡片间距 | `layout.listGap` | 10px | 列表卡片之间垂直间距 |
| 卡片内部留白 | `layout.cardPaddingX/Y` | 20px / 14px | 卡片内边距 |
| 模块卡间距 | `layout.moduleGridGap` | 14px | 编辑区模块卡网格间距 |

## 目录路由

- `layout.ts` — 尺寸与布局（已落地）
- `type.ts` — 排版（预留，M5）
- `color.ts` — 色板（预留，M5）
- `index.ts` — 汇总导出

## 设计原则

- **只配置会反复调整的语义尺寸**；组件内部一次性细节不进本目录（深模块/组件自治）
- **命名对齐用户口语**（见词汇表），AI 改 UI 时优先读本目录定位
- 色板/排版权威仍在 styles.css / `shared/templates/layout.ts`（防绿字护栏、模板=打印铁律不变），M5 自定义主题时经本目录统一入口
