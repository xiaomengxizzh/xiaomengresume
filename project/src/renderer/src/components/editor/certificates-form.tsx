/**
 * certificates-form —— 证书表单（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { FieldRow } from './form-kit'
import { EntryCard, SectionCard } from './section-card'
import { TextField, DateField } from '../fields'

export function CertificatesForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.certificates)
  const { appendItem, duplicateItem, removeItem } = useResumeStore.getState()

  return (
    <SectionCard section="certificates" title={t('editor.section.certificates')} onAdd={() => appendItem('certificates', undefined)} addLabel={t('editor.action.add')}>
      {items.length === 0 ? <div className="py-4 text-center text-xs text-foreground/50">{t('editor.emptySection')}</div> : null}
      {items.map((item, i) => (
        <EntryCard
          key={item.id}
          title={item.name}
          visible={undefined}
          showVisibility={false}
          onToggleVisible={() => useResumeStore.getState().toggleItemVisible('certificates', i)}
          onDuplicate={() => duplicateItem('certificates', i)}
          onRemove={() => removeItem('certificates', i)}
          showLabel={t('editor.action.show')}
          hideLabel={t('editor.action.hide')}
        >
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow label={t('editor.field.name')}>
              <TextField value={item.name} onCommit={(v) => useResumeStore.getState().setField(`certificates[${i}].name`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.issuer')}>
              <TextField value={item.issuer} onCommit={(v) => useResumeStore.getState().setField(`certificates[${i}].issuer`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.date')}>
              <DateField value={item.date} onCommit={(v) => useResumeStore.getState().setField(`certificates[${i}].date`, v)} />
            </FieldRow>
            <FieldRow label={t('editor.field.url')}>
              <TextField value={item.url} onCommit={(v) => useResumeStore.getState().setField(`certificates[${i}].url`, v)} />
            </FieldRow>
          </div>
        </EntryCard>
      ))}
    </SectionCard>
  )
}
