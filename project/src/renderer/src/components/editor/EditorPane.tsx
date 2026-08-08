/**
 * EditorPane —— F2 编辑器表单区（§3.2/§3.3/§3.7，2026-08-07 UI 重构）
 * 分区切换由左侧 NavBar 接管（原顶部 chips 移除）；顶部排版条（LayoutBar）+ 当前 section 表单卡片；
 * 单元级工具：字体选择 + AI 润色占位；预览反查驱动滚动 + 高亮闪烁。
 * 全部走 i18n key（禁硬编码中文，CH4 扫描）。
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { getByPath, parsePath } from '@shared/paths'
import { SKILL_LEVELS, LANGUAGE_PROFICIENCIES } from '@shared/schema/resume'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import { INFO_ICON_IDS, type InfoIconId } from '@shared/constants/info-icons'
import { Button, Select } from '../ui'
import { TextField, DateField, SelectField } from '../fields'
import { TiptapField } from '../tiptap/TiptapField'
import { InfoIcon } from '../icons/InfoIcons'
import { LayoutBar } from './LayoutBar'

/* ── SectionCard / EntryCard ────────────────────────────────────────────── */

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
  children
}: {
  title: string
  section?: string
  onAdd?: () => void
  addLabel?: string
  children: ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <section className="section-card">
      <div className="section-card-header">
        <h3 className="text-[15px] font-medium">{title}</h3>
        <div className="section-toolbar">
          {section ? <SectionFontSelect section={section} /> : null}
          {section ? (
            <Button size="sm" variant="ghost" disabled title={t('nav.placeholder')}>
              ✨ {t('editor.aiAssist')}
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
    </section>
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
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="entry-card">
      <div className="entry-card-header">
        <span className="entry-title">{title || '…'}</span>
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

/* ── 受控字段 hook（读 store + 提交级写入）────────────────────────────── */

function useField(path: string): [unknown, (v: unknown) => void] {
  const value = useResumeStore((s) => getByPath(s.resume, path))
  const setField = useResumeStore((s) => s.setField)
  return [value, (v: unknown) => setField(path, v)]
}

function FieldRow({
  label,
  children
}: {
  label: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-2.5">
      <div className="mb-1 text-xs font-medium text-foreground/70">{label}</div>
      {children}
    </div>
  )
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/* ── 各 section 表单 ────────────────────────────────────────────────────── */

function BasicsForm(): React.JSX.Element {
  const { t } = useTranslation()
  const [customFields] = useField('basics.customFields')
  const [infoItems] = useField('basics.infoItems')
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)

  const fields: Array<[string, string, 'text' | 'month']> = [
    ['name', 'editor.field.name', 'text'],
    ['englishName', 'editor.field.englishName', 'text'],
    ['headline', 'editor.field.headline', 'text'],
    ['employmentStatus', 'editor.field.employmentStatus', 'text'],
    ['birthDate', 'editor.field.birthDate', 'month'],
    ['phone', 'editor.field.phone', 'text'],
    ['email', 'editor.field.email', 'text'],
    ['website', 'editor.field.website', 'text'],
    ['address', 'editor.field.address', 'text'],
    ['location', 'editor.field.location', 'text']
  ]

  // L8（M2）：照片选择 → canvas 压缩 ≤2MB → dataURL（D15，防主存 JSON 膨胀）
  const pickPhoto = (file: File): void => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (): void => {
      const img = new Image()
      img.onload = (): void => {
        // canvas 降采样：最长边 ≤800px 后压缩，控制体积
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        if (dataUrl.length > 2 * 1024 * 1024) return // >2MB 放弃（D15）
        setField('basics.photo', dataUrl)
        setField('basics.photoWidth', width)
        setField('basics.photoHeight', height)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <SectionCard section="basics" title={t('editor.section.basics')}>
      <div className="grid grid-cols-1 gap-x-3">
        {fields.map(([key, labelKey, type]) => (
          <FieldRow key={key} label={t(labelKey)}>
            {type === 'month' ? (
              <DateField value={getString(resume.basics[key as keyof typeof resume.basics])} onCommit={(v) => setField(`basics.${key}`, v)} />
            ) : (
              <TextField value={getString(resume.basics[key as keyof typeof resume.basics])} onCommit={(v) => setField(`basics.${key}`, v)} />
            )}
          </FieldRow>
        ))}
      </div>

      {/* L8（M2）：照片选择（canvas 压缩 ≤2MB → dataURL） */}
      <div className="mt-2 border-t border-border/70 pt-3">
        <div className="mb-2 text-xs font-medium text-foreground/70">{t('editor.field.photo')}</div>
        <div className="flex items-center gap-3">
          {resume.basics.photo ? (
            <img
              src={resume.basics.photo}
              alt=""
              className="h-16 w-12 rounded object-cover"
              style={{ width: resume.basics.photoWidth ?? 48, height: resume.basics.photoHeight ?? 64, objectFit: 'cover' }}
            />
          ) : null}
          <label className="cursor-pointer text-xs text-foreground/70 underline-offset-2 hover:underline">
            {t('editor.field.photoPick')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) pickPhoto(f)
                e.target.value = ''
              }}
            />
          </label>
          {resume.basics.photo ? (
            <Button size="sm" variant="ghost" onClick={() => setField('basics.photo', '')}>
              {t('editor.action.remove')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* L8（M2）：infoItems 增删改（icon + label + value，PDF 顶部两列） */}
      <div className="mt-2 border-t border-border/70 pt-3">
        <div className="mb-2 text-xs font-medium text-foreground/70">{t('editor.field.infoItemsLabel')}</div>
        {Array.isArray(infoItems) && infoItems.length > 0 ? (
          infoItems.map((it, i) => {
            const item = it as { id: string; icon: InfoIconId; label: string; value: string }
            return (
              <div key={item.id} className="mb-2 flex items-center gap-2">
                <Select
                  className="!w-28"
                  value={item.icon}
                  onChange={(e) => setField(`basics.infoItems[${i}].icon`, e.target.value)}
                >
                  {INFO_ICON_IDS.map((iconId) => (
                    <option key={iconId} value={iconId}>
                      <InfoIcon id={iconId} size={12} /> {t(`editor.infoIcon.${iconId}`)}
                    </option>
                  ))}
                </Select>
                <TextField value={item.label} onCommit={(v) => setField(`basics.infoItems[${i}].label`, v)} />
                <TextField value={item.value} onCommit={(v) => setField(`basics.infoItems[${i}].value`, v)} />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    const next = (infoItems as unknown[]).filter((_, idx) => idx !== i)
                    setField('basics.infoItems', next)
                  }}
                >
                  ✕
                </Button>
              </div>
            )
          })
        ) : (
          <div className="text-xs text-foreground/50">{t('editor.emptySection')}</div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = [
              ...((infoItems as unknown[]) ?? []),
              { id: crypto.randomUUID(), icon: 'mail' as InfoIconId, label: '', value: '' }
            ]
            setField('basics.infoItems', next)
          }}
        >
          ＋
        </Button>
      </div>

      {/* 自定义字段（2026-08-07 增补，M1 UI 即用） */}
      <div className="mt-2 border-t border-border/70 pt-3">
        <div className="mb-2 text-xs font-medium text-foreground/70">{t('editor.field.customFieldLabel')}</div>
        {Array.isArray(customFields) && customFields.length > 0 ? (
          customFields.map((cf, i) => {
            const c = cf as { id: string; label: string; value: string }
            return (
              <div key={c.id} className="mb-2 flex items-center gap-2">
                <TextField value={c.label} onCommit={(v) => setField(`basics.customFields[${i}].label`, v)} />
                <TextField value={c.value} onCommit={(v) => setField(`basics.customFields[${i}].value`, v)} />
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    const next = (customFields as unknown[]).filter((_, idx) => idx !== i)
                    setField('basics.customFields', next)
                  }}
                >
                  ✕
                </Button>
              </div>
            )
          })
        ) : (
          <div className="text-xs text-foreground/50">{t('editor.emptySection')}</div>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const next = [
              ...((customFields as unknown[]) ?? []),
              { id: crypto.randomUUID(), label: '', value: '' }
            ]
            setField('basics.customFields', next)
          }}
        >
          ＋
        </Button>
      </div>

      {/* L8（M2）：profile 个人简介（短头部版，Tiptap 富文本） */}
      <div className="mt-2 border-t border-border/70 pt-3">
        <FieldRow label={t('editor.field.profile')}>
          <TiptapField value={resume.basics.profile as never} onChange={(v) => setField('basics.profile', v)} />
        </FieldRow>
      </div>
    </SectionCard>
  )
}

function SummaryForm(): React.JSX.Element {
  const { t } = useTranslation()
  const [content, setContent] = useField('summary.content')
  return (
    <SectionCard section="summary" title={t('editor.section.summary')}>
      <FieldRow label={t('editor.field.content')}>
        <TiptapField value={content as never} onChange={(v) => setContent(v)} />
      </FieldRow>
    </SectionCard>
  )
}

function EducationForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.education)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible } = useResumeStore.getState()

  return (
    <SectionCard section="education" title={t('editor.section.education')} onAdd={() => appendItem('education', undefined)} addLabel={t('editor.action.add')}>
      {items.length === 0 ? <div className="py-4 text-center text-xs text-foreground/50">{t('editor.emptySection')}</div> : null}
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
            <TiptapField value={item.description as never} onChange={(v) => useResumeStore.getState().setField(`education[${i}].description`, v)} />
          </FieldRow>
        </EntryCard>
      ))}
    </SectionCard>
  )
}

function WorkForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.work)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible } = useResumeStore.getState()

  return (
    <SectionCard section="work" title={t('editor.section.work')} onAdd={() => appendItem('work', undefined)} addLabel={t('editor.action.add')}>
      {items.length === 0 ? <div className="py-4 text-center text-xs text-foreground/50">{t('editor.emptySection')}</div> : null}
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
            <TiptapField value={item.summary as never} onChange={(v) => useResumeStore.getState().setField(`work[${i}].summary`, v)} />
          </FieldRow>
        </EntryCard>
      ))}
    </SectionCard>
  )
}

function ProjectsForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.projects)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible } = useResumeStore.getState()

  return (
    <SectionCard section="projects" title={t('editor.section.projects')} onAdd={() => appendItem('projects', undefined)} addLabel={t('editor.action.add')}>
      {items.length === 0 ? <div className="py-4 text-center text-xs text-foreground/50">{t('editor.emptySection')}</div> : null}
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
            <TiptapField value={item.description as never} onChange={(v) => useResumeStore.getState().setField(`projects[${i}].description`, v)} />
          </FieldRow>
        </EntryCard>
      ))}
    </SectionCard>
  )
}

function SkillsForm(): React.JSX.Element {
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

function CertificatesForm(): React.JSX.Element {
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

function LanguagesForm(): React.JSX.Element {
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

/* ── 主组件 ─────────────────────────────────────────────────────────────── */

export function EditorPane(): React.JSX.Element {
  const activeSection = useResumeStore((s) => s.activeSection)
  const setActiveSection = useResumeStore((s) => s.setActiveSection)
  const activeFieldPath = useResumeStore((s) => s.activeFieldPath)
  const containerRef = useRef<HTMLDivElement>(null)

  // 预览反查：切到目标 section + 滚动 + 高亮闪烁（§3.7）
  useEffect(() => {
    if (!activeFieldPath) return
    const { section } = parsePath(activeFieldPath)
    if (section === 'layout') return
    if (section !== activeSection) setActiveSection(section)
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(`[data-section="${section}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) // 2026-08-07：nearest 只在目标不可见时才滚，不强行拉顶（避免点击编辑时整体上移）
        el.classList.add('rm-flash')
        setTimeout(() => el.classList.remove('rm-flash'), 1200)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [activeFieldPath, activeSection, setActiveSection])

  const renderForm = (): React.JSX.Element => {
    switch (activeSection) {
      case 'basics':
        return <BasicsForm />
      case 'summary':
        return <SummaryForm />
      case 'education':
        return <EducationForm />
      case 'work':
        return <WorkForm />
      case 'projects':
        return <ProjectsForm />
      case 'skills':
        return <SkillsForm />
      case 'certificates':
        return <CertificatesForm />
      case 'languages':
        return <LanguagesForm />
      default:
        return <BasicsForm />
    }
  }

  return (
    <div className="editor-pane" ref={containerRef}>
      <LayoutBar />
      <div className="editor-scroll-body">
        <div data-section={activeSection}>{renderForm()}</div>
      </div>
    </div>
  )
}
