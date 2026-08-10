/**
 * IconPicker —— 基本信息标签图案选择器（2026-08-10 任务5）
 * 原生 <select> 的 <option> 无法渲染 SVG → 自定义行内横排图标按钮组：
 * 24×24 SVG 图标（复用 shared INFO_ICON_ELEMENTS 经 InfoIcon 渲染）+「无图标」占位，
 * Hover 浅底 / Selected 高亮边框；title 显示 i18n label 保可访问性。
 */
import { useTranslation } from 'react-i18next'
import { InfoIcon } from '../icons/InfoIcons'

export interface IconPickerProps {
  /** 当前选中 icon id（'' = 无图标） */
  value: string
  onChange: (icon: string) => void
}

/** 可选图案（空 + 10 图标；label 走 i18n editor.infoIcon.*）——TagsBlock combobox 下拉复用 */
export const ICON_CHOICES = ['', 'phone', 'mail', 'pin', 'globe', 'calendar', 'briefcase', 'link', 'user', 'star', 'map']

export function IconPicker({ value, onChange }: IconPickerProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1" role="radiogroup" aria-label={t('editor.field.customFieldLabel')}>
      {ICON_CHOICES.map((id) => {
        const label = id ? t(`editor.infoIcon.${id}`) : t('editor.field.tagNoIcon')
        const selected = value === id
        return (
          <button
            key={id || 'none'}
            type="button"
            role="radio"
            aria-checked={selected}
            title={label}
            aria-label={label}
            onClick={() => onChange(id)}
            className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
              selected ? 'border-foreground/60 bg-border/40 text-foreground' : 'border-transparent text-foreground/55 hover:bg-border/40 hover:text-foreground'
            }`}
          >
            {id ? (
              <InfoIcon id={id as 'mail'} size={16} />
            ) : (
              /* 无图标占位：斜线框 */
              <span className="relative block h-3 w-3 rounded-sm border border-current opacity-60" aria-hidden>
                <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-current" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
