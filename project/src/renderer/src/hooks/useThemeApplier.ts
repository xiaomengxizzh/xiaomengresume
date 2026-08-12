/**
 * useThemeApplier —— M5-4 外观应用（D1 4 色 + 跟随系统 + 300ms 实时预览；D2 自定义主题派生）
 * 首帧由主进程 --xm-theme 注入（preload），运行时由本 hook 接管：
 *  - data-theme = appearance（4 色）；dark + 跟随系统时按 prefers-color-scheme 切 light/dark
 *  - D2：customTheme.primary → deriveTokens(primary) 派生全套令牌 → 内联覆盖 6 基础变量
 *    （内联 style 优先级最高，覆盖 [data-theme] 块；清空自定义时移除）
 *  - 300ms 防抖（D1 定案：切换节奏，配合 CSS transition）
 */
import { useEffect } from 'react'
import { useResumeStore } from '../store/useResumeStore'
import { deriveTokens } from '../theme/derive'

const BASE_VARS = ['--background', '--card', '--sidebar', '--foreground', '--selected', '--border'] as const

export function useThemeApplier(): void {
  const appearance = useResumeStore((s) => s.settings.appearance)
  const appearanceMode = useResumeStore((s) => s.settings.appearanceMode)
  const customPrimary = useResumeStore((s) => s.settings.customTheme?.primary)
  const uiFont = useResumeStore((s) => s.settings.uiFont)

  // M5-4 D5：界面字体 --ui-font（默认/系统 → 移除；选择字体 → 应用）
  useEffect(() => {
    const root = document.documentElement
    if (uiFont && uiFont !== 'system') {
      root.style.setProperty('--ui-font', `'${uiFont}', 'system-ui', 'PingFang SC', 'Microsoft YaHei', sans-serif`)
    } else {
      root.style.removeProperty('--ui-font')
    }
  }, [uiFont])

  // 外观变更 → 300ms 防抖应用（4 色 + 跟随系统 + 自定义派生变量）
  useEffect(() => {
    const apply = (): void => {
      const root = document.documentElement
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const theme =
        appearanceMode === 'system' && appearance === 'dark' ? (sysDark ? 'dark' : 'light') : appearance
      root.setAttribute('data-theme', theme)
      // D2：自定义主题派生覆盖（无 primary 时移除恢复 4 色令牌）
      if (customPrimary) {
        const t = deriveTokens(customPrimary)
        root.style.setProperty('--background', t.background)
        root.style.setProperty('--card', t.card)
        root.style.setProperty('--sidebar', t.sidebar)
        root.style.setProperty('--foreground', t.foreground)
        root.style.setProperty('--selected', t.selected)
        root.style.setProperty('--border', t.border)
      } else {
        for (const v of BASE_VARS) root.style.removeProperty(v)
      }
    }
    const timer = setTimeout(apply, 300)
    return () => clearTimeout(timer)
  }, [appearance, appearanceMode, customPrimary])

  // 跟随系统：dark+system 时系统深浅切换即时生效（不防抖）
  useEffect(() => {
    if (!(appearanceMode === 'system' && appearance === 'dark')) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [appearanceMode, appearance])
}
