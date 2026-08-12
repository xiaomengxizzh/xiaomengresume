/**
 * TemplateSettingsEditor —— M5 A4 全局模板参数编辑（模板设置主功能）
 * 编辑对象 = SettingsSchema.templates[templateId]（用户覆盖层）；出厂值 = TEMPLATE_PRESETS + 默认。
 * 交互（A2 定案）：本地草稿编辑 → 点「保存」才写入 store/持久化 → 预览更新（非实时联动）。
 * 「还原」= 清该模板覆盖回出厂。
 * 入口接入在 M5-5 模板设置屏；本组件可独立渲染（供 M5-5 复用）。
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { TEMPLATE_PRESETS } from '@shared/templates/layout'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import type { TemplateOverride } from '@shared/schema/settings'
import { Button } from '../ui'
import { THEME_COLOR_PRESETS } from '@shared/constants/theme-colors'

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
    themeColor: settings.templates?.[templateId]?.themeColor ?? '#475569',
    titleStyle: settings.templates?.[templateId]?.titleStyle
  }))
  const hasOverride = useMemo(() => Boolean(settings.templates?.[templateId]), [settings.templates, templateId])

  const save = (): void => {
    setSettings({
      templates: { ...(settings.templates ?? {}), [templateId]: draft }
    })
  }
  const reset = (): void => {
    const next = { ...(settings.templates ?? {}) }
    delete next[templateId]
    setSettings({ templates: next })
    // 本地草稿回出厂（预览即时反映还原；若只想还原后仍可编辑，草稿保留出厂值）
    setDraft({
      baseFontSize: preset.baseFontSize,
      lineHeight: preset.lineHeight,
      pagePadding: preset.pagePadding,
      paragraphSpacing: preset.paragraphSpacing,
      sectionSpacing: preset.sectionSpacing,
      headerSize: preset.headerSize,
      resumeFont: 'system',
      themeColor: '#475569',
      titleStyle: undefined
    })
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
