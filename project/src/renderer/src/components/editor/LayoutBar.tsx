/**
 * LayoutBar —— 编辑面板顶部排版条（2026-08-08 M2：L4 reset 语义修复 + L6 headerSize 滑杆）
 * 字号 / 行高 / 页面边距 / 段落间距 / 区块间距 / 节标题字号 滑杆 + 一键恢复默认。
 * 写入 layout.*（per-resume，进 F3 撤销栈）；缺省值 = 当前模板预设（L4 修复，不再写死 classic）。
 * 2026-08-08 D7：删除动态 ATS 分级提示（无触发入口的过度设计，见 M2 计划 §三）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { Button } from '../ui'
import { getTemplate } from '../../templates/registry'
import { resetLayoutOverrides } from '../../templates/shared/layout-reset'
import { compactSpacing, type TemplatePreset } from '@shared/templates/layout'

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

  // L4 修复：缺省值取「当前模板预设」（getTemplate 已处理 templateId 缺省回落），不再写死 classic
  const preset = getTemplate(layout?.templateId).preset

  const get = (key: keyof typeof preset): number =>
    typeof layout?.[key] === 'number' ? (layout[key] as number) : preset[key]

  const setNum = (key: keyof typeof preset, v: number): void => setField(`layout.${key}`, v)

  const reset = (): void => {
    // L4 修复：清空排版覆盖字段回落模板预设；templateId/themeColor/resumeFont 保留用户选择
    const next = resetLayoutOverrides(layout)
    if (next === undefined) {
      // 无保留字段 → 直接清空 layout（回落模板预设）；若 layout 本身 undefined 则无事可做
      if (layout !== undefined) setField('layout', undefined)
    } else {
      setField('layout', next)
    }
  }

  // 2026-08-10 任务4：紧凑排版开关——compactSpacing() 覆盖间距变量（仅 spacing tokens，
  // 不动字号/内容），写入 layout.* 进 F3 撤销栈；允许内容溢出多页（禁 scale/截断）。
  const compact = compactSpacing(preset)
  const SPACING_KEYS = ['lineHeight', 'pagePadding', 'paragraphSpacing', 'sectionSpacing', 'headerSize'] as const
  const isCompact = SPACING_KEYS.every((k) => get(k) === compact[k as keyof TemplatePreset])
  const applyCompact = (): void => {
    if (isCompact) {
      reset()
      return
    }
    for (const k of SPACING_KEYS) setField(`layout.${k}`, compact[k as keyof TemplatePreset])
  }

  return (
    <div className="layout-bar">
      <button
        type="button"
        className="text-sm font-semibold text-foreground/85 hover:text-foreground"
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
          {/* L6 补：节标题字号滑杆（schema/CLASSIC_PRESET 有、原 UI 缺） */}
          <Slider label={t('editor.layoutHeader')} value={get('headerSize')} min={12} max={28} step={1} onChange={(v) => setNum('headerSize', v)} />
          {/* 2026-08-10 任务4：紧凑排版开关（激活态高亮；再点恢复默认） */}
          <Button
            size="sm"
            variant={isCompact ? 'default' : 'outline'}
            onClick={applyCompact}
            title={t('editor.layoutCompactHint')}
          >
            {t('editor.layoutCompact')}
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            {t('editor.layoutReset')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
