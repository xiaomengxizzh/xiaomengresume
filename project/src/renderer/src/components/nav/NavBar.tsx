/**
 * NavBar —— 左侧导航 v3（2026-08-07 · 按 material/UI示例_参考图.html 定案）
 * 参考图参数：160px 白悬浮卡（左圆角 16 右直 + 右投影）/ 品牌 16px/600 居中下距 48px /
 * 主项 = SVG 线框图标 24px + 文字 17px/500（hover 变暗上浮 -2px / active 更深下沉）/ 间距 28px。
 * 用户需求：主功能纯文字带 ▾ 箭头，子功能展开时在导航栏内竖排且字号与主功能区分（15px vs 17px）；
 * 完全收起 = 宽 0（浮出按钮）；默认子功能折叠。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'

type MainKey = 'resume' | 'ai' | 'settings'

interface SubItem {
  key: string
  titleKey: string
  view: string
  disabled?: boolean
}

const SUBS: Record<MainKey, SubItem[]> = {
  // 2026-08-09 T8 四大入口：新建简历（二级选择）/ 打开简历 / 简历管理 / 岗位管理
  resume: [
    { key: 'newResume', titleKey: 'navSub.newResume', view: 'resumes-new' },
    { key: 'openResume', titleKey: 'navSub.openResume', view: 'resumes-recent' },
    { key: 'manage', titleKey: 'navSub.manage', view: 'resumes-manage' },
    { key: 'jobs', titleKey: 'navSub.jobs', view: 'jobs-manage' }
  ],
  ai: [
    { key: 'grammar', titleKey: 'navSub.grammar', view: 'ai:grammar' },
    { key: 'intro', titleKey: 'navSub.intro', view: 'ai:intro' },
    { key: 'polish', titleKey: 'navSub.polish', view: 'ai:polish' },
    { key: 'match', titleKey: 'navSub.match', view: 'ai:match' }
  ],
  settings: [
    { key: 'appearance', titleKey: 'navSub.appearance', view: 'coming:appearance', disabled: true },
    { key: 'aiSettings', titleKey: 'navSub.aiSettings', view: 'settings-ai' },
    { key: 'storage', titleKey: 'navSub.storage', view: 'coming:storage', disabled: true }
  ]
}

const MAIN_ORDER: MainKey[] = ['resume', 'ai', 'settings']

/** 参考图 SVG 线框图标（24×24 stroke 1.5：文档 / 星星 / 齿轮） */
function MainIcon({ k }: { k: MainKey }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24">
      {k === 'resume' ? (
        <>
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8" />
          <path d="M8 12h6" />
          <path d="M8 16h4" />
        </>
      ) : k === 'ai' ? (
        <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
      ) : (
        <>
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </>
      )}
    </svg>
  )
}

function SubList({ k, currentView, setCurrentView, open }: { k: MainKey; currentView: string; setCurrentView: (v: string) => void; open: boolean }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className={`nav-sub-list ${open ? 'open' : ''}`}>
      {SUBS[k].map((s) => (
        <button
          key={s.key}
          type="button"
          className={`nav-sub ${s.disabled ? 'disabled' : ''} ${!s.disabled && currentView === s.view ? 'active' : ''}`}
          disabled={s.disabled}
          title={s.disabled ? undefined : t(s.titleKey)}
          onClick={() => {
            if (!s.disabled) setCurrentView(s.view)
          }}
        >
          {t(s.titleKey)}
        </button>
      ))}
    </div>
  )
}

export function NavBar(): React.JSX.Element {
  const { t } = useTranslation()
  const collapsed = useResumeStore((s) => s.sidebarCollapsed)
  const currentView = useResumeStore((s) => s.currentView)
  const toggleSidebar = useResumeStore((s) => s.toggleSidebar)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const [openMain, setOpenMain] = useState<MainKey | null>(null)

  if (collapsed) {
    return (
      <button type="button" className="nav-edge-toggle" title={t('nav.expand')} onClick={toggleSidebar}>
        »
      </button>
    )
  }

  const isCurrentMain = (k: MainKey): boolean => {
    if (currentView === `${k}-home`) return true
    if (k === 'resume' && currentView === 'editor') return true
    if (currentView.startsWith('coming:')) {
      // coming:xxx 归属 = 该子项所属主项
      return SUBS[k].some((s) => s.view === currentView)
    }
    return SUBS[k].some((s) => s.view === currentView)
  }

  const renderItem = (k: MainKey): React.JSX.Element => {
    const open = openMain === k
    const active = isCurrentMain(k)
    return (
      <div key={k} className="nav-main-group">
        <div className={`nav-main-row ${active ? 'active' : ''}`}>
          <button type="button" className="nav-main-text" onClick={() => setCurrentView(`${k}-home`)}>
            <span className="nav-icon">
              <MainIcon k={k} />
            </span>
            <span className="nav-label">{t(`navMain.${k}`)}</span>
          </button>
          <button
            type="button"
            className="nav-main-toggle"
            title={open ? t('nav.collapse') : t('nav.expand')}
            onClick={() => setOpenMain(open ? null : k)}
          >
            {open ? '▴' : '▾'}
          </button>
        </div>
        <SubList k={k} currentView={currentView} setCurrentView={setCurrentView} open={open} />
      </div>
    )
  }

  return (
    <nav className="navbar-v2">
      <div className="nav-brand">
        <img src="./icon.png" alt="" className="nav-brand-icon" draggable={false} />
        {t('nav.brand')}
      </div>
      <div className="nav-list">{MAIN_ORDER.map(renderItem)}</div>
      <div className="nav-spacer" />
      <button type="button" className="nav-collapse-btn" title={t('nav.collapse')} onClick={toggleSidebar}>
        «
      </button>
    </nav>
  )
}
