/**
 * ComingSoon —— 占位子页（M3/M4/M5 规划中功能，统一占位 UI）
 */
import { useTranslation } from 'react-i18next'

export function ComingSoon({
  title,
  desc
}: {
  title: string
  desc?: string
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="home-view">
      <h2 className="home-title">{title}</h2>
      {desc ? <p className="home-subtitle">{desc}</p> : null}
      <div className="coming-soon-card">
        <span className="coming-soon-tag">{t('common.comingSoon')}</span>
      </div>
    </div>
  )
}