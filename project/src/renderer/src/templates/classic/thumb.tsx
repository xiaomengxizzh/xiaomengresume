/**
 * ClassicThumb —— classic 模板 CSS 缩略图（F4：CSS 缩略图，零依赖）
 * 迷你版式：姓名行 + 居中横线分隔 + 全大写节标题 + 条目块。
 * 随 themeColor 动态着色（--thumb-accent）。
 */
export function ClassicThumb(): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" role="img" aria-label="classic">
      <rect width="120" height="160" fill="#fff" rx="2" />
      <rect x="10" y="12" width="60" height="6" fill="var(--thumb-accent, #475569)" rx="1" />
      <rect x="10" y="22" width="100" height="2" fill="#e8e8e8" />
      <rect x="10" y="32" width="40" height="4" fill="#444" rx="1" />
      <rect x="10" y="38" width="100" height="1" fill="#e8e8e8" />
      <rect x="10" y="43" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="10" y="49" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="10" y="58" width="40" height="4" fill="#444" rx="1" />
      <rect x="10" y="64" width="100" height="1" fill="#e8e8e8" />
      <rect x="10" y="69" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="10" y="75" width="70" height="3" fill="#f0f0f0" rx="1" />
      <rect x="10" y="84" width="40" height="4" fill="#444" rx="1" />
      <rect x="10" y="90" width="100" height="1" fill="#e8e8e8" />
      <rect x="10" y="95" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="10" y="101" width="80" height="3" fill="#f0f0f0" rx="1" />
    </svg>
  )
}
