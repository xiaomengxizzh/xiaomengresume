/**
 * pdf/dates.ts —— 简历日期格式化（YYYY 或 YYYY-MM → 展示）
 * 与渲染进程 primitives.fmtDate 语义一致（PDF 独立实现，避免跨进程依赖）。
 */
export function fmtDate(date: string | undefined): string {
  if (!date) return ''
  return date // 已是 YYYY 或 YYYY-MM，直接展示
}
