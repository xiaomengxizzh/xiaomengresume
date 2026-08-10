/**
 * AiHome —— AI 主功能首页（4 卡片：语法纠正/自我介绍/简历润色/匹配打分）
 * 2026-08-09：与简历主功能区统一——双列网格四格卡片 + 图标；点击进入对应分区视图。
 */
import { useResumeStore } from '../store/useResumeStore'
import { AiIcon } from '../components/ai/AiScreenLayout'
import { HomeView, type HomeItem } from './HomeView'

export function AiHome(): React.JSX.Element {
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const items: HomeItem[] = [
    { key: 'grammar', titleKey: 'navSub.grammar', descKey: 'homeDesc.grammar', icon: <AiIcon k="grammar" />, onClick: () => setCurrentView('ai:grammar') },
    { key: 'intro', titleKey: 'navSub.intro', descKey: 'homeDesc.intro', icon: <AiIcon k="intro" />, onClick: () => setCurrentView('ai:intro') },
    { key: 'polish', titleKey: 'navSub.polish', descKey: 'homeDesc.polish', icon: <AiIcon k="polish" />, onClick: () => setCurrentView('ai:polish') },
    { key: 'match', titleKey: 'navSub.match', descKey: 'homeDesc.match', icon: <AiIcon k="match" />, onClick: () => setCurrentView('ai:match') }
  ]
  return <HomeView items={items} grid />
}
