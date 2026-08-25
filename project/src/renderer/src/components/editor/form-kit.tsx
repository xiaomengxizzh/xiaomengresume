/**
 * form-kit —— 编辑器表单共享小件（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 * useField：受控字段 hook（读 store + 提交级写入）；FieldRow：标签行容器；getString：安全取串。
 */
import type { ReactNode } from 'react'
import { useResumeStore } from '../../store/useResumeStore'
import { getByPath } from '@shared/paths'

export function useField(path: string): [unknown, (v: unknown) => void] {
  const value = useResumeStore((s) => getByPath(s.resume, path))
  const setField = useResumeStore((s) => s.setField)
  return [value, (v: unknown) => setField(path, v)]
}

export function FieldRow({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-xs font-medium text-foreground/70">{label}</div>
      {children}
    </div>
  )
}

export function getString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
