/**
 * TemplateBar —— 顶栏模板控制（2026-08-07 UI 重构）
 * 模板切换（classic/modern/compact 占位）+ 主题色（推荐色板 + 自定义调色板，用户需求：
 * 多数用户不擅长调色板，倾向直接选常用颜色）+ 字体下拉。写入 layout.*（per-resume，进 F3 撤销栈）。
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import { THEME_COLOR_PRESETS, DEFAULT_THEME_COLOR } from '@shared/constants/theme-colors'
import { Select } from '../ui'

/** M2 模板 registry 的 id 占位（F4 定案 3 套） */
export const TEMPLATE_IDS = ['classic', 'modern', 'compact'] as const

export function TemplateBar(): React.JSX.Element {
  const { t } = useTranslation()
  const layout = useResumeStore((s) => s.resume.layout)
  const setField = useResumeStore((s) => s.setField)

  const templateId = layout?.templateId ?? 'classic'
  const themeColor = layout?.themeColor ?? DEFAULT_THEME_COLOR
  const resumeFont = layout?.resumeFont ?? 'system'

  const setTheme = (color: string): void => setField('layout.themeColor', color)

  // UI-2（2026-08-21 诊断 B1）：10 色板常驻改「当前色圆点 + 弹出面板」——顶栏降噪；
  // 面板交互仿 IconCombo 下拉（点外关闭）
  const [paletteOpen, setPaletteOpen] = useState(false)
  const paletteRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!paletteOpen) return
    const onDocClick = (e: MouseEvent): void => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [paletteOpen])

  return (
    <div className="flex items-center gap-3">
      <label className="flex items-center gap-1.5 text-xs text-foreground/70">
        {t('editor.templateLabel')}
        <Select
          className="!w-auto !py-1 text-xs"
          value={templateId}
          onChange={(e) => setField('layout.templateId', e.target.value)}
        >
          {TEMPLATE_IDS.map((id) => (
            <option key={id} value={id}>
              {t(`editor.template.${id}`)}
            </option>
          ))}
        </Select>
      </label>

      {/* 主题色（UI-2 收敛）：当前色圆点 → 弹出面板（10 预设 + 自定义）；预设选中态高亮。
          2026-08-09 修复口径保留：swatch 不嵌套 label（无效 HTML 吞点击）。 */}
      <div ref={paletteRef} className="relative flex items-center gap-1.5 text-xs text-foreground/70">
        <span className="shrink-0" title={t('editor.themeColor')}>
          {t('editor.themeColor')}
        </span>
        <button
          type="button"
          className={`theme-swatch ${paletteOpen ? 'active' : ''}`}
          style={{ background: themeColor }}
          title={t('editor.themeColor')}
          aria-expanded={paletteOpen}
          aria-haspopup="dialog"
          onClick={() => setPaletteOpen((o) => !o)}
        />
        {paletteOpen ? (
          <div
            role="dialog"
            aria-label={t('editor.themeColor')}
            className="absolute right-0 top-full z-20 mt-1 flex w-[172px] flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-card-hover"
          >
            <span className="theme-swatches">
              {THEME_COLOR_PRESETS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`theme-swatch ${themeColor === c.value ? 'active' : ''}`}
                  style={{ background: c.value }}
                  title={t(c.labelKey)}
                  onClick={() => setTheme(c.value)}
                />
              ))}
            </span>
            <label className="flex items-center justify-between gap-2 text-[11px] text-foreground/60">
              {t('themeColor.custom')}
              <input
                type="color"
                className="theme-custom-input"
                value={themeColor}
                onChange={(e) => setTheme(e.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-foreground/70">
        {t('editor.fontLabel')}
        <Select
          className="!w-auto !py-1 text-xs"
          value={resumeFont}
          onChange={(e) => setField('layout.resumeFont', e.target.value)}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.labelKey)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  )
}
