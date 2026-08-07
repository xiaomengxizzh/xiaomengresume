/**
 * LayoutBar —— 编辑面板顶部排版条（2026-08-07 UI 重构，用户需求：排版不放顶栏）
 * 字号 / 行高 / 页面边距 / 段落间距 / 区块间距 滑杆 + 一键恢复默认。
 * 写入 layout.*（per-resume，进 F3 撤销栈）；缺省值 = classic 模板预设（对齐示例 PDF）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { Button } from '../ui'

const DEFAULTS = {
  baseFontSize: 16,
  lineHeight: 1.5,
  pagePadding: 32,
  paragraphSpacing: 12,
  sectionSpacing: 16
} as const

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, onChange }: SliderProps): React.JSX.Element {
  return (
    <label className="layout-bar-item">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="value">{value}</span>
    </label>
  )
}

export function LayoutBar(): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const layout = useResumeStore((s) => s.resume.layout)
  const setField = useResumeStore((s) => s.setField)

  const get = (key: keyof typeof DEFAULTS): number =>
    typeof layout?.[key] === 'number' ? (layout[key] as number) : DEFAULTS[key]

  const setNum = (key: keyof typeof DEFAULTS, v: number): void => setField(`layout.${key}`, v)

  const reset = (): void => {
    // 恢复模板默认：移除排版覆盖字段（templateId/themeColor/resumeFont 保留用户选择）
    for (const key of Object.keys(DEFAULTS) as Array<keyof typeof DEFAULTS>) {
      setField(`layout.${key}`, DEFAULTS[key])
    }
  }

  return (
    <div className="layout-bar">
      <button
        type="button"
        className="text-xs font-medium text-foreground/80 hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} {t('editor.layoutTitle')}
      </button>
      {open ? (
        <>
          <Slider label={t('editor.layoutBaseFont')} value={get('baseFontSize')} min={12} max={20} step={1} onChange={(v) => setNum('baseFontSize', v)} />
          <Slider label={t('editor.layoutLineHeight')} value={get('lineHeight')} min={1.2} max={2} step={0.05} onChange={(v) => setNum('lineHeight', v)} />
          <Slider label={t('editor.layoutPadding')} value={get('pagePadding')} min={16} max={64} step={2} onChange={(v) => setNum('pagePadding', v)} />
          <Slider label={t('editor.layoutParagraph')} value={get('paragraphSpacing')} min={4} max={20} step={1} onChange={(v) => setNum('paragraphSpacing', v)} />
          <Slider label={t('editor.layoutSection')} value={get('sectionSpacing')} min={8} max={32} step={2} onChange={(v) => setNum('sectionSpacing', v)} />
          <Button size="sm" variant="outline" onClick={reset}>
            {t('editor.layoutReset')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
