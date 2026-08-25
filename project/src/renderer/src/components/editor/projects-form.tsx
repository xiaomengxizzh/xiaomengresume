/**
 * projects-form —— 项目经历表单（条目卡 + 批量操作 + 拖拽排序；2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
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

export function ProjectsForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.projects)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible, moveItem } = useResumeStore.getState()
  // P0-4/P0-1：批量操作 + 条目拖拽（同 EducationForm）
  const batch = useEntryBatch('projects')
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  return (
    <SectionCard
      section="projects"
      title={t('editor.section.projects')}
      onAdd={() => appendItem('projects', undefined)}
      addLabel={t('editor.action.add')}
      onPolish={() => requestAssist('polish', POLISH_FIELDS.projects)}
      onGrammar={() => requestAssist('grammar', POLISH_FIELDS.projects)}
    >
      {items.length === 0 ? (
        <EmptyState
          title={t('editor.emptySection')}
          desc={t('editor.batch.emptyDesc')}
          action={{
            label: t('editor.batch.addFirst'),
            onClick: () => {
              appendItem('projects', undefined)
              useResumeStore.getState().focusField(`projects[${items.length}].name`)
            }
          }}
        />
      ) : (
        <BatchBar batch={batch} hasVisibility />
      )}
      {items.map((item, i) => (
        <EntryCard
          key={item.id}
          title={item.name}
          visible={item.visible}
          onToggleVisible={() => toggleItemVisible('projects', i)}
          onDuplicate={() => duplicateItem('projects', i)}
          onRemove={() => removeItem('projects', i)}
          showLabel={t('editor.action.show')}
          hideLabel={t('editor.action.hide')}
          dragHandle={
            <EntryDragHandle
              index={i}
              onDragStart={setDragIndex}
              onDragEnd={() => setDragIndex(null)}
              onMove={(from, d) => moveItem('projects', from, from + d)}
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
            if (dragIndex !== null && dragIndex !== i) moveItem('projects', dragIndex, i)
            setDragIndex(null)
          }}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow label={t('editor.field.projectName')}>
              <TextField value={item.name} onCommit={(v) => useResumeStore.getState().setField(`projects[${i}].name`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.role')}>
              <TextField value={item.role} onCommit={(v) => useResumeStore.getState().setField(`projects[${i}].role`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.organization')}>
              <TextField value={item.organization} onCommit={(v) => useResumeStore.getState().setField(`projects[${i}].organization`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.url')}>
              <TextField value={item.url} onCommit={(v) => useResumeStore.getState().setField(`projects[${i}].url`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.startDate')}>
              <DateField value={item.startDate} onCommit={(v) => useResumeStore.getState().setField(`projects[${i}].startDate`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.endDate')}>
              <DateField value={item.endDate} onCommit={(v) => useResumeStore.getState().setField(`projects[${i}].endDate`, v)} />
            </FieldRow>
          </div>
          <FieldRow label={t('editor.field.description')}>
            <TiptapField
              value={item.description as never}
              onChange={(v) => useResumeStore.getState().setField(`projects[${i}].description`, v)}
              onEditorReady={(ed) => registerFieldEditor(`projects[${i}].description`, ed)}
            />
          </FieldRow>
        </EntryCard>
      ))}
    </SectionCard>
  )
}
