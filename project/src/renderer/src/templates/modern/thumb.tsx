/**
 * ModernThumb —— modern 模板 CSS 缩略图（F4）
 * 左对齐节标题带左侧 accent 色条（--thumb-accent），留白更大。
 */
export function ModernThumb(): React.JSX.Element {
  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" role="img" aria-label="modern">
      <rect width="120" height="160" fill="#fff" rx="2" />
      <rect x="14" y="12" width="50" height="6" fill="var(--thumb-accent, #475569)" rx="1" />
      <rect x="14" y="24" width="60" height="3" fill="#d0d0d0" rx="1" />
      {/* modern：accent 色条 + 左对齐标题 */}
      <rect x="14" y="34" width="3" height="8" fill="var(--thumb-accent, #475569)" rx="1" />
      <rect x="20" y="35" width="34" height="4" fill="#444" rx="1" />
      <rect x="14" y="46" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="14" y="52" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="14" y="64" width="3" height="8" fill="var(--thumb-accent, #475569)" rx="1" />
      <rect x="20" y="65" width="34" height="4" fill="#444" rx="1" />
      <rect x="14" y="76" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="14" y="82" width="70" height="3" fill="#f0f0f0" rx="1" />
      <rect x="14" y="94" width="3" height="8" fill="var(--thumb-accent, #475569)" rx="1" />
      <rect x="20" y="95" width="34" height="4" fill="#444" rx="1" />
      <rect x="14" y="106" width="100" height="3" fill="#f0f0f0" rx="1" />
      <rect x="14" y="112" width="80" height="3" fill="#f0f0f0" rx="1" />
    </svg>
  )
}
