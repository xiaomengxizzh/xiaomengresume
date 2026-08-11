/**
 * ui-config/type.ts —— 排版配置（预留空位，随 M5 外观设置/自定义主题并入）
 *
 * 设计阶段产物，不进最终打包；生成器读本文件产出 CSS 变量。
 * 当前排版（字号 5 档/行高/字体）已在 shared/templates/layout.ts（模板排版单一事实源）
 * 与 styles.css @theme（应用 UI 字号 token --text-*/--space-*），此处预留统一入口。
 */
export const uiType = {
  // TODO(M5)：fontScale: { xs: 12, sm: 13, base: 15, lg: 17, xl: 22 },
  // TODO(M5)：lineHeight / fontFamily（O8 中文约束：最小档 ≥12px、行高 ≥1.5）
} as const
