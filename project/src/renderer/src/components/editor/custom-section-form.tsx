/**
 * custom-section-form —— 自定义模块表单（非基本信息；可编辑标题 + 渲染模板 + 正文/条目/标签 + 删除）
 * （2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { registerFieldEditor } from './assist-bridge'
import { FieldRow } from './form-kit'
import { SectionCard } from './section-card'
import { Button } from '../ui'
import { TextField } from '../fields'
import { TiptapField } from '../tiptap/TiptapField'

export function CustomSectionForm({ id }: { id: string }): React.JSX.Element {
  const { t } = useTranslation()
  // 2026-08-25 批 B3：粗粒度 s.resume 收敛为 customSections/sectionOrder 细粒度（本组件仅消费这两个低频字段）
  const customSections = useResumeStore((s) => s.resume.customSections)
  const sectionOrder = useResumeStore((s) => s.resume.layout?.sectionOrder)
  const setField = useResumeStore((s) => s.setField)
  const idx = (customSections ?? []).findIndex((c) => c.id === id)
  if (idx < 0) return <></>
  const section = customSections![idx]
  const tpl = section.template ?? 'text'
  const path = (k: string): string => `customSections[${idx}].${k}`

  // P1-7：按当前模板填充演示数据（i18n 文案；覆盖对应字段，其余模板的数据保留不删）
  const para = (text: string): unknown => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
  const fillSample = (): void => {
    if (tpl === 'text') setField(path('content'), para(t('editor.module.sample.text')))
    else if (tpl === 'entry')
      setField(path('entries'), [
        {
          head: t('editor.module.sample.entryHead'),
          sub: t('editor.module.sample.entrySub'),
          desc: para(t('editor.module.sample.entryDesc'))
        }
      ])
    else setField(path('tags'), [t('editor.module.sample.tag1'), t('editor.module.sample.tag2'), t('editor.module.sample.tag3')])
  }

  return (
    <SectionCard title={t('editor.section.custom')}>
      <FieldRow label={t('editor.module.title')}>
        <TextField value={section.title} onCommit={(v) => setField(path('title'), v)} />
      </FieldRow>
      {/* P1-7（2026-08-21）：三模板卡片化切换（图标+名称+描述；数据字段并存 optional，切换不丢内容） */}
      <FieldRow label={t('editor.module.template')}>
        <div className="flex w-full gap-2">
          {(['text', 'entry', 'tag'] as const).map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => setField(path('template'), tp)}
              title={t(`editor.module.templateDesc.${tp}`)}
              className={`flex flex-1 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                tpl === tp
                  ? 'border-foreground bg-selected/40 text-foreground'
                  : 'border-border text-foreground/70 hover:bg-selected/30'
              }`}
            >
              <span className="text-xs font-medium">{t(`editor.module.template.${tp}`)}</span>
              <span className="text-[10px] leading-tight text-foreground/50">{t(`editor.module.templateDesc.${tp}`)}</span>
            </button>
          ))}
        </div>
      </FieldRow>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={fillSample}>
          {t('editor.module.fillSample')}
        </Button>
      </div>
      {tpl === 'text' ? (
        <FieldRow label={t('editor.field.content')}>
          <TiptapField
            value={section.content as never}
            onChange={(v) => setField(path('content'), v)}
            onEditorReady={(ed) => registerFieldEditor(path('content'), ed)}
          />
        </FieldRow>
      ) : null}
      {tpl === 'entry' ? (
        <div className="space-y-2">
          {(section.entries ?? []).map((en, i) => (
            <div key={i} className="rounded-md border border-border p-2">
              <FieldRow label={t('editor.module.entryHead')}>
                <TextField value={en.head} onCommit={(v) => setField(`${path('entries')}[${i}].head`, v)} />
              </FieldRow>
              <FieldRow label={t('editor.module.entrySub')}>
                <TextField value={en.sub ?? ''} onCommit={(v) => setField(`${path('entries')}[${i}].sub`, v)} />
              </FieldRow>
              <Button
                size="sm"
                variant="danger"
                onClick={() => setField(path('entries'), (section.entries ?? []).filter((_, j) => j !== i))}
              >
                {t('editor.module.remove')}
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setField(path('entries'), [...(section.entries ?? []), { head: '', sub: '', desc: { type: 'doc', content: [] } as never }])}
          >
            {t('editor.module.addEntry')}
          </Button>
        </div>
      ) : null}
      {tpl === 'tag' ? (
        <FieldRow label={t('editor.module.tags')}>
          <TextField
            value={(section.tags ?? []).join('、')}
            onCommit={(v) => setField(path('tags'), v.split(/[、,，]/).map((s) => s.trim()).filter(Boolean))}
          />
        </FieldRow>
      ) : null}
      <div className="mt-1 flex justify-end">
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            const next = (customSections ?? []).filter((c) => c.id !== id)
            setField('customSections', next)
            // 同步从排序中移除
            const order = (sectionOrder ?? []).filter((m) => m !== id)
            setField('layout.sectionOrder', order)
          }}
        >
          {t('editor.module.remove')}
        </Button>
      </div>
    </SectionCard>
  )
}
