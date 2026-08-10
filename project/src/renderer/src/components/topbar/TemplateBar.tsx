/**
 * TemplateBar —— 顶栏模板控制（2026-08-07 UI 重构）
 * 模板切换（classic/modern/compact 占位）+ 主题色（推荐色板 + 自定义调色板，用户需求：
 * 多数用户不擅长调色板，倾向直接选常用颜色）+ 字体下拉。写入 layout.*（per-resume，进 F3 撤销栈）。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import { THEME_COLOR_PRESETS } from '@shared/constants/theme-colors'
import { Select } from '../ui'

/** M2 模板 registry 的 id 占位（F4 定案 3 套） */
export const TEMPLATE_IDS = ['classic', 'modern', 'compact'] as const

export function TemplateBar(): React.JSX.Element {
  const { t } = useTranslation()
  const layout = useResumeStore((s) => s.resume.layout)
  const setField = useResumeStore((s) => s.setField)

  const templateId = layout?.templateId ?? 'classic'
  const themeColor = layout?.themeColor ?? '#475569'
  const resumeFont = layout?.resumeFont ?? 'system'

  const setTheme = (color: string): void => setField('layout.themeColor', color)

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

      {/* 主题色：推荐色板（直接选）+ 自定义调色板（高级选项）
          2026-08-09 修复：swatch 移出 label——button 嵌套在 label 内属无效 HTML，
          浏览器吞掉 label 区域点击导致色板 swatch 点击无反应（用户反馈「样式按钮点击无反应」） */}
      <div className="flex items-center gap-1.5 text-xs text-foreground/70">
        <span className="shrink-0" title={t('editor.themeColor')}>
          {t('editor.themeColor')}
        </span>
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
          <input
            type="color"
            className="theme-custom-input"
            title={t('themeColor.custom')}
            value={themeColor}
            onChange={(e) => setTheme(e.target.value)}
          />
        </span>
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
