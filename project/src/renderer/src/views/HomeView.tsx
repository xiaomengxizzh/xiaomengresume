/**
 * HomeView —— 主功能首页（2026-08-07 导航中枢雏形）
 * 定案"右内容 N 固定卡片"参数：宽 ≈ 右侧 90% 右缩 / 高 56 / 间距 14 / 圆角 12 / 字号 17 / 文字左距 24 /
 * 纯文字 / 无描边 + 投影 0 6px 24px / hover 上浮 -3px 变暗 / active 下沉；第一卡与左导航首菜单项顶部拉齐线。
 * 支持 onClick 与 disabled（占位子项）。
 */
import { useTranslation } from 'react-i18next'

export interface HomeItem {
  key: string
  titleKey: string // i18n key（标题）
  descKey?: string // i18n key（副标题，可选）
  onClick?: () => void
  disabled?: boolean // 占位未实现
}

export function HomeView({ items }: { items: HomeItem[] }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="home-view">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`home-card ${it.disabled ? 'disabled' : ''}`}
          disabled={it.disabled}
          onClick={it.onClick}
        >
          <span className="home-card-title">{t(it.titleKey)}</span>
          {it.descKey ? <span className="home-card-desc">{t(it.descKey)}</span> : null}
        </button>
      ))}
    </div>
  )
}