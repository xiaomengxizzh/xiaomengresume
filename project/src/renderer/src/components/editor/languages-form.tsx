/**
 * languages-form —— 语言能力表单（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { LANGUAGE_PROFICIENCIES } from '@shared/schema/resume'
import { FieldRow } from './form-kit'
import { EntryCard, SectionCard } from './section-card'
import { SelectField, TextField } from '../fields'

export function LanguagesForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.languages)
  const { appendItem, duplicateItem, removeItem } = useResumeStore.getState()

  return (
    <SectionCard section="languages" title={t('editor.section.languages')} onAdd={() => appendItem('languages', undefined)} addLabel={t('editor.action.add')}>
      {items.length === 0 ? <div className="py-4 text-center text-xs text-foreground/50">{t('editor.emptySection')}</div> : null}
      {items.map((item, i) => (
        <EntryCard
          key={item.id}
          title={item.name}
          visible={undefined}
          showVisibility={false}
          onToggleVisible={() => useResumeStore.getState().toggleItemVisible('languages', i)}
          onDuplicate={() => duplicateItem('languages', i)}
          onRemove={() => removeItem('languages', i)}
          showLabel={t('editor.action.show')}
          hideLabel={t('editor.action.hide')}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow label={t('editor.field.name')}>
              <TextField value={item.name} onCommit={(v) => useResumeStore.getState().setField(`languages[${i}].name`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.proficiency')}>
              <SelectField
                value={item.proficiency}
                emptyLabel="—"
                options={LANGUAGE_PROFICIENCIES.map((lv) => ({ value: lv, label: t(`editor.lang.${lv}`) }))}
                onCommit={(v) => useResumeStore.getState().setField(`languages[${i}].proficiency`, v)}
              />
            </FieldRow>
          </div>
        </EntryCard>
      ))}
    </SectionCard>
  )
}
