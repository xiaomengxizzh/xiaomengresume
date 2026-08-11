/**
 * ui-config/layout.ts —— UI 尺寸与布局配置（设计阶段产物，不进最终打包）
 *
 * 用法：改这里 → 跑 `node scripts/gen_ui_config.mjs` → 重新 build。
 * 生成器产出 `project/src/renderer/src/ui-config.generated.css`（:root CSS 变量），
 * 组件/样式经 `var(--ui-*)` 消费；本文件不被 renderer import。
 *
 * 词汇表（用户口语 ↔ 配置键）：
 *  - 「卡片长度/宽度」→ listMaxWidth（列表容器最大宽度）
 *  - 「卡片间距」     → listGap（列表卡片之间垂直间距）
 *  - 「卡片内部留白」 → cardPaddingX / cardPaddingY
 *  - 「模块卡间距」   → moduleGridGap（编辑区模块卡网格）
 */
export const uiLayout = {
  /** 列表容器最大宽度（px）。简历/岗位目录统一 860 居中（对齐 .home-view）。0 = 通栏 */
  listMaxWidth: 860,
  /** 列表卡片之间垂直间距（px） */
  listGap: 8,
  /** 卡片水平内边距（px） */
  cardPaddingX: 20,
  /** 卡片垂直内边距（px） */
  cardPaddingY: 14,
  /** 编辑区模块卡网格间距（px） */
  moduleGridGap: 14,
} as const
