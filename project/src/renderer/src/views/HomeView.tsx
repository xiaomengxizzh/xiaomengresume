/**
 * HomeView —— 主功能首页（2026-08-07 导航中枢雏形；2026-08-09 C1 扩展 grid + icon）
 * 定案"右内容 N 固定卡片"参数：宽 ≈ 右侧 90% 右缩 / 高 56 / 间距 14 / 圆角 12 / 字号 17 / 文字左距 24 /
 * 纯文字 / 无描边 + 投影 0 6px 24px / hover 上浮 -3px 变暗 / active 下沉；第一卡与左导航首菜单项顶部拉齐线。
 * 2026-08-09 C1（调整定案）：ResumesHome 启用双列网格（grid prop）+ 卡片图标（icon）+ 全宽卡（full）；
 * AiHome/SettingsHome 保持竖排（grid 缺省 false）。
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface HomeItem {
  key: string
  titleKey: string // i18n key（标题）
  descKey?: string // i18n key（副标题，可选）
  icon?: ReactNode // 卡片左侧图标（C1：内联 SVG，对齐 ImportHome 风格）
  full?: boolean // 网格中占整行（C1：如末尾的次要/禁用入口）
  onClick?: () => void
  disabled?: boolean // 占位未实现
}

export function HomeView({ items, grid = false }: { items: HomeItem[]; grid?: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className={grid ? 'home-view home-grid' : 'home-view'}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`home-card ${it.disabled ? 'disabled' : ''} ${it.full ? 'home-card-full' : ''}`}
          disabled={it.disabled}
          onClick={it.onClick}
        >
          <span className="home-card-title">
            {it.icon ? <span className="mr-2 inline-flex shrink-0 text-foreground/60">{it.icon}</span> : null}
            {t(it.titleKey)}
          </span>
          {it.descKey ? <span className="home-card-desc">{t(it.descKey)}</span> : null}
        </button>
      ))}
    </div>
  )
}
