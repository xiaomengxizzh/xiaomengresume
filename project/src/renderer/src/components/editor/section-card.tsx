/**
 * section-card —— 编辑器模块卡/条目卡（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 * SectionCard：section 容器（字体选择 + AI 润色/语法 + 添加按钮）；EntryCard：条目卡（显隐/复制/删除 + 拖拽/批量插槽）。
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import { Button, Select } from '../ui'

/** 单元级字体选择（2026-08-07 UI 重构：字体可整体调（顶栏），也可在各单元单独选） */
function SectionFontSelect({ section }: { section: string }): React.JSX.Element {
  const { t } = useTranslation()
  const layout = useResumeStore((s) => s.resume.layout)
  const setField = useResumeStore((s) => s.setField)
  const value = layout?.sectionFonts?.[section] ?? ''

  return (
    <label className="flex items-center gap-1 text-xs text-foreground/70">
      <span>{t('editor.fontLabel')}</span>
      <Select
        className="!w-auto !py-0.5 text-xs"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          const next = { ...(layout?.sectionFonts ?? {}) }
          if (v === '') delete next[section]
          else next[section] = v
          setField('layout.sectionFonts', next)
        }}
      >
        <option value="">{t('editor.font.system')}</option>
        {FONT_OPTIONS.map((f) => (
          <option key={f.id} value={f.id}>
            {t(f.labelKey)}
          </option>
        ))}
      </Select>
    </label>
  )
}

export function SectionCard({
  title,
  section,
  onAdd,
  addLabel,
  onPolish,
  onGrammar,
  children
}: {
  title: string
  section?: string
  onAdd?: () => void
  addLabel?: string
  /** M3 F7：AI 润色入口（仅白名单 section 提供） */
  onPolish?: () => void
  /** M3 F8：语法检查入口（仅白名单 section 提供） */
  onGrammar?: () => void
  children: ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    // M5-7 D10 axe landmark：无名 section 不算 landmark（region 规则）→ 改 div 承载模块卡
    <div className="section-card">
      <div className="section-card-header">
        <h3 className="text-[15px] font-medium">{title}</h3>
        <div className="section-toolbar">
          {section ? <SectionFontSelect section={section} /> : null}
          {onPolish ? (
            <Button size="sm" variant="ghost" onClick={onPolish}>
              ✨ {t('editor.aiAssist')}
            </Button>
          ) : null}
          {onGrammar ? (
            <Button size="sm" variant="ghost" onClick={onGrammar}>
              {t('editor.grammarCheck')}
            </Button>
          ) : null}
          {onAdd ? (
            <Button size="sm" variant="outline" onClick={onAdd}>
              ＋ {addLabel}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="section-card-body">{children}</div>
    </div>
  )
}

export function EntryCard({
  title,
  visible,
  onToggleVisible,
  onDuplicate,
  onRemove,
  showLabel,
  hideLabel,
  showVisibility = true,
  dragHandle,
  selectCheckbox,
  onDragOverCard,
  onDropCard,
  children
}: {
  title: string
  visible: boolean | undefined
  onToggleVisible: () => void
  onDuplicate: () => void
  onRemove: () => void
  showLabel: string
  hideLabel: string
  /** 仅 education/work/projects 有 visible 字段（F1 2026-08-07 增补），其余 section 不显示开关 */
  showVisibility?: boolean
  /** P0-1：条目拖拽手柄（渲染在头部最左；拖放落点由外层 Form 经 onDragOverCard/onDropCard 承接） */
  dragHandle?: ReactNode
  /** P0-4：批量删除选择模式复选框 */
  selectCheckbox?: ReactNode
  onDragOverCard?: (e: React.DragEvent) => void
  onDropCard?: () => void
  children: ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="entry-card" onDragOver={onDragOverCard} onDrop={onDropCard}>
      <div className="entry-card-header">
        {selectCheckbox}
        {dragHandle}
        <span className="entry-title">{title || '…'}</span>
        {visible === false ? (
          <span className="shrink-0 rounded-full bg-border/50 px-1.5 py-0.5 text-[10px] text-foreground/55">
            {t('editor.entryHidden')}
          </span>
        ) : null}
        <div className="flex shrink-0 items-center gap-0.5">
          {showVisibility ? (
            <Button size="sm" variant="ghost" title={visible === false ? showLabel : hideLabel} onClick={onToggleVisible}>
              {visible === false ? '👁︎' : '👁'}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" title="⧉" onClick={onDuplicate}>
            ⧉
          </Button>
          <Button size="sm" variant="danger" title="✕" onClick={onRemove}>
            ✕
          </Button>
        </div>
      </div>
      <div className={visible === false ? 'pointer-events-none opacity-40' : ''}>{children}</div>
    </div>
  )
}
