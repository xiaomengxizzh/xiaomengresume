/**
 * AiHome —— AI 主功能首页（4 卡片：语法纠正/自我介绍/简历润色/匹配打分，M3 启用）
 * 点击进入对应分区视图（ai:grammar / ai:intro / ai:polish / ai:match）。
 */
import { useResumeStore } from '../store/useResumeStore'
import { HomeView, type HomeItem } from './HomeView'

export function AiHome(): React.JSX.Element {
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const items: HomeItem[] = [
    { key: 'grammar', titleKey: 'navSub.grammar', descKey: 'homeDesc.grammar', onClick: () => setCurrentView('ai:grammar') },
    { key: 'intro', titleKey: 'navSub.intro', descKey: 'homeDesc.intro', onClick: () => setCurrentView('ai:intro') },
    { key: 'polish', titleKey: 'navSub.polish', descKey: 'homeDesc.polish', onClick: () => setCurrentView('ai:polish') },
    { key: 'match', titleKey: 'navSub.match', descKey: 'homeDesc.match', onClick: () => setCurrentView('ai:match') }
  ]
  return <HomeView items={items} />
}
