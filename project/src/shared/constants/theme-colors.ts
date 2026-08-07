/**
 * 推荐主题色板 —— 顶栏「主题色」预设（2026-08-07 UI 重构）
 * 用户需求：多数用户不擅长调色板，倾向直接选常用颜色；自定义调色板降级为高级选项。
 * 第一个为默认（classic 模板示例色 #475569，与 material/简历示例1.pdf 一致）。
 * labelKey 走 i18n（themeColor.preset.*），纯 UI 文案。
 */
export const THEME_COLOR_PRESETS: Array<{ value: string; labelKey: string }> = [
  { value: '#475569', labelKey: 'themeColor.preset.slate' },
  { value: '#1E293B', labelKey: 'themeColor.preset.ink' },
  { value: '#2563EB', labelKey: 'themeColor.preset.blue' },
  { value: '#0F766E', labelKey: 'themeColor.preset.teal' },
  { value: '#16A34A', labelKey: 'themeColor.preset.green' },
  { value: '#D97706', labelKey: 'themeColor.preset.amber' },
  { value: '#B91C1C', labelKey: 'themeColor.preset.red' },
  { value: '#7C3AED', labelKey: 'themeColor.preset.purple' },
  { value: '#DB2777', labelKey: 'themeColor.preset.pink' }
]
