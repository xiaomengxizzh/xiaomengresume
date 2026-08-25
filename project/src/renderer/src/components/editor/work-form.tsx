/**
 * work-form —— 工作经历表单（条目卡 + 批量操作 + 拖拽排序；2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { POLISH_FIELDS, registerFieldEditor, requestAssist } from './assist-bridge'
import { FieldRow } from './form-kit'
import { EntryCard, SectionCard } from './section-card'
import { BatchBar, EntryDragHandle, useEntryBatch } from './entry-batch'
import { EmptyState } from '../ui'
import { TextField, DateField } from '../fields'
import { TiptapField } from '../tiptap/TiptapField'

export function WorkForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.work)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible, moveItem } = useResumeStore.getState()
  // P0-4/P0-1：批量操作 + 条目拖拽（同 EducationForm）
  const batch = useEntryBatch('work')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  return (
    <SectionCard
      section="work"
      title={t('editor.section.work')}
      onAdd={() => appendItem('work', undefined)}
      addLabel={t('editor.action.add')}
      onPolish={() => requestAssist('polish', POLISH_FIELDS.work)}
      onGrammar={() => requestAssist('grammar', POLISH_FIELDS.work)}
    >
      {items.length === 0 ? (
        <EmptyState
          title={t('editor.emptySection')}
          desc={t('editor.batch.emptyDesc')}
          action={{
            label: t('editor.batch.addFirst'),
            onClick: () => {
              appendItem('work', undefined)
              useResumeStore.getState().focusField(`work[${items.length}].company`)
            }
          }}
        />
      ) : (
        <BatchBar batch={batch} hasVisibility />
      )}
      {items.map((item, i) => (
        <EntryCard
          key={item.id}
          title={item.company}
          visible={item.visible}
          onToggleVisible={() => toggleItemVisible('work', i)}
          onDuplicate={() => duplicateItem('work', i)}
          onRemove={() => removeItem('work', i)}
          showLabel={t('editor.action.show')}
          hideLabel={t('editor.action.hide')}
          dragHandle={
            <EntryDragHandle
              index={i}
              onDragStart={setDragIndex}
              onDragEnd={() => setDragIndex(null)}
              onMove={(from, d) => moveItem('work', from, from + d)}
            />
          }
          selectCheckbox={
            batch.selectMode ? (
              <input type="checkbox" className="accent-foreground" checked={batch.selected.has(i)} onChange={() => batch.toggle(i)} aria-label={`${i + 1}`} />
            ) : null
          }
          onDragOverCard={(e) => {
            if (dragIndex !== null && e.dataTransfer.types.includes('text/plain')) e.preventDefault()
          }}
          onDropCard={() => {
            if (dragIndex !== null && dragIndex !== i) moveItem('work', dragIndex, i)
            setDragIndex(null)
          }}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow label={t('editor.field.company')}>
              <TextField value={item.company} onCommit={(v) => useResumeStore.getState().setField(`work[${i}].company`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.title')}>
              <TextField value={item.title} onCommit={(v) => useResumeStore.getState().setField(`work[${i}].title`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.location')}>
              <TextField value={item.location} onCommit={(v) => useResumeStore.getState().setField(`work[${i}].location`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.current')}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.current === true}
                  onChange={(e) => useResumeStore.getState().setField(`work[${i}].current`, e.target.checked)}
                  className="h-4 w-4 accent-foreground"
                />
                <span className="text-foreground/70">{t('editor.field.current')}</span>
              </label>
            </FieldRow>
            <FieldRow label={t('editor.field.startDate')}>
              <DateField value={item.startDate} onCommit={(v) => useResumeStore.getState().setField(`work[${i}].startDate`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.endDate')}>
              <DateField value={item.endDate} onCommit={(v) => useResumeStore.getState().setField(`work[${i}].endDate`, v)} />
            </FieldRow>
          </div>
          <FieldRow label={t('editor.field.summary')}>
            <TiptapField
              value={item.summary as never}
              onChange={(v) => useResumeStore.getState().setField(`work[${i}].summary`, v)}
              onEditorReady={(ed) => registerFieldEditor(`work[${i}].summary`, ed)}
            />
          </FieldRow>
        </EntryCard>
      ))}
    </SectionCard>
  )
}
