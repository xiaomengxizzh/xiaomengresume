/**
 * templates/shared/primitives.tsx —— 模板共享渲染基元（F4 三套模板共用）
 * 从 ClassicTemplate 抽取：SectionBlock / SecTitle / Placeholder / entryHead / fmtDate / jump。
 * 2026-08-08 D11：store 驱动（无 props）；jump 反查经 useResumeStore。
 */
import type { CSSProperties, ReactNode } from 'react'
import { useResumeStore } from '../../store/useResumeStore'

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
  return (
    <section
      data-rm-path={path}
      data-rm-hint={hint}
      onClick={onClick}
      style={{
        marginBottom: 'var(--rm-section-gap, 16px)',
        paddingBottom: 'var(--rm-section-gap, 16px)',
        borderBottom: '1px solid #e8e8e8',
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

export function entryHead(left: string, right: string, style: CSSProperties): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', ...style }}>
      <span>{left}</span>
      <span style={{ opacity: 0.65, fontWeight: 400, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

export function fmtDate(d: string | undefined): string {
  if (!d) return ''
  const [y, m] = d.split('-')
  return m ? `${y}/${m}` : y
}
