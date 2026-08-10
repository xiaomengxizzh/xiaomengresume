/**
 * SettingsHome —— 设置主功能首页（外观/AI 设置/存储位置）
 * 2026-08-09：与简历主功能区统一——卡片网格 + 图标；AI 设置可点（settings-ai），外观/存储保留占位。
 */
import { useResumeStore } from '../store/useResumeStore'
import { HomeView, type HomeItem } from './HomeView'

/** 设置项线框图标（内联 SVG，对齐 AiIcon/HomeView 图标风格） */
function SettingsIcon({ kind }: { kind: 'palette' | 'gear' | 'folder' }): React.JSX.Element {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (kind === 'palette') {
    return (
      <svg {...p}>
        <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-.9 2-1.8 0-.6-.3-1-.7-1.4-.4-.4-.7-.8-.7-1.4 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.6-9-6.6z" />
        <circle cx="7.5" cy="11" r="1" fill="currentColor" stroke="none" />
        <circle cx="10.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (kind === 'gear') {
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
      </svg>
    )
  }
  return (
    <svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 13h18" />
    </svg>
  )
}

export function SettingsHome(): React.JSX.Element {
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const items: HomeItem[] = [
    { key: 'appearance', titleKey: 'navSub.appearance', descKey: 'homeDesc.appearance', icon: <SettingsIcon kind="palette" />, disabled: true },
    { key: 'aiSettings', titleKey: 'navSub.aiSettings', descKey: 'homeDesc.aiSettings', icon: <SettingsIcon kind="gear" />, onClick: () => setCurrentView('settings-ai') },
    { key: 'storage', titleKey: 'navSub.storage', descKey: 'homeDesc.storage', icon: <SettingsIcon kind="folder" />, disabled: true }
  ]
  return <HomeView items={items} grid />
}
