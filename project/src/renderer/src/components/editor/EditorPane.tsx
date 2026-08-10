/**
 * EditorPane —— F2 编辑器表单区（§3.2/§3.3/§3.7，2026-08-07 UI 重构）
 * 分区切换由左侧 NavBar 接管（原顶部 chips 移除）；顶部排版条（LayoutBar）+ 当前 section 表单卡片；
 * 单元级工具：字体选择 + AI 润色占位；预览反查驱动滚动 + 高亮闪烁。
 * 全部走 i18n key（禁硬编码中文，CH4 扫描）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'
import { useResumeStore } from '../../store/useResumeStore'
import { getByPath, parsePath } from '@shared/paths'
import { SKILL_LEVELS, LANGUAGE_PROFICIENCIES } from '@shared/schema/resume'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import { Button, Select } from '../ui'
import { TextField, DateField, SelectField } from '../fields'
import { TiptapField } from '../tiptap/TiptapField'
import { LayoutBar } from './LayoutBar'
import { ICON_CHOICES } from './IconPicker'
import { InfoIcon } from '../icons/InfoIcons'
import { AiAssistPanel } from './AiAssistPanel'

/* ── M3 F7/F8：字段编辑器注册表 + 白名单 ────────────────────────────────── */

/** TiptapField onEditorReady 登记（润色/语法取实例读选区/替换） */
const fieldEditorRegistry = new Map<string, Editor>()

function registerFieldEditor(path: string, editor: Editor | null): void {
  if (editor) fieldEditorRegistry.set(path, editor)
  else fieldEditorRegistry.delete(path)
}

/** 润色/语法白名单 section → 首选字段（F7 白名单；basics 数据型字段不出入口） */
const POLISH_FIELDS: Record<string, string> = {
  summary: 'summary.content',
  education: 'education[0].description',
  work: 'work[0].summary',
  projects: 'projects[0].description'
}

/** 由主组件注入的 AI 辅助面板打开函数（Form 内 SectionCard 按钮回调） */
let openAssist: ((kind: 'polish' | 'grammar', field: string) => void) | null = null

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
  onPolish,
  onGrammar,
  children
}: {
  title: string
  section?: string
  onAdd?: () => void
  addLabel?: string
  /** M3 F7：AI 润色入口（仅白名单 section 提供） */
  onPolish?: () => void
  /** M3 F8：语法检查入口（仅白名单 section 提供） */
  onGrammar?: () => void
  children: ReactNode
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <section className="section-card">
      <div className="section-card-header">
        <h3 className="text-[15px] font-medium">{title}</h3>
        <div className="section-toolbar">
          {section ? <SectionFontSelect section={section} /> : null}
          {onPolish ? (
            <Button size="sm" variant="ghost" onClick={onPolish}>
              ✨ {t('editor.aiAssist')}
            </Button>
          ) : null}
          {onGrammar ? (
            <Button size="sm" variant="ghost" onClick={onGrammar}>
              {t('editor.grammarCheck')}
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
  const { t } = useTranslation()
  return (
    <div className="entry-card">
      <div className="entry-card-header">
        <span className="entry-title">{title || '…'}</span>
        {visible === false ? (
          <span className="shrink-0 rounded-full bg-border/50 px-1.5 py-0.5 text-[10px] text-foreground/55">
            {t('editor.entryHidden')}
          </span>
        ) : null}
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

/* ── 基本信息三透明模块（2026-08-09 R6：图片/姓名与职业/标签信息，主分区内联编辑 + 可拖拽排序） ── */

/** 图片模块（照片选择；canvas 压缩 ≤2MB → dataURL） */
function PhotoBlock(): React.JSX.Element {
  const { t } = useTranslation()
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)

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
    <div className="flex items-center gap-3">
      {resume.basics.photo ? (
        <img
          src={resume.basics.photo}
          alt=""
          className="rounded object-cover"
          style={{ width: Math.min(resume.basics.photoWidth ?? 48, 96), height: Math.min(resume.basics.photoHeight ?? 64, 128), objectFit: 'cover' }}
        />
      ) : null}
      <label className="inline-flex cursor-pointer select-none items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border/40">
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
  )
}

/** 姓名与职业模块（中文名必显 + 职业固定框） */
function IdentityBlock(): React.JSX.Element {
  const { t } = useTranslation()
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)
  return (
    <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
      <FieldRow label={t('editor.field.name')}>
        <TextField value={getString(resume.basics.name)} onCommit={(v) => setField('basics.name', v)} />
      </FieldRow>
      <FieldRow label={t('editor.field.jobTitle')}>
        <TextField value={getString(resume.basics.headline)} placeholder={t('editor.field.headline')} onCommit={(v) => setField('basics.headline', v)} />
      </FieldRow>
    </div>
  )
}

/**
 * 2026-08-10 需求 2：图案标签 combobox——文本框（可直接输入自定义标签名）+ 右侧向下箭头
 * → 下拉列式展示图案选项（参考岗位状态 select 交互）；选图标后 label 自动填图标名。
 * 2026-08-10 修复：定义在模块顶层（TagsBlock 外）——函数引用稳定，防 TagsBlock re-render
 * 时组件类型变化致重挂（实测输入即失焦：input 被移出 DOM）。
 */
function IconCombo({
  icon,
  label,
  onIconChange,
  onLabelChange
}: {
  icon: string
  label: string
  onIconChange: (id: string) => void
  onLabelChange: (label: string) => void
}): React.JSX.Element {
  const { t } = useTranslation() // 顶层组件自行取 t
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])
  const pick = (id: string): void => {
    onIconChange(id)
    setOpen(false)
  }
  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <div className="flex items-center rounded-lg border border-border bg-surface focus-within:border-foreground/50">
        <input
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs outline-none"
          value={label}
          placeholder={t('editor.field.customTitle')}
          onChange={(e) => onLabelChange(e.target.value)}
        />
        <button
          type="button"
          className="shrink-0 px-1.5 text-foreground/50 transition-colors hover:text-foreground"
          title={t('editor.field.customFieldLabel')}
          onClick={() => setOpen((o) => !o)}
        >
          ▾
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-card-hover">
          {ICON_CHOICES.map((id) => {
            const name = id ? t(`editor.infoIcon.${id}`) : t('editor.field.tagNoIcon')
            const selected = icon === id
            return (
              <button
                key={id || 'none'}
                type="button"
                onClick={() => pick(id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-border/40 ${
                  selected ? 'text-foreground' : 'text-foreground/70'
                }`}
              >
                {id ? <InfoIcon id={id as never} className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0" />}
                <span className="truncate">{name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 标签信息模块（固定 6 格；每格选图案 + 自由编辑 label + 内容；旧字段自动注入） */function TagsBlock(): React.JSX.Element {
  const { t } = useTranslation()
  const [customFields] = useField('basics.customFields')
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)
  const resumeId = useResumeStore((s) => s.resumeId)
  const MAX_TAGS = 8
  const fields = (customFields as Array<{ id: string; label: string; value: string; icon?: string }> | undefined) ?? []
  // 2026-08-10 修复：注入仅一次（同一简历删除全部标签后不重注入旧字段）
  const injectedRef = useRef<string | null>(null)

  // 图案选项（label 走 i18n editor.infoIcon.*；2026-08-09 R5 扩至 10 个）
  const ICON_OPTIONS: Array<{ value: string; label: string }> = [
    { value: '', label: t('editor.field.tagNoIcon') },
    { value: 'phone', label: t('editor.infoIcon.phone') },
    { value: 'mail', label: t('editor.infoIcon.mail') },
    { value: 'pin', label: t('editor.infoIcon.pin') },
    { value: 'globe', label: t('editor.infoIcon.globe') },
    { value: 'calendar', label: t('editor.infoIcon.calendar') },
    { value: 'briefcase', label: t('editor.infoIcon.briefcase') },
    { value: 'link', label: t('editor.infoIcon.link') },
    { value: 'user', label: t('editor.infoIcon.user') },
    { value: 'star', label: t('editor.infoIcon.star') },
    { value: 'map', label: t('editor.infoIcon.map') }
  ]
  const labelForIcon = (icon: string): string => {
    const o = ICON_OPTIONS.find((x) => x.value === icon)
    return o && o.value ? o.label : ''
  }

  // 旧字段自动注入自定义字段（双向绑定；对照示例 6 项 + 图标）
  useEffect(() => {
    // 2026-08-10 修复：同一简历只注入/迁移一次——删除全部标签后不重注入（injectedRef 守卫）
    if (injectedRef.current === resumeId) return
    injectedRef.current = resumeId
    const b = resume.basics
    const legacy: Array<{ icon: string; label: string; value: string }> = [
      { icon: 'phone', label: labelForIcon('phone'), value: getString(b.phone) },
      { icon: 'mail', label: labelForIcon('mail'), value: getString(b.email) },
      { icon: 'pin', label: labelForIcon('pin'), value: getString(b.location) },
      { icon: 'globe', label: labelForIcon('globe'), value: getString(b.website) },
      { icon: 'calendar', label: labelForIcon('calendar'), value: getString(b.birthDate) },
      { icon: 'briefcase', label: labelForIcon('briefcase'), value: getString(b.employmentStatus) }
    ].filter((f) => f.value.length > 0)
    // 2026-08-10 修复：旧 infoItems（双数据源）并入 customFields——编辑区与简历显示统一为
    // customFields 单一来源（用户编辑/删除标签才真正反映到简历；原显示 infoItems 致编辑不生效）
    const fromInfo = (b.infoItems ?? [])
      .filter((it) => it.value)
      .map((it) => ({ icon: it.icon ?? '', label: it.label ?? '', value: it.value }))
    const merged = [...fromInfo, ...legacy].filter(
      (f, i, arr) => arr.findIndex((x) => x.value === f.value) === i // 同值去重（infoItems 优先）
    )
    if (merged.length > 0) {
      setField(
        'basics.customFields',
        merged.map((f) => ({ id: crypto.randomUUID(), label: f.label, value: f.value, icon: f.icon }))
      )
      // 迁移后清空 infoItems（防渲染兜底/再次显示旧标签）
      if ((b.infoItems ?? []).length > 0) setField('basics.infoItems', [])
    }
    // 仅随 resume 加载/变化触发一次（injectedRef 标记，删除/编辑后不再注入）
  }, [resume, resumeId])

  const setTag = (i: number, patch: { icon?: string; label?: string; value?: string }): void => {
    const cur = fields[i]
    if (!cur) {
      // 空位首次填写：按图标自动设 label
      const icon = patch.icon ?? ''
      setField('basics.customFields', [...fields, { id: crypto.randomUUID(), label: patch.label ?? labelForIcon(icon), value: patch.value ?? '', icon }])
      return
    }
    const key = Object.keys(patch)[0]
    setField(`basics.customFields[${i}].${key}`, Object.values(patch)[0])
  }

  const removeTag = (i: number): void => {
    const cur = fields[i]
    // 2026-08-10 修复：删除标签格同步清除对应 basics 固定字段——防预览/导出 fallback
    //（contactItems 仅 infoItems 空时拼接 basics 字段）仍显示已删标签（用户"删除标签简历仍显示"）
    if (cur) {
      const iconToField: Record<string, string> = {
        phone: 'phone',
        mail: 'email',
        pin: 'location',
        globe: 'website',
        calendar: 'birthDate',
        briefcase: 'employmentStatus'
      }
      const field = iconToField[cur.icon ?? '']
      if (field) setField(`basics.${field}`, '')
    }
    const next = fields.filter((_, idx) => idx !== i)
    setField('basics.customFields', next)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground/70">{t('editor.field.customFieldLabel')}</span>
        <span className="text-[11px] text-foreground/40">
          {fields.length}/{MAX_TAGS}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {Array.from({ length: MAX_TAGS }).map((_, i) => {
          const f = fields[i]
          // 2026-08-10 修复：空位/有值格渲染完全一致的 DOM 树（value 框/✕ 始终渲染，空位用
          // invisible 隐藏不移除节点）——两分支结构不同（单行 vs 双行）致创建时 React 重建子树
          // → combobox input 重挂 → 输入即失焦（实测 isConnected=false）
          return (
            <div
              key={'tag-' + i}
              className={`flex flex-col gap-1.5 rounded-lg border px-2 py-1.5 ${f ? 'border-border' : 'border-dashed border-border/70'}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-foreground/40">{i + 1}</span>
                {/* 2026-08-10 需求 2：图案标签 combobox——文本框输 label + 下拉箭头列选图案 */}
                <IconCombo
                  icon={f?.icon ?? ''}
                  label={f?.label ?? ''}
                  onIconChange={(v) => {
                    setTag(i, { icon: v })
                    // 2026-08-10 需求：主动选图案 → 替换文字（label = 图案名，文字/图案互斥）
                    if (f) setTag(i, { label: labelForIcon(v) })
                  }}
                  onLabelChange={(v) => {
                    setTag(i, { label: v })
                    // 2026-08-10 需求：输入文字 → 替换图案（文字标签无图案；输入非空才清）
                    if (v && f?.icon) setTag(i, { icon: '' })
                  }}
                />
                <button
                  type="button"
                  className={`shrink-0 px-1 text-foreground/40 transition-colors hover:text-danger ${f ? '' : 'invisible'}`}
                  title={t('resumesJobs.delete')}
                  onClick={() => f && removeTag(i)}
                >
                  ✕
                </button>
              </div>
              <input
                className={`min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-foreground/50 ${f ? '' : 'invisible'}`}
                value={f?.value ?? ''}
                placeholder={f?.label || t('editor.field.customTitle')}
                onChange={(e) => f && setTag(i, { value: e.target.value })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryForm(): React.JSX.Element {
  const { t } = useTranslation()
  const [content, setContent] = useField('summary.content')
  const enContent = useResumeStore((s) => s.resume.summary.enContent)
  const [lang, setLang] = useState<'zh' | 'en'>('zh')
  const setEnContent = (v: unknown): void => useResumeStore.getState().setField('summary.enContent', v)
  return (
    <SectionCard
      section="summary"
      title={t('editor.section.summary')}
      onPolish={() => openAssist?.('polish', POLISH_FIELDS.summary)}
      onGrammar={() => openAssist?.('grammar', POLISH_FIELDS.summary)}
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

function EducationForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.education)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible } = useResumeStore.getState()

  return (
    <SectionCard
      section="education"
      title={t('editor.section.education')}
      onAdd={() => appendItem('education', undefined)}
      addLabel={t('editor.action.add')}
      onPolish={() => openAssist?.('polish', POLISH_FIELDS.education)}
      onGrammar={() => openAssist?.('grammar', POLISH_FIELDS.education)}
    >
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

function WorkForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.work)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible } = useResumeStore.getState()

  return (
    <SectionCard
      section="work"
      title={t('editor.section.work')}
      onAdd={() => appendItem('work', undefined)}
      addLabel={t('editor.action.add')}
      onPolish={() => openAssist?.('polish', POLISH_FIELDS.work)}
      onGrammar={() => openAssist?.('grammar', POLISH_FIELDS.work)}
    >
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

function ProjectsForm(): React.JSX.Element {
  const { t } = useTranslation()
  const items = useResumeStore((s) => s.resume.projects)
  const { appendItem, duplicateItem, removeItem, toggleItemVisible } = useResumeStore.getState()

  return (
    <SectionCard
      section="projects"
      title={t('editor.section.projects')}
      onAdd={() => appendItem('projects', undefined)}
      addLabel={t('editor.action.add')}
      onPolish={() => openAssist?.('polish', POLISH_FIELDS.projects)}
      onGrammar={() => openAssist?.('grammar', POLISH_FIELDS.projects)}
    >
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

/* ── 自定义模块 + 模块排序（2026-08-09 模块化编辑入口）────────────────────── */

/** 内置可排序板块默认顺序（与模板 DEFAULT_SECTION_ORDER 一致；basics/summary 固定顶部） */
export const DEFAULT_MODULE_ORDER = ['education', 'work', 'projects', 'skills', 'certificates', 'languages']

/** 2026-08-09 T3：模块主分区卡片图标（emoji，按模块类型） */
const MODULE_ICONS: Record<string, string> = {
  education: '🎓',
  work: '💼',
  projects: '🚀',
  skills: '⚙️',
  certificates: '📜',
  languages: '🌐'
}

/** 自定义模块表单（非基本信息；可编辑标题 + 富文本正文 + 删除） */
function CustomSectionForm({ id }: { id: string }): React.JSX.Element {
  const { t } = useTranslation()
  const resume = useResumeStore((s) => s.resume)
  const setField = useResumeStore((s) => s.setField)
  const idx = (resume.customSections ?? []).findIndex((c) => c.id === id)
  if (idx < 0) return <></>
  const section = resume.customSections![idx]

  return (
    <SectionCard title={t('editor.section.custom')}>
      <FieldRow label={t('editor.module.title')}>
        <TextField value={section.title} onCommit={(v) => setField(`customSections[${idx}].title`, v)} />
      </FieldRow>
      <FieldRow label={t('editor.field.content')}>
        <TiptapField
          value={section.content as never}
          onChange={(v) => setField(`customSections[${idx}].content`, v)}
          onEditorReady={(ed) => registerFieldEditor(`customSections[${idx}].content`, ed)}
        />
      </FieldRow>
      <div className="mt-1 flex justify-end">
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            const next = (resume.customSections ?? []).filter((c) => c.id !== id)
            setField('customSections', next)
            // 同步从排序中移除
            const order = (resume.layout?.sectionOrder ?? []).filter((m) => m !== id)
            setField('layout.sectionOrder', order)
          }}
        >
          {t('editor.module.remove')}
        </Button>
      </div>
    </SectionCard>
  )
}

/** 拖拽排序手柄（HTML5 DnD：仅手柄可拖，避免干扰表单输入） */
function ModuleDragHandle({
  id,
  onDragStart,
  onDragEnd
}: {
  id: string
  onDragStart: (id: string) => void
  onDragEnd: () => void
}): React.JSX.Element {
  return (
    <span
      draggable
      title="⋮⋮"
      className="module-drag-handle"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(id)
      }}
      onDragEnd={onDragEnd}
    >
      ⋮⋮
    </span>
  )
}

/* ── 主组件 ─────────────────────────────────────────────────────────────── */

export function EditorPane(): React.JSX.Element {
  const { t } = useTranslation()
  const activeSection = useResumeStore((s) => s.activeSection)
  const setActiveSection = useResumeStore((s) => s.setActiveSection)
  const setActiveFieldPath = useResumeStore((s) => s.setActiveFieldPath)
  const activeFieldPath = useResumeStore((s) => s.activeFieldPath)
  const resumeId = useResumeStore((s) => s.resumeId)
  const jobId = useResumeStore((s) => s.aiContext.jobId)
  const containerRef = useRef<HTMLDivElement>(null)

  /** M3 F7/F8：AI 辅助面板会话（polish/grammar + 目标字段 + 选区冻结快照） */
  const [assist, setAssist] = useState<{
    kind: 'polish' | 'grammar'
    field: string
    frozen: { from: number; to: number; text: string } | null
  } | null>(null)

  // 注入 SectionCard 按钮的打开函数（Form 内按钮经模块级 openAssist 回调）
  useEffect(() => {
    openAssist = (kind, field) => {
      if (!resumeId) return
      const raw = fieldEditorRegistry.get(field)
      const editor = raw && !raw.isDestroyed ? raw : null
      let frozen: { from: number; to: number; text: string } | null = null
      if (kind === 'polish' && editor) {
        const { from, to } = editor.state.selection
        if (from !== to) {
          frozen = { from, to, text: editor.state.doc.textBetween(from, to) }
        }
      }
      setAssist({ kind, field, frozen })
    }
    return () => {
      openAssist = null
    }
  }, [resumeId])

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

  /* ── 模块列表（2026-08-09 模块化编辑入口）───────────────────────────────
     进入编辑器默认展示全部模块卡片（非单卡）；basics/summary 固定顶部；
     可排序板块 + 自定义模块按 layout.sectionOrder 排列，拖拽手柄重排。 */
  const resume = useResumeStore((s) => s.resume)
  const setField = useResumeStore((s) => s.setField)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  const customIds = (resume.customSections ?? []).map((c) => c.id)
  const order = resume.layout?.sectionOrder?.length ? resume.layout.sectionOrder : DEFAULT_MODULE_ORDER
  const modules = order.filter((id) => DEFAULT_MODULE_ORDER.includes(id) || customIds.includes(id))
  for (const cid of customIds) {
    if (!modules.includes(cid)) modules.push(cid) // 未入序的自定义模块追加尾部
  }

  const BUILTIN_FORMS: Record<string, () => React.JSX.Element> = {
    education: () => <EducationForm />,
    work: () => <WorkForm />,
    projects: () => <ProjectsForm />,
    skills: () => <SkillsForm />,
    certificates: () => <CertificatesForm />,
    languages: () => <LanguagesForm />
  }

  /* R6：基本信息三透明模块（图片/姓名与职业/标签信息）——主分区内联编辑 + 拖拽排序（basicsOrder） */
  const BASIC_BLOCK_IDS = ['photo', 'identity', 'tags'] as const
  const basicsOrder = resume.layout?.basicsOrder?.length
    ? resume.layout.basicsOrder
    : [...BASIC_BLOCK_IDS]
  const BASIC_BLOCK_TITLES: Record<string, string> = {
    photo: t('editor.basicsBlock.photo'),
    identity: t('editor.basicsBlock.identity'),
    tags: t('editor.basicsBlock.tags')
  }
  const [basicDrag, setBasicDrag] = useState<string | null>(null)
  const [basicDrop, setBasicDrop] = useState<string | null>(null)
  const handleBasicDrop = (targetId: string): void => {
    setBasicDrop(null)
    if (!basicDrag || basicDrag === targetId) return
    const list = basicsOrder.filter((id) => id !== basicDrag) as Array<'photo' | 'identity' | 'tags'>
    const idx = list.indexOf(targetId as 'photo' | 'identity' | 'tags')
    list.splice(idx < 0 ? list.length : idx, 0, basicDrag as 'photo' | 'identity' | 'tags')
    setField('layout.basicsOrder', list)
    setBasicDrag(null)
  }

  const handleDrop = (targetId: string): void => {
    setDropTarget(null)
    if (!dragId || dragId === targetId) return
    const list = modules.filter((id) => id !== dragId)
    const idx = list.indexOf(targetId)
    list.splice(idx < 0 ? list.length : idx, 0, dragId)
    setField('layout.sectionOrder', list)
    setDragId(null)
  }

  const addCustomModule = (): void => {
    const title = window.prompt(t('editor.module.prompt')) ?? ''
    if (!title.trim()) return
    const id = crypto.randomUUID()
    const next = [
      ...(resume.customSections ?? []),
      { id, title: title.trim(), content: { type: 'doc', content: [] } as never }
    ]
    setField('customSections', next)
    setField('layout.sectionOrder', modules.concat([id]))
  }

  return (
    <div className="editor-pane" ref={containerRef}>
      <LayoutBar />
      <div className="editor-scroll-body">
        {activeSection === null || activeSection === 'basics' ? (
          /* ── 模块主分区（2026-08-09 R6）：基本信息三透明模块内联顶部 + 其余模块卡网格 ── */
          <>
            <div className="basics-inline" data-section="basics">
              {basicsOrder.map((bid) => (
                <div
                  key={bid}
                  className={`basics-module ${basicDrop === bid ? 'module-card-dragover' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setBasicDrop(bid)
                  }}
                  onDragLeave={() => setBasicDrop((d) => (d === bid ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleBasicDrop(bid)
                  }}
                >
                  <ModuleDragHandle id={bid} onDragStart={setBasicDrag} onDragEnd={() => setBasicDrag(null)} />
                  <div className="basics-module-title">{BASIC_BLOCK_TITLES[bid] ?? bid}</div>
                  {bid === 'photo' ? <PhotoBlock /> : bid === 'identity' ? <IdentityBlock /> : <TagsBlock />}
                </div>
              ))}
            </div>
            <div className="module-grid">
              <button type="button" className="module-card module-card-tile" onClick={() => setActiveSection('summary')}>
                <span className="module-tile-icon" aria-hidden>✍️</span>
                <span className="module-tile-title">{t('editor.section.summary')}</span>
              </button>
              {modules.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`module-card module-card-tile ${dropTarget === id ? 'module-card-dragover' : ''}`}
                  draggable
                  onDragStart={() => setDragId(id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDropTarget(id)
                  }}
                  onDragLeave={() => setDropTarget((d) => (d === id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(id)
                  }}
                  onClick={() => setActiveSection(id)}
                >
                  <ModuleDragHandle id={id} onDragStart={setDragId} onDragEnd={() => setDragId(null)} />
                  <span className="module-tile-icon" aria-hidden>
                    {MODULE_ICONS[id] ?? '📄'}
                  </span>
                  <span className="module-tile-title">
                    {id === 'custom' ? t('editor.section.custom') : DEFAULT_MODULE_ORDER.includes(id) ? t(`editor.section.${id}`) : (resume.customSections?.find((c) => c.id === id)?.title ?? t('editor.section.custom'))}
                  </span>
                </button>
              ))}
            </div>
            <div className="module-add-row">
              <Button variant="outline" onClick={addCustomModule}>
                ＋ {t('editor.module.add')}
              </Button>
            </div>
          </>
        ) : (
          /* ── 单模块编辑分区（一次仅显示一个；左上返回按钮回模块主分区）── */
          <div data-section={activeSection} className="module-edit-pane">
            <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2">
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
                onClick={() => {
                  setActiveSection(null)
                  // 2026-08-09 T4 修复：清反查路径——否则预览反查 effect（activeFieldPath 残留）
                  // 随 activeSection 变化重跑，用旧路径立即把视图拉回分区，返回键失效
                  setActiveFieldPath(null)
                }}
              >
                ← {t('common.back')}
              </button>
              <h3 className="text-sm font-semibold text-foreground">
                {activeSection === 'basics' || activeSection === 'summary' || DEFAULT_MODULE_ORDER.includes(activeSection)
                  ? t(`editor.section.${activeSection}`)
                  : (resume.customSections?.find((c) => c.id === activeSection)?.title ?? t('editor.section.custom'))}
              </h3>
            </div>
            {activeSection === 'summary' ? (
              <SummaryForm />
            ) : BUILTIN_FORMS[activeSection]?.() ?? <CustomSectionForm id={activeSection} />}
          </div>
        )}
      </div>
      {assist ? (
        <AiAssistPanel
          kind={assist.kind}
          resumeId={resumeId ?? ''}
          jobId={jobId}
          field={assist.field}
          editor={
            (() => {
              const raw = fieldEditorRegistry.get(assist.field)
              return raw && !raw.isDestroyed ? raw : null
            })()
          }
          frozen={assist.frozen}
          onClose={() => setAssist(null)}
        />
      ) : null}
    </div>
  )
}
