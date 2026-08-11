/**
 * ui-config/color.ts —— 色板配置（预留空位，随 M5 自定义主题并入）
 *
 * 设计阶段产物，不进最终打包。当前 4 主题色板权威令牌在 styles.css
 * （:root + [data-theme] 各主题块，6 令牌 + 派生），防绿字护栏由 culori 断言守护，
 * 此处预留统一入口（将来用户自定义主题经此消费）。
 */
export const uiColor = {
  // TODO(M5)：themes: { light/dark/beige/green: { background/card/sidebar/foreground/border/selected/brand } },
} as const
