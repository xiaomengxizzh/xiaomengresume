/**
 * summary-form —— 个人总结表单（中英双栏切换；2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { POLISH_FIELDS, registerFieldEditor, requestAssist } from './assist-bridge'
import { FieldRow, useField } from './form-kit'
import { SectionCard } from './section-card'
import { TiptapField } from '../tiptap/TiptapField'

export function SummaryForm(): React.JSX.Element {
  const { t } = useTranslation()
  const [content, setContent] = useField('summary.content')
  const enContent = useResumeStore((s) => s.resume.summary.enContent)
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const setEnContent = (v: unknown): void => useResumeStore.getState().setField('summary.enContent', v)
  return (
    <SectionCard
      section="summary"
      title={t('editor.section.summary')}
      onPolish={() => requestAssist('polish', POLISH_FIELDS.summary)}
      onGrammar={() => requestAssist('grammar', POLISH_FIELDS.summary)}
    >
      <div className="mb-2 flex items-center gap-3 text-xs">
        <button
          type="button"
          className={lang === 'zh' ? 'font-medium text-foreground' : 'text-foreground/50 hover:text-foreground'}
          onClick={() => setLang('zh')}
        >
          {t('editor.summaryZh')}
        </button>
        <button
          type="button"
          className={lang === 'en' ? 'font-medium text-foreground' : 'text-foreground/50 hover:text-foreground'}
          onClick={() => setLang('en')}
        >
          {t('editor.summaryEn')}
        </button>
        {lang === 'en' && !enContent ? <span className="text-foreground/40">{t('ai.intro.emptySummary')}</span> : null}
      </div>
      <FieldRow label={lang === 'zh' ? t('editor.field.content') : `${t('editor.field.content')} · ${t('editor.summaryEn')}`}>
        {lang === 'zh' ? (
          <TiptapField
            value={content as never}
            onChange={(v) => setContent(v)}
            onEditorReady={(ed) => registerFieldEditor('summary.content', ed)}
          />
        ) : (
          <TiptapField
            value={enContent as never}
            onChange={(v) => setEnContent(v)}
            onEditorReady={(ed) => registerFieldEditor('summary.enContent', ed)}
          />
        )}
      </FieldRow>
    </SectionCard>
  )
}
