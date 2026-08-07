/**
 * AiHome —— AI 主功能首页（4 卡片：语法纠正/自我介绍/简历润色/匹配打分）
 * R 批定义的 AI 四分区，全部占位（M3 落地）。
 */
import { HomeView, type HomeItem } from './HomeView'

export function AiHome(): React.JSX.Element {
  const items: HomeItem[] = [
    { key: 'grammar', titleKey: 'navSub.grammar', descKey: 'homeDesc.grammar', disabled: true },
    { key: 'intro', titleKey: 'navSub.intro', descKey: 'homeDesc.intro', disabled: true },
    { key: 'polish', titleKey: 'navSub.polish', descKey: 'homeDesc.polish', disabled: true },
    { key: 'match', titleKey: 'navSub.match', descKey: 'homeDesc.match', disabled: true }
  ]
  return <HomeView items={items} />
}