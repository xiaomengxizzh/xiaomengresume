/**
 * TemplateSettingsEditor —— M5 A4 全局模板参数编辑（模板设置主功能）
 * 编辑对象 = SettingsSchema.templates[templateId]（用户覆盖层）；出厂值 = TEMPLATE_PRESETS + 默认。
 * 交互（P1-13 实时预览，2026-08-21 用户拍板推翻 A2「保存后更新」）：草稿 300ms 防抖仅本地合并
 * 驱动预览实时联动；持久化仍只在点「保存」时发生；卸载未保存自动回滚。
 * 「还原」= 清该模板覆盖回出厂。
 * 入口接入在 M5-5 模板设置屏；本组件可独立渲染（供 M5-5 复用）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { TEMPLATE_PRESETS } from '@shared/templates/layout'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import type { TemplateOverride } from '@shared/schema/settings'
import { Button } from '../ui'
import { DEFAULT_THEME_COLOR, THEME_COLOR_PRESETS } from '@shared/constants/theme-colors'

interface Props {
  templateId: string
}

/** 数值滑杆（range）字段元数据：min/max/step */
const NUM_FIELDS: Array<{ key: keyof TemplateOverride; min: number; max: number; step: number; labelKey: string }> = [
  { key: 'baseFontSize', min: 9, max: 24, step: 1, labelKey: 'settings.templates.baseFontSize' },
  { key: 'lineHeight', min: 1, max: 3, step: 0.1, labelKey: 'settings.templates.lineHeight' },
  { key: 'pagePadding', min: 0, max: 80, step: 2, labelKey: 'settings.templates.pagePadding' },
  { key: 'paragraphSpacing', min: 0, max: 40, step: 1, labelKey: 'settings.templates.paragraphSpacing' },
  { key: 'sectionSpacing', min: 0, max: 60, step: 1, labelKey: 'settings.templates.sectionSpacing' },
  { key: 'headerSize', min: 12, max: 36, step: 1, labelKey: 'settings.templates.headerSize' }
]

const TITLE_STYLES = ['underline', 'accent-bar', 'compact'] as const

export function TemplateSettingsEditor({ templateId }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useResumeStore((s) => s.settings)
  const setSettings = useResumeStore((s) => s.setSettings)
  const preset = TEMPLATE_PRESETS[templateId] ?? TEMPLATE_PRESETS.classic

  /** 草稿：出厂值 ⊕ 当前覆盖（未保存前编辑不生效——A2「保存后才更新预览」） */
  const [draft, setDraft] = useState<TemplateOverride>(() => ({
    baseFontSize: preset.baseFontSize,
    lineHeight: preset.lineHeight,
    pagePadding: preset.pagePadding,
    paragraphSpacing: preset.paragraphSpacing,
    sectionSpacing: preset.sectionSpacing,
    headerSize: preset.headerSize,
    resumeFont: settings.templates?.[templateId]?.resumeFont ?? 'system',
    themeColor: settings.templates?.[templateId]?.themeColor ?? DEFAULT_THEME_COLOR,
    titleStyle: settings.templates?.[templateId]?.titleStyle
  }))
  const hasOverride = useMemo(() => Boolean(settings.templates?.[templateId]), [settings.templates, templateId])

  // ── P1-13 模板实时预览（2026-08-21 用户拍板推翻 A2「保存后更新」语义）──
  // 草稿变化 300ms 防抖「仅本地合并」（patchSettingsLocal，不触发 settings:set 持久化）驱动右侧真实渲染预览；
  // 持久化仍只在「保存」时发生；卸载未保存 → 回滚进入前快照（已保存则快照已更新，回滚无副作用）。
  // 脏判定相对首帧草稿：防「出厂值被固化为显式覆盖层」（无覆盖时仅浏览滑杆不产生 templates 键）。
  const initialDraftRef = useRef(draft)
  const snapshotRef = useRef<Record<string, TemplateOverride> | undefined>(settings.templates)
  const stripUndef = (o: TemplateOverride): TemplateOverride =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as TemplateOverride
  const isDirty = useMemo(
    () => JSON.stringify(stripUndef(draft)) !== JSON.stringify(stripUndef(initialDraftRef.current)),
    [draft]
  )
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => {
      useResumeStore.getState().patchSettingsLocal({
        templates: { ...(snapshotRef.current ?? {}), [templateId]: stripUndef(draft) }
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [isDirty, draft, templateId])
  // 卸载回滚（cleanup 读 ref 最新值：保存过 = 已保存快照；未保存 = 进入前快照）
  useEffect(() => {
    return () => {
      useResumeStore.getState().patchSettingsLocal({ templates: snapshotRef.current })
    }
  }, [])

  const save = (): void => {
    const nextTemplates = { ...(settings.templates ?? {}), [templateId]: stripUndef(draft) }
    setSettings({ templates: nextTemplates })
    snapshotRef.current = nextTemplates
    initialDraftRef.current = draft
  }
  const reset = (): void => {
    const next = { ...(settings.templates ?? {}) }
    delete next[templateId]
    setSettings({ templates: next })
    snapshotRef.current = next
    // 本地草稿回出厂（预览即时反映还原）；基线同步为出厂草稿 → isDirty 归零，防抖 effect 不回写覆盖层
    const factoryDraft: TemplateOverride = {
      baseFontSize: preset.baseFontSize,
      lineHeight: preset.lineHeight,
      pagePadding: preset.pagePadding,
      paragraphSpacing: preset.paragraphSpacing,
      sectionSpacing: preset.sectionSpacing,
      headerSize: preset.headerSize,
      resumeFont: 'system',
      themeColor: DEFAULT_THEME_COLOR,
      titleStyle: undefined
    }
    initialDraftRef.current = factoryDraft
    setDraft(factoryDraft)
  }

  const num = (key: keyof TemplateOverride): number => (draft[key] as number) ?? preset[key as keyof typeof preset] ?? 0
  const setNum = (key: keyof TemplateOverride, v: number): void => setDraft((d) => ({ ...d, [key]: v }))

  return (
    <div className="space-y-4">
      {NUM_FIELDS.map((f) => (
        <label key={f.key} className="block">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-foreground/80">{t(f.labelKey)}</span>
            <span className="text-xs text-foreground/50">{num(f.key)}</span>
          </div>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={num(f.key)}
            onChange={(e) => setNum(f.key, Number(e.target.value))}
            className="w-full accent-[var(--foreground)]"
          />
        </label>
      ))}

      {/* M5 A7 字体分离：模板默认字体（本简历覆盖在编辑器 LayoutBar 独立选择） */}
      <label className="block">
        <div className="mb-1 text-sm text-foreground/80">{t('settings.templates.resumeFont')}</div>
        <select
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
          value={draft.resumeFont ?? 'system'}
          onChange={(e) => setDraft((d) => ({ ...d, resumeFont: e.target.value }))}
        >
          <option value="system">{t('settings.templates.fontSystem')}</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.family}
            </option>
          ))}
        </select>
      </label>

      {/* 主题色（推荐色板） */}
      <div>
        <div className="mb-1 text-sm text-foreground/80">{t('settings.templates.themeColor')}</div>
        <div className="flex flex-wrap gap-2">
          {THEME_COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={t(c.labelKey)}
              aria-label={t(c.labelKey)}
              onClick={() => setDraft((d) => ({ ...d, themeColor: c.value }))}
              className={`h-6 w-6 rounded-full border transition-transform ${draft.themeColor === c.value ? 'scale-110 border-foreground' : 'border-border'}`}
              style={{ background: c.value }}
            />
          ))}
        </div>
      </div>

      {/* 节标题风格（三选一，覆盖 variant 默认） */}
      <div>
        <div className="mb-1 text-sm text-foreground/80">{t('settings.templates.titleStyle')}</div>
        <div className="flex gap-2">
          {TITLE_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, titleStyle: s }))}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                draft.titleStyle === s ? 'border-foreground bg-selected/40 text-foreground' : 'border-border text-foreground/70 hover:bg-selected/30'
              }`}
            >
              {t(`settings.templates.titleStyleOptions.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={reset} disabled={!hasOverride}>
          {t('settings.templates.reset')}
        </Button>
        <Button size="sm" variant="default" onClick={save}>
          {t('settings.templates.save')}
        </Button>
      </div>
    </div>
  )
}
