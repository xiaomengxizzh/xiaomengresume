/**
 * ResumesHome —— 简历主功能首页（2026-08-09 T8 四大入口：新建简历 / 打开简历 / 简历管理 / 岗位管理）
 * 2026-08-09 T5：移除顶部欢迎面板（独立 WelcomeView 已承担欢迎；本页仅功能卡片网格）。
 */
import { useResumeStore } from '../store/useResumeStore'
import { HomeView, type HomeItem } from './HomeView'

/** 四大入口线框图标（内联 SVG，对齐 ImportHome/HomeView 风格） */
function CardIcon({ kind }: { kind: 'new' | 'folder' | 'list' | 'jobs' }): React.JSX.Element {
  const p = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (kind) {
    case 'new':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...p}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      )
    case 'list':
      return (
        <svg {...p}>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth="2.2" />
        </svg>
      )
    case 'jobs':
      return (
        <svg {...p}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      )
  }
}

export function ResumesHome(): React.JSX.Element {
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  const items: HomeItem[] = [
    { key: 'newResume', titleKey: 'navSub.newResume', descKey: 'homeDesc.newResume', icon: <CardIcon kind="new" />, onClick: () => setCurrentView('resumes-new') },
    { key: 'openResume', titleKey: 'navSub.openResume', descKey: 'homeDesc.openResume', icon: <CardIcon kind="folder" />, onClick: () => setCurrentView('resumes-recent') },
    { key: 'manage', titleKey: 'navSub.manage', descKey: 'homeDesc.manage', icon: <CardIcon kind="list" />, onClick: () => setCurrentView('resumes-manage') },
    { key: 'jobs', titleKey: 'navSub.jobs', descKey: 'homeDesc.jobs', icon: <CardIcon kind="jobs" />, onClick: () => setCurrentView('jobs-manage') }
  ]
  return <HomeView items={items} grid />
}
