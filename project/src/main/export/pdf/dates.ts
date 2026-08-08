/**
 * pdf/dates.ts —— 简历日期格式化（YYYY 或 YYYY-MM → 展示）
 * 与渲染进程 primitives.fmtDate 语义一致（PDF 独立实现，避免跨进程依赖）。
 * P2 修复：YYYY-MM → YYYY/MM（原直接返回原始值，预览显示 2013/09 而 PDF 显示 2013-09）。
 */
export function fmtDate(date: string | undefined): string {
  if (!date) return ''
  const [y, m] = date.split('-')
  return m ? `${y}/${m}` : y
}
