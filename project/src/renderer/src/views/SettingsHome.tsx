/**
 * SettingsHome —— 设置主功能首页（3 卡片：外观/AI 设置/存储位置）
 * S 批定义的设置三屏（M5 落地，UI 全部占位）。
 */
import { HomeView, type HomeItem } from './HomeView'

export function SettingsHome(): React.JSX.Element {
  const items: HomeItem[] = [
    { key: 'appearance', titleKey: 'navSub.appearance', descKey: 'homeDesc.appearance', disabled: true },
    { key: 'aiSettings', titleKey: 'navSub.aiSettings', descKey: 'homeDesc.aiSettings', disabled: true },
    { key: 'storage', titleKey: 'navSub.storage', descKey: 'homeDesc.storage', disabled: true }
  ]
  return <HomeView items={items} />
}