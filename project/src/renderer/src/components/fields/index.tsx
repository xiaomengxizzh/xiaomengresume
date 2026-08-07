/**
 * 字段控件层（§3.3）—— 受控薄包装：value + onCommit（提交级，store 侧进 F3 历史栈）
 * 实时预览：EditorPane 每按键调用 onCommit → store.setField（历史栈 500ms 防抖合并）。
 */
import { Input, Textarea, Select } from '../ui'

export interface FieldOption {
  value: string
  label: string
}

export function TextField({
  value,
  onCommit,
  placeholder
}: {
  value: string | undefined
  onCommit: (v: string) => void
  placeholder?: string
}): React.JSX.Element {
  return <Input value={value ?? ''} placeholder={placeholder} onChange={(e) => onCommit(e.target.value)} />
}

/** 日期字段：原生 month 选择器（YYYY-MM），空值 = '' */
export function DateField({
  value,
  onCommit
}: {
  value: string | undefined
  onCommit: (v: string) => void
}): React.JSX.Element {
  return (
    <Input
      type="month"
      value={value ?? ''}
      onChange={(e) => onCommit(e.target.value)}
    />
  )
}

export function SelectField({
  value,
  options,
  onCommit,
  emptyLabel
}: {
  value: string | undefined
  options: FieldOption[]
  onCommit: (v: string) => void
  emptyLabel?: string
}): React.JSX.Element {
  return (
    <Select value={value ?? ''} onChange={(e) => onCommit(e.target.value)}>
      {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  )
}

export function TextareaField({
  value,
  onCommit,
  placeholder,
  rows = 3
}: {
  value: string | undefined
  onCommit: (v: string) => void
  placeholder?: string
  rows?: number
}): React.JSX.Element {
  return (
    <Textarea
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onCommit(e.target.value)}
    />
  )
}
