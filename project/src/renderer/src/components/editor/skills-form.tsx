/**
 * skills-form —— 技能表单（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { SKILL_LEVELS } from '@shared/schema/resume'
import { FieldRow } from './form-kit'
import { EntryCard, SectionCard } from './section-card'
import { SelectField, TextField } from '../fields'

export function SkillsForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.skills)
  const { appendItem, duplicateItem, removeItem } = useResumeStore.getState()

  return (
    <SectionCard section="skills" title={t('editor.section.skills')} onAdd={() => appendItem('skills', undefined)} addLabel={t('editor.action.add')}>
      {items.length === 0 ? <div className="py-4 text-center text-xs text-foreground/50">{t('editor.emptySection')}</div> : null}
      {items.map((item, i) => (
        <EntryCard
          key={item.id}
          title={item.name}
          visible={undefined}
          showVisibility={false}
          onToggleVisible={() => useResumeStore.getState().toggleItemVisible('skills', i)}
          onDuplicate={() => duplicateItem('skills', i)}
          onRemove={() => removeItem('skills', i)}
          showLabel={t('editor.action.show')}
          hideLabel={t('editor.action.hide')}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow label={t('editor.field.name')}>
              <TextField value={item.name} onCommit={(v) => useResumeStore.getState().setField(`skills[${i}].name`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.category')}>
              <TextField value={item.category} onCommit={(v) => useResumeStore.getState().setField(`skills[${i}].category`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.level')}>
              <SelectField
                value={item.level}
                emptyLabel="—"
                options={SKILL_LEVELS.map((lv) => ({ value: lv, label: t(`editor.skill.${lv}`) }))}
                onCommit={(v) => useResumeStore.getState().setField(`skills[${i}].level`, v)}
              />
            </FieldRow>
          </div>
        </EntryCard>
      ))}
    </SectionCard>
  )
}
