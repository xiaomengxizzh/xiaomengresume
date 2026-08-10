# UI 美化开发方案

> **定位**：应用自身 UI（侧栏 / 设置 / 向导 / 主题编辑器）的体系化美化执行计划——令牌收拢 → 组件库 → 主题派生护栏。不涉及简历内容（TipTap 模板）与 `--resume-*` 预览白纸。
> **创建日期**：2026-08-09
> **所属里程碑**：M5 前置能力（F18 主题切换/设置面板随 M5 接线，本方案为其铺地基）
> **拍板（2026-08-09 用户三项定案）**：
> 1. **shadcn 落地 = 手抄组件源码**（不用 CLI，零 Radix 依赖，扩展既有 `components/ui/index.tsx` 手写库）
> 2. **品牌色 `--primary` 从 4 主题分别派生**（每 `[data-theme]` 块自包含，color-mix 派生，零新增 hex）
> 3. **渲染层专用 UI 依赖放 devDependencies**（照常打进 renderer JS，不进 asar node_modules，避免双份存储）——策略登记于《技术栈.md》

---

## 一、背景与依据（实测）

- **技术栈**：Electron 43 + electron-vite 5 + Vite 7 + React 19 + TS 5.9 + Tailwind CSS 4.3（`@theme inline` 已映射 6+3 令牌，见 `styles.css:10-22`）。
- **构建基线**：`out/renderer/assets` JS ≈ 1725KB / CSS ≈ 38KB（minify 后）；main/preload 走 `externalizeDepsPlugin`（`dependencies` 整包进 asar），renderer 由 Vite/Rollup 打包（摇树生效）。
- **令牌体系**：4 权威（`--background/--sidebar/--card/--foreground`）+ 2 派生（`--selected/--border`）+ 3 语义色（`--danger/warning/success`），`data-theme` 4 态自包含（防绿字护栏）。
- **组件现状**：`components/ui/index.tsx` 已有手写 Button/Input/Textarea/Select（shadcn 风格、走令牌、禁硬编码色）。
- **缺口**：`--radius/--shadow` 裸变量未进 `@theme`；卡片 12px / hover 阴影等散落硬编码；缺 Switch/Dialog/Slider/Badge/Tooltip/Label/Progress；`--primary` 等 shadcn 组件消费变量未定义；无对比度护栏测试。

## 二、执行范围（三层，按依赖成本升序）

### P0 令牌收拢（零新依赖）
| 编号 | 任务 | 产出 |
|------|------|------|
| P0-1 | `@theme inline` 补 `--radius-card: var(--radius)` / `--shadow-card: var(--shadow)` / `--shadow-card-hover` / `--shadow-card-press` / `--font-ui: var(--ui-font)` | `styles.css` |
| P0-2 | `:root` 与 4 个 `[data-theme]` 块定义新令牌（shadow-hover/press 各主题自包含，同值保视觉一致） | `styles.css` |
| P0-3 | `:root` 落 `--ui-font` 默认值（= 现 body 字体栈；WP-T4 落地后覆盖）；body `font-family` 改 `var(--ui-font, …)` | `styles.css` |
| P0-4 | 替换语义等同的散落硬编码：卡片 `border-radius: 12px` → `var(--radius-card)`；`0 12px 32px` → `var(--shadow-card-hover)`；`0 2px 8px` → `var(--shadow-card-press)`。**保留**局部专用值（navbar 16px 左圆角、nav 内 6/8px、entry-card 10px、swatch 6px）——非卡片语义，不令牌化 | `styles.css` |

### P1 组件库（手抄 shadcn 风格，依赖仅 clsx + tailwind-merge）
| 编号 | 任务 | 产出 |
|------|------|------|
| P1-1 | 新增 `lib/utils.ts` `cn()`（clsx + twMerge） | `lib/utils.ts` |
| P1-2 | 手写 **7 个组件**：Switch（原生 button role=switch）、Dialog（原生 `<dialog>`）、Slider（样式化 range）、Badge、Tooltip（CSS `::after` 模式，对齐 `[data-rm-path]` 既有做法）、Label、Progress（div 条）——全部走令牌类，禁硬编码色 | `components/ui/`（扩展 index.tsx 或分文件） |
| P1-3 | `:root` + 4 主题块补 shadcn 组件消费变量，**`--primary` 由各主题自派生**（light/beige/green = `--foreground`，dark 同理；`--primary-foreground` = 反色）；`--muted`/`--accent`/`--ring`/`--input`/`--popover`/`--destructive` 全部 color-mix 从现有令牌派生，零新增 hex | `styles.css` |
| P1-4 | 组件视觉对齐柔顺卡片风（radius 12px、`--shadow-card` 系、`--border` 描边） | `components/ui/` |

**用途映射**：Switch/Slider/Label → F18 主题编辑器（M5）；Dialog/Progress/Badge → 导入向导（M4a 现有，M5 回填）；Tooltip → 预览反查提示与设置说明。

### P2 主题派生与护栏自动化（依赖仅 culori）
| 编号 | 任务 | 产出 |
|------|------|------|
| P2-1 | 安装 `culori`（devDependencies） | `package.json` |
| P2-2 | `theme/derive.ts`：`deriveTokens(primary)` 在 OKLCH 下派生全套令牌，保证 foreground 对比度 ≥4.5:1 | `src/renderer/src/theme/derive.ts` |
| P2-3 | `theme/derive.test.ts`：护栏单测——4 主题现值 + 派生输出断言 WCAG AA 对比度（防绿字护栏自动化） | `*.test.ts` |

**边界**：P2 只落基础能力 + 测试，**不接线 UI**（自定义主题交互随 M5 F18）。

## 三、依赖与体积预算

| 工具 | 依赖位置 | 产物内 | 增量（gzip） |
|------|----------|--------|-------------|
| Tailwind `@theme` | devDependencies（已有） | 仅 CSS | ≤2KB |
| clsx + tailwind-merge | **devDependencies**（拍板③） | JS（树摇） | +3–6KB |
| culori | **devDependencies**（拍板③） | JS（树摇） | +2–3KB |
| @radix-ui / lucide / tw-animate-css / Motion | **不引入**（手抄 = 零 Radix，零动画库） | — | 0 |
| Style Dictionary | — | — | 暂缓（F18 令牌扩展后再议） |

**合计 ≤ +10KB gzip，占现有 1725KB 基线 <1%**；全程无网络、无遥测，隐私承诺不变。

## 四、验证与收口

1. `pnpm typecheck`（node+web）+ `pnpm lint --max-warnings 0` + `pnpm test`（含新增对比度单测）全绿；
2. `pnpm build` 体积对比实测（记录前后 out/renderer/assets 数值）；
3. 三文档同步：技术栈.md（§3.14/§3.15/§4.1/§4.2：令牌表扩展 + 依赖策略登记 + 组件清单）、功能.md（F18 基础能力）、实现情况.md（§一 + 偏差若需）；日志归口当日条目；
4. G.7 selfcheck（docs-tool 若 python 不可用则登记"待 python 环境"，沿 2026-08-09 先例）。

## 五、待后续里程碑接线（本方案不落地）
- F18 主题切换 UI（四主题 Select/Switch + 自定义主色 Slider）→ M5
- 自定义主题 electron-store 持久化 → M5（F18 扩展）
- 设置面板表单组件化回填 → M5
- 导入向导回填 Dialog/Progress → 可选 M5
