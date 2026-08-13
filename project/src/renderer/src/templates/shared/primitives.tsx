/**
 * templates/shared/primitives.tsx —— 模板共享渲染基元（F4 三套模板共用）
 * 2026-08-10 架构收敛批：fmtDate / 区块间距逻辑收敛至 shared/templates/layout.ts（单一事实源）。
 */
import type { CSSProperties, ReactNode } from 'react'
import { useResumeStore } from '../../store/useResumeStore'
import { fmtDate, sectionSpacingLogic } from '@shared/templates/layout'

/** 预览反查：点击模板 section → 左栏定位（F2 M2 字段级由 EditorPane 滚动承接） */
export function useJump(): (path: string) => void {
  const { setActiveSection, setActiveFieldPath } = useResumeStore.getState()
  return (path: string): void => {
    setActiveSection(path.split('.')[0])
    setActiveFieldPath(path)
  }
}

export function SectionBlock({
  path,
  onClick,
  style,
  hint,
  children
}: {
  path: string
  onClick: () => void
  style?: CSSProperties
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  // 2026-08-10：间距语义 = gap(margin, CSS var 由 ResumeBody root 注入) + 6px(padding) + 1px 灰线
  // （padding/line 取 shared sectionSpacingLogic 常量，与 PDF 端同源——消除"模块末尾留白过大"与两端不一致）
  const sp = sectionSpacingLogic(16)
  return (
    <section
      data-rm-path={path}
      data-rm-hint={hint}
      onClick={onClick}
      style={{
        marginBottom: 'var(--rm-section-gap, 16px)',
        paddingBottom: `${sp.padding}px`,
        borderBottom: `${sp.line}px solid #e8e8e8`,
        ...style
      }}
    >
      {children}
    </section>
  )
}

export function Placeholder({ label }: { label: string }): React.JSX.Element {
  return <div style={{ color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>{label}</div>
}

export function entryHead(left: string, right: string, style: CSSProperties, mark?: string): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', ...style }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
        {mark ? (
          <span aria-hidden style={{ fontSize: '0.85em', opacity: 0.7, flexShrink: 0 }}>
            {mark}
          </span>
        ) : null}
        <span>{left}</span>
      </span>
      <span style={{ opacity: 0.65, fontWeight: 400, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

export { fmtDate }
