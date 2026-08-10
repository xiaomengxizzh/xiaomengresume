/**
 * AiScreenLayout —— AI 主功能四子功能区共享外壳（UI 美化 T4；2026-08-09 扩展）
 * 统一：AiContextBar + 标题栏（返回按钮 + 图标 + 标题 + 右操作区）+ 内容容器（居中 max-w 自适应窗口）。
 * 四区（语法纠正/自我介绍/简历润色/匹配打分）复用，风格一致、易扩展。
 * 全走令牌（bg-surface/border-border/text-foreground），禁硬编码颜色。
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { AiContextBar } from './AiContextBar'

export type AiIcon = 'grammar' | 'intro' | 'polish' | 'match'

/** 四区线框图标（内联 SVG，stroke 1.8，对齐 nav 图标风格；导出供 AiHome 复用） */
export function AiIcon({ k, size = 18 }: { k: AiIcon; size?: number }): React.JSX.Element {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (k) {
    case 'grammar':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      )
    case 'intro':
      return (
        <svg {...p}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      )
    case 'polish':
      return (
        <svg {...p}>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />
        </svg>
      )
    case 'match':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}

interface AiScreenLayoutProps {
  icon: AiIcon
  title: string
  /** 标题栏右侧操作区（主按钮等） */
  actions?: ReactNode
  /** 返回上一级目标视图（如 'ai-home'）；提供则标题栏左侧显示返回按钮 */
  backTo?: string
  children: ReactNode
}

export function AiScreenLayout({ icon, title, actions, backTo, children }: AiScreenLayoutProps): React.JSX.Element {
  const { t } = useTranslation()
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  return (
    <div className="flex h-full flex-col">
      <AiContextBar />
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5">
        {backTo ? (
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
            onClick={() => setCurrentView(backTo)}
          >
            ← {t('common.back')}
          </button>
        ) : null}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-selected/60 text-foreground">
          <AiIcon k={icon} />
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </div>
      {/* 2026-08-09：内容容器居中 + max-w 自适应（小窗口自动收窄，宽窗口不拉伸卡片） */}
      <div className="mx-auto w-full max-w-[680px] flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  )
}
