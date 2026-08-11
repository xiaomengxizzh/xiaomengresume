/**
 * ui-config —— UI 配置体系（设计阶段产物，不进最终打包）
 *
 * 文件路由：本目录按维度分文件，生成器逐文件消费产出 CSS 变量。
 *   layout.ts —— 尺寸与布局（已落地）
 *   type.ts   —— 排版（预留空位，M5 并入）
 *   color.ts  —— 色板（预留空位，M5 并入）
 *
 * 变更流程：改配置 → `node scripts/gen_ui_config.mjs` → 重新 build。
 * 组件/样式消费 `var(--ui-*)`；词汇表见 README.md。
 */
export { uiLayout } from './layout'
export { uiType } from './type'
export { uiColor } from './color'
