/**
 * tags-block —— 标签信息模块（固定 6→8 格；每格选图案 + 自由编辑 label + 内容；旧字段自动注入）
 * （2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { ICON_CHOICES } from './IconPicker'
import { InfoIcon } from '../icons/InfoIcons'
import { getString, useField } from './form-kit'

/** 标签图标 → basics 固定字段映射（removeTag 删标签同步清固定字段；2026-08-13 需求② user=性别 star=年龄） */
const TAG_ICON_TO_FIELD: Record<string, string> = {
  phone: 'phone',
  mail: 'email',
  pin: 'location',
  globe: 'website',
  calendar: 'birthDate',
  briefcase: 'employmentStatus',
  user: 'gender',
  star: 'age'
}

/** P0-2 标签值格式校验（UI 层轻提示，对齐偏差①「格式校验归 UI 层」口径；按 icon 推断类型，onBlur 触发） */
export function validateTagValue(icon: string, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (icon === 'mail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'validation.email.invalid'
  if (icon === 'phone' && !/^[+()\d][\d\s()-]{4,19}$/.test(v)) return 'validation.phone.invalid'
  if ((icon === 'globe' || icon === 'link') && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/.test(v)) return 'validation.website.invalid'
  return null
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

export function TagsBlock(): React.JSX.Element {
  const { t } = useTranslation()
  const [customFields] = useField('basics.customFields')
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)
  const resumeId = useResumeStore((s) => s.resumeId)
  const MAX_TAGS = 8
  const fields = (customFields as Array<{ id: string; label: string; value: string; icon?: string }> | undefined) ?? []
  // P0-2：标签值 onBlur 校验错误（i18n key）；P0-3：排序/去重
  const [tagErr, setTagErr] = useState<Record<number, string | null>>({})

  const moveTag = (i: number, dir: -1 | 1): void => {
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    const next = [...fields]
    ;[next[i], next[j]] = [next[j], next[i]]
    setField('basics.customFields', next)
  }
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
      { icon: 'briefcase', label: labelForIcon('briefcase'), value: getString(b.employmentStatus) },
      // 2026-08-13 需求②：性别/年龄正式字段（gender=user / age=star 图标）随标签格展示
      { icon: 'user', label: labelForIcon('user'), value: getString(b.gender) },
      { icon: 'star', label: labelForIcon('star'), value: getString(b.age) }
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
      // C6（2026-08-25）：customFields 写入 + infoItems 清空合并为单次 setField('basics',…)——
      // 原两连发各记一条历史（Ctrl+Z 只回退一步，标签/infoItems 撕裂）；单次对象写入 = 一步完整回退。
      const nextBasics: typeof b = {
        ...b,
        customFields: merged.map((f) => ({ id: crypto.randomUUID(), label: f.label, value: f.value, icon: f.icon }))
      }
      // 迁移后清空 infoItems（防渲染兜底/再次显示旧标签）
      if ((b.infoItems ?? []).length > 0) nextBasics.infoItems = []
      setField('basics', nextBasics)
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
    // C6（2026-08-25）：删标签 + 清关联固定字段合并为单次对象写入 = 一步 Ctrl+Z 完整回退
    //（原两连发 setField 拆成两条历史，撤销后标签回来但固定字段仍空）。
    const next = fields.filter((_, idx) => idx !== i)
    const linkedField = cur ? TAG_ICON_TO_FIELD[cur.icon ?? ''] : undefined
    if (!linkedField) {
      setField('basics', { ...resume.basics, customFields: next })
      return
    }
    const nextBasics: typeof resume.basics = { ...resume.basics, customFields: next }
    ;(nextBasics as unknown as Record<string, unknown>)[linkedField] = ''
    setField('basics', nextBasics)
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
              className={`flex flex-col gap-1.5 rounded-lg border px-2 py-1.5 ${
                f ? (f.label && fields.some((x, xi) => xi !== i && x.label && x.label === f.label) ? 'border-danger' : 'border-border') : 'border-dashed border-border/70'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-foreground/40">{i + 1}</span>
                {/* 2026-08-10 需求 2：图案标签 combobox——文本框输 label + 下拉箭头列选图案 */}
                {/* P0-3：上移/下移排序（仅已填格显示；边界格 invisible 保持 DOM 稳定） */}
                {f ? (
                  <>
                    <button
                      type="button"
                      className={`shrink-0 px-0.5 text-[11px] ${i === 0 ? 'invisible' : 'text-foreground/40 transition-colors hover:text-foreground'}`}
                      title={t('editor.tag.moveUp')}
                      aria-label={t('editor.tag.moveUp')}
                      onClick={() => moveTag(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={`shrink-0 px-0.5 text-[11px] ${i >= fields.length - 1 ? 'invisible' : 'text-foreground/40 transition-colors hover:text-foreground'}`}
                      title={t('editor.tag.moveDown')}
                      aria-label={t('editor.tag.moveDown')}
                      onClick={() => moveTag(i, 1)}
                    >
                      ↓
                    </button>
                  </>
                ) : null}
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
                className={`min-w-0 flex-1 rounded-lg border bg-surface px-2 py-1.5 text-sm outline-none focus:border-foreground/50 ${
                  f ? (tagErr[i] ? 'border-danger' : 'border-border') : 'invisible border-border'
                }`}
                value={f?.value ?? ''}
                placeholder={f?.label || t('editor.field.customTitle')}
                onChange={(e) => {
                  if (!f) return
                  setTag(i, { value: e.target.value })
                  if (tagErr[i]) setTagErr((p) => ({ ...p, [i]: null }))
                }}
                onBlur={(e) => {
                  if (!f) return
                  setTagErr((p) => ({ ...p, [i]: validateTagValue(f.icon ?? '', e.target.value) }))
                }}
              />
              {tagErr[i] ? <span className="text-[10px] text-danger">{t(tagErr[i])}</span> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
