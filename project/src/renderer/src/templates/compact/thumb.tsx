/**
 * CompactThumb —— compact 模板 CSS 缩略图（F4）
 * 行距收紧、节标题小号加粗、一页内承载更多条目（更密的色块排布）。
 */
export function CompactThumb(): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" role="img" aria-label="compact">
      <rect width="120" height="160" fill="#fff" rx="2" />
      <rect x="10" y="10" width="56" height="5" fill="var(--thumb-accent, #475569)" rx="1" />
      <rect x="10" y="18" width="60" height="2" fill="#d0d0d0" rx="1" />
      {/* compact：小号标题 + 高密度条目 */}
      <rect x="10" y="24" width="28" height="3" fill="#333" rx="1" />
      <rect x="10" y="29" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="33" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="37" width="64" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="44" width="28" height="3" fill="#333" rx="1" />
      <rect x="10" y="49" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="53" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="57" width="72" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="64" width="28" height="3" fill="#333" rx="1" />
      <rect x="10" y="69" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="73" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="77" width="56" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="84" width="28" height="3" fill="#333" rx="1" />
      <rect x="10" y="89" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="93" width="80" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="100" width="28" height="3" fill="#333" rx="1" />
      <rect x="10" y="105" width="100" height="2.5" fill="#f2f2f2" rx="1" />
      <rect x="10" y="109" width="68" height="2.5" fill="#f2f2f2" rx="1" />
    </svg>
  )
}
