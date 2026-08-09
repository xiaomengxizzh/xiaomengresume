/**
 * ImportWizard —— M4a 三步核对向导（信任底线：不可跳过，R2）
 * ① 解析预览：源信息 + 提取文本滚动
 * ② 字段核对：分组字段列表（原文 AI 映射值，全部可编辑）
 * ③ 确认写入：新建 / 覆盖当前（二次确认）→ applyImport（一次撤销可回滚）
 *
 * 样式：令牌类（bg-surface / text-foreground / border-border），复用 ui/Button/Input/Textarea。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportDraft } from '@shared/ipc-channels'
import type { Resume, RichText } from '@shared/schema/resume'
import { useResumeStore } from '../../store/useResumeStore'
import { Button, Input, Textarea } from '../ui'

/** RichText → 纯文本（Tiptap doc 递归 / 降级 HTML 剥标签） */
function richTextToPlain(rt: RichText | undefined): string {
  if (typeof rt === 'string') return rt.replace(/<[^>]+>/g, '')
  if (!rt || rt.type !== 'doc' || !Array.isArray(rt.content)) return ''
  return rt.content
    .map((node) => {
      const p = node as { content?: Array<{ text?: string }> }
      return p.content?.map((t) => t.text ?? '').join('') ?? ''
    })
    .join('\n')
    .trim()
}

/** 纯文本 → RichText 单段落 */
function textToRichText(text: string): RichText {
  const t = text.trim()
  if (!t) return { type: 'doc', content: [] }
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] }
}

type FieldKind = 'text' | 'rich'
interface FieldDef {
  key: string
  labelKey: string
  kind?: FieldKind
}
interface SecMeta {
  labelKey: string
  fields: FieldDef[]
  richList?: { key: string; labelKey: string }
}

const SECTIONS: SecMeta[] = [
  {
    labelKey: 'import.fieldGroups.basics',
    fields: [
      { key: 'name', labelKey: 'import.labels.name' },
      { key: 'headline', labelKey: 'import.labels.headline' },
      { key: 'phone', labelKey: 'import.labels.phone' },
      { key: 'email', labelKey: 'import.labels.email' },
      { key: 'location', labelKey: 'import.labels.location' },
      { key: 'address', labelKey: 'import.labels.address' },
      { key: 'website', labelKey: 'import.labels.website' },
      { key: 'englishName', labelKey: 'import.labels.englishName' },
      { key: 'profile', labelKey: 'import.labels.profile', kind: 'rich' }
    ]
  },
  {
    labelKey: 'import.fieldGroups.summary',
    fields: [{ key: 'content', labelKey: 'import.labels.summaryContent', kind: 'rich' }]
  },
  {
    labelKey: 'import.fieldGroups.education',
    fields: [
      { key: 'school', labelKey: 'import.labels.school' },
      { key: 'degree', labelKey: 'import.labels.degree' },
      { key: 'major', labelKey: 'import.labels.major' },
      { key: 'startDate', labelKey: 'import.labels.startDate' },
      { key: 'endDate', labelKey: 'import.labels.endDate' },
      { key: 'location', labelKey: 'import.labels.location' },
      { key: 'gpa', labelKey: 'import.labels.gpa' },
      { key: 'description', labelKey: 'import.labels.description', kind: 'rich' }
    ]
  },
  {
    labelKey: 'import.fieldGroups.work',
    fields: [
      { key: 'company', labelKey: 'import.labels.company' },
      { key: 'title', labelKey: 'import.labels.title' },
      { key: 'location', labelKey: 'import.labels.location' },
      { key: 'startDate', labelKey: 'import.labels.startDate' },
      { key: 'endDate', labelKey: 'import.labels.endDate' },
      { key: 'summary', labelKey: 'import.labels.summary', kind: 'rich' }
    ],
    richList: { key: 'highlights', labelKey: 'import.labels.highlights' }
  },
  {
    labelKey: 'import.fieldGroups.projects',
    fields: [
      { key: 'name', labelKey: 'import.labels.projectName' },
      { key: 'role', labelKey: 'import.labels.role' },
      { key: 'organization', labelKey: 'import.labels.organization' },
      { key: 'startDate', labelKey: 'import.labels.startDate' },
      { key: 'endDate', labelKey: 'import.labels.endDate' },
      { key: 'url', labelKey: 'import.labels.url' },
      { key: 'description', labelKey: 'import.labels.description', kind: 'rich' }
    ],
    richList: { key: 'highlights', labelKey: 'import.labels.highlights' }
  },
  {
    labelKey: 'import.fieldGroups.skills',
    fields: [
      { key: 'name', labelKey: 'import.labels.name' },
      { key: 'category', labelKey: 'import.labels.category' },
      { key: 'level', labelKey: 'import.labels.level' }
    ]
  },
  {
    labelKey: 'import.fieldGroups.certificates',
    fields: [
      { key: 'name', labelKey: 'import.labels.name' },
      { key: 'issuer', labelKey: 'import.labels.issuer' },
      { key: 'date', labelKey: 'import.labels.date' },
      { key: 'url', labelKey: 'import.labels.url' }
    ]
  },
  {
    labelKey: 'import.fieldGroups.languages',
    fields: [
      { key: 'name', labelKey: 'import.labels.name' },
      { key: 'proficiency', labelKey: 'import.labels.proficiency' }
    ]
  }
]

function FieldInput({
  kind,
  value,
  onChange
}: {
  kind: FieldKind
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  if (kind === 'rich') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[56px] text-[13px]"
      />
    )
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-[13px]" />
}

export function ImportWizard({
  draft,
  onCancel
}: {
  draft: ImportDraft
  onCancel: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const applyImport = useResumeStore((s) => s.applyImport)
  const currentView = useResumeStore((s) => s.currentView)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [resume, setResume] = useState<Resume>(() => structuredClone(draft.resume))
  const [mode, setMode] = useState<'new' | 'overwrite'>('new')
  const [confirming, setConfirming] = useState(false)

  /** 原地改某字段（结构克隆后更新，setState 触发重渲染） */
  const patch = (fn: (d: Resume) => void): void => {
    setResume((prev) => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
  }

  const renderFields = (sec: SecMeta, get: (d: Resume) => Record<string, unknown>, set: (d: Resume, key: string, v: unknown) => void): React.JSX.Element => (
    <div className="space-y-3">
      {sec.fields.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-xs text-foreground/60">{t(f.labelKey)}</span>
          <FieldInput
            kind={f.kind ?? 'text'}
            value={String(get(resume)[f.key] ?? '')}
            onChange={(v) => patch((d) => set(d, f.key, f.kind === 'rich' ? textToRichText(v) : v))}
          />
        </label>
      ))}
      {sec.richList ? (
        <div>
          <span className="mb-1 block text-xs text-foreground/60">{t(sec.richList.labelKey)}</span>
          {(
            (get(resume)[sec.richList.key] ?? []) as RichText[]
          ).map((h, i) => (
            <div key={i} className="mb-2 flex items-start gap-2">
              <Textarea
                value={richTextToPlain(h)}
                onChange={(e) =>
                  patch((d) => {
                    const arr = get(d)[sec.richList!.key] as RichText[]
                    arr[i] = textToRichText(e.target.value)
                  })
                }
                className="min-h-[44px] text-[13px]"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  patch((d) => {
                    ;(get(d)[sec.richList!.key] as RichText[]).splice(i, 1)
                  })
                }
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )

  /** 单对象 section（basics / summary） */
  const renderObjectSection = (sec: SecMeta, root: keyof Resume): React.JSX.Element => (
    <div className="import-field-card">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{t(sec.labelKey)}</h3>
      {renderFields(sec, (d) => d[root] as unknown as Record<string, unknown>, (d, k, v) => {
        ;(d[root] as unknown as Record<string, unknown>)[k] = v
      })}
    </div>
  )

  /** 数组 section（education/work/...） */
  const renderArraySection = (sec: SecMeta, root: keyof Resume): React.JSX.Element => {
    const arr = resume[root] as unknown as Array<Record<string, unknown> & { id?: string }>
    if (arr.length === 0) return <></>
    return (
      <div className="import-field-card">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          {t(sec.labelKey)}（{arr.length}）
        </h3>
        <div className="space-y-4">
          {arr.map((item, i) => (
            <div key={item.id ?? i} className="rounded-lg border border-border/60 p-3">
              {renderFields(sec, () => item, (d, k, v) => {
                ;((d[root] as unknown as Array<Record<string, unknown>>)[i])[k] = v
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isEmpty = (r: Resume): boolean =>
    r.basics.name === '' &&
    richTextToPlain(r.summary.content) === '' &&
    r.education.length === 0 &&
    r.work.length === 0 &&
    r.projects.length === 0 &&
    r.skills.length === 0 &&
    r.certificates.length === 0 &&
    r.languages.length === 0

  const confirmWrite = (): void => {
    if (mode === 'overwrite') {
      if (!confirming) {
        setConfirming(true)
        return
      }
    }
    applyImport(resume)
    // applyImport 已切 'editor' 视图；本组件随 currentView 卸载
  }

  return (
    <div className="home-view">
      {/* 步骤指示 */}
      <div className="mb-4 flex items-center gap-3 text-[13px]">
        {[1, 2, 3].map((s) => (
          <span key={s} className={`flex items-center gap-2 ${step === s ? 'text-foreground' : 'text-foreground/40'}`}>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                step >= s ? 'bg-foreground text-surface' : 'border border-border'
              }`}
            >
              {s}
            </span>
            <span className={step >= s ? '' : 'hidden sm:inline'}>{t(`import.step${s}`)}</span>
            {s < 3 ? <span className="text-foreground/30">→</span> : null}
          </span>
        ))}
      </div>

      {/* ① 解析预览 */}
      {step === 1 ? (
        <div className="import-field-card">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-foreground">{t('import.previewSource')}</h3>
            <span className="text-xs text-foreground/50">
              {t('import.sourceInfo')}：{draft.fileName}（{draft.format}）
            </span>
          </div>
          {draft.sourcePreview.trim() ? (
            <pre className="max-h-[46vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-surface p-3 text-[13px] leading-relaxed text-foreground/85">
              {draft.sourcePreview}
            </pre>
          ) : (
            <p className="text-sm text-foreground/50">{t('import.noContent')}</p>
          )}
          {draft.warnings.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[13px] text-amber-700">
              <span className="font-medium">{t('import.warnings')}：</span>
              {draft.warnings.map((w) => t(w)).join('；')}
            </div>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel}>{t('import.cancelImport')}</Button>
            <Button onClick={() => setStep(2)}>{t('import.next')}</Button>
          </div>
        </div>
      ) : null}

      {/* ② 字段核对 */}
      {step === 2 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-foreground/60">
            <span className="rounded bg-foreground/5 px-2 py-1">
              {isEmpty(resume)
                ? t('import.noContent')
                : `${resume.basics.name || '—'} · ${resume.work.length} 段工作 · ${resume.education.length} 段教育`}
            </span>
          </div>
          <div className="max-h-[58vh] space-y-4 overflow-auto pr-1">
            {renderObjectSection(SECTIONS[0], 'basics')}
            {renderObjectSection(SECTIONS[1], 'summary')}
            {renderArraySection(SECTIONS[2], 'education')}
            {renderArraySection(SECTIONS[3], 'work')}
            {renderArraySection(SECTIONS[4], 'projects')}
            {renderArraySection(SECTIONS[5], 'skills')}
            {renderArraySection(SECTIONS[6], 'certificates')}
            {renderArraySection(SECTIONS[7], 'languages')}
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>{t('import.back')}</Button>
            <Button onClick={() => setStep(3)}>{t('import.next')}</Button>
          </div>
        </div>
      ) : null}

      {/* ③ 确认写入 */}
      {step === 3 ? (
        <div className="import-field-card max-w-xl">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t('import.confirmWriteHeading')}</h3>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === 'new'}
                onChange={() => {
                  setMode('new')
                  setConfirming(false)
                }}
              />
              {t('import.createNew')}
            </label>
            {currentView === 'editor' || useResumeStore.getState().resumeId !== null ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'overwrite'}
                  onChange={() => {
                    setMode('overwrite')
                    setConfirming(false)
                  }}
                />
                {t('import.overwriteCurrent')}
              </label>
            ) : null}
          </div>
          {mode === 'overwrite' && confirming ? (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[13px] text-amber-700">
              {t('import.overwriteWarning')}
            </div>
          ) : null}
          <div className="mt-4 flex justify-between gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>{t('import.back')}</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel}>{t('import.cancelImport')}</Button>
              <Button onClick={confirmWrite}>
                {mode === 'overwrite' && confirming ? t('import.overwriteConfirm') : t('import.confirmWrite')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
