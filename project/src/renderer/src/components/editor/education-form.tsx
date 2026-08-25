/**
 * education-form —— 教育经历表单（条目卡 + 批量操作 + 拖拽排序；2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
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

export function EducationForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.education)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible, moveItem } = useResumeStore.getState()
  // P0-4/P0-1：批量操作 + 条目拖拽（选择态/拖拽源为局部 UI state，操作走 store 单历史步）
  const batch = useEntryBatch('education')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  return (
    <SectionCard
      section="education"
      title={t('editor.section.education')}
      onAdd={() => appendItem('education', undefined)}
      addLabel={t('editor.action.add')}
      onPolish={() => requestAssist('polish', POLISH_FIELDS.education)}
      onGrammar={() => requestAssist('grammar', POLISH_FIELDS.education)}
    >
      {items.length === 0 ? (
        <EmptyState
          title={t('editor.emptySection')}
          desc={t('editor.batch.emptyDesc')}
          action={{
            label: t('editor.batch.addFirst'),
            onClick: () => {
              appendItem('education', undefined)
              useResumeStore.getState().focusField(`education[${items.length}].school`)
            }
          }}
        />
      ) : (
        <BatchBar batch={batch} hasVisibility />
      )}
      {items.map((item, i) => (
        <EntryCard
          key={item.id}
          title={item.school}
          visible={item.visible}
          onToggleVisible={() => toggleItemVisible('education', i)}
          onDuplicate={() => duplicateItem('education', i)}
          onRemove={() => removeItem('education', i)}
          showLabel={t('editor.action.show')}
          hideLabel={t('editor.action.hide')}
          dragHandle={
            <EntryDragHandle
              index={i}
              onDragStart={setDragIndex}
              onDragEnd={() => setDragIndex(null)}
              onMove={(from, d) => moveItem('education', from, from + d)}
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
            if (dragIndex !== null && dragIndex !== i) moveItem('education', dragIndex, i)
            setDragIndex(null)
          }}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow label={t('editor.field.school')}>
              <TextField value={item.school} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].school`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.degree')}>
              <TextField value={item.degree} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].degree`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.major')}>
              <TextField value={item.major} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].major`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.location')}>
              <TextField value={item.location} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].location`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.startDate')}>
              <DateField value={item.startDate} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].startDate`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.endDate')}>
              <DateField value={item.endDate} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].endDate`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.gpa')}>
              <TextField value={item.gpa} onCommit={(v) => useResumeStore.getState().setField(`education[${i}].gpa`, v)} />
            </FieldRow>
          </div>
          <FieldRow label={t('editor.field.description')}>
            <TiptapField
              value={item.description as never}
              onChange={(v) => useResumeStore.getState().setField(`education[${i}].description`, v)}
              onEditorReady={(ed) => registerFieldEditor(`education[${i}].description`, ed)}
            />
          </FieldRow>
        </EntryCard>
      ))}
    </SectionCard>
  )
}
