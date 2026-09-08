/**
 * LayoutBar —— 编辑面板顶部排版条（2026-08-08 M2：L4 reset 语义修复 + L6 headerSize 滑杆）
 * 字号 / 行高 / 页面边距(水平·垂直) / 段落间距 / 区块间距 / 节标题字号 / 副标题字号 滑杆 +
 * 一键恢复默认 + 紧凑排版 / 自动一页纸 / 图标显隐 / 副标题位置 / 节排版（标题改名·两栏·不跨页）。
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

  // 2026-08-13 需求④：自动一页纸开关（fitToPage）——内容超高时等比重排压缩到一页
  const fitToPage = layout?.fitToPage === true
  const toggleFitToPage = (): void => setField('layout.fitToPage', !fitToPage)

  // 2026-08-13 需求③：条目列表项目符号（listMark：none/dot/square/dash，用于强调分类）
  const LIST_MARK_OPTIONS = [
    { value: 'none', label: t('editor.layoutMarkNone') },
    { value: 'dot', label: t('editor.layoutMarkDot') },
    { value: 'square', label: t('editor.layoutMarkSquare') },
    { value: 'dash', label: t('editor.layoutMarkDash') }
  ]
  const listMark = layout?.listMark ?? 'none'
  const setListMark = (v: string): void => setField('layout.listMark', v)

  // 2026-09-08：经历条目副标题位置（三态；历史值 'inline' 渲染按 inline-start）
  const SUB_POS_OPTIONS = [
    { value: 'below', label: t('editor.layoutSubPosBelow') },
    { value: 'inline-start', label: t('editor.layoutSubPosInlineStart') },
    { value: 'inline-center', label: t('editor.layoutSubPosInlineCenter') }
  ]
  const subtitlePosition = layout?.subtitlePosition ?? 'below'
  const setSubtitlePosition = (v: string): void => setField('layout.subtitlePosition', v)

  // 2026-09-08：副标题独立字号（缺省回落 entrySubEm×baseFontSize）
  const subheaderSize = layout?.subheaderSize
  const setSubheaderSize = (v: number): void => setField('layout.subheaderSize', v)
  const defaultSubSize = Math.round(get('baseFontSize') * 0.9)

  // 2026-09-08：联系方式/标签图标显隐开关
  const useIconMode = layout?.useIconMode !== false
  const toggleIconMode = (): void => setField('layout.useIconMode', !useIconMode)

  // 2026-09-08 排版批 B：节排版面板（节标题改名/两栏/整节不跨页；fitToPage 开启时 keepTogether 让位）
  const customSections = useResumeStore((s) => s.resume.customSections)
  const [secPanelOpen, setSecPanelOpen] = useState(false)
  const [pickedId, setPickedId] = useState<string>('skills')
  const sectionMeta = layout?.sectionMeta ?? {}
  const pickedMeta = sectionMeta[pickedId]
  const pickedLabel = ((): string => {
    const custom = customSections?.find((c) => c.id === pickedId)
    if (custom) return custom.title
    const key = `editor.section.${pickedId}`
    const translated = t(key)
    return translated === key ? pickedId : translated
  })()
  const updateMeta = (patch: { title?: string; columns?: 1 | 2; keepTogether?: boolean }): void => {
    const next = { ...pickedMeta, ...patch }
    // 空值归约：title 空串=沿用默认节名；全空对象=删除该节 meta
    if (typeof next.title === 'string' && next.title.trim() === '') delete next.title
    if (Object.keys(next).length === 0) {
      const clone = { ...sectionMeta }
      delete clone[pickedId]
      setField('layout.sectionMeta', clone)
      return
    }
    setField('layout.sectionMeta', { ...sectionMeta, [pickedId]: next })
  }
  const clearPickedMeta = (): void => {
    const clone = { ...sectionMeta }
    delete clone[pickedId]
    setField('layout.sectionMeta', clone)
  }

  return (
    <div className="layout-bar" style={{ position: 'relative' }}>
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
          {/* 2026-09-08 排版批 B：页边距水平/垂直拆分（未手动设置时回落 pagePadding） */}
          <Slider label={t('editor.layoutMarginX')} value={layout?.pageMarginX ?? get('pagePadding')} min={12} max={96} step={2} onChange={(v) => setField('layout.pageMarginX', v)} />
          <Slider label={t('editor.layoutMarginY')} value={layout?.pageMarginY ?? get('pagePadding')} min={12} max={96} step={2} onChange={(v) => setField('layout.pageMarginY', v)} />
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
          {/* 2026-08-13 需求④：自动一页纸开关（激活态高亮；内容超高时等比重排压缩到一页） */}
          <Button size="sm" variant={fitToPage ? 'default' : 'outline'} onClick={toggleFitToPage} title={t('editor.layoutFitPageHint')}>
            {t('editor.layoutFitPage')}
          </Button>
          {/* 2026-08-13 需求③：条目项目符号选择（强调分类） */}
          <select
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
            value={listMark}
            onChange={(e) => setListMark(e.target.value)}
            title={t('editor.layoutMarkHint')}
          >
            {LIST_MARK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {/* 2026-09-08：经历条目副标题位置选择（三态）+ 副标题字号滑杆 */}
          <select
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
            value={subtitlePosition}
            onChange={(e) => setSubtitlePosition(e.target.value)}
            title={t('editor.layoutSubPosHint')}
          >
            {SUB_POS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Slider
            label={t('editor.layoutSubSize')}
            value={subheaderSize ?? defaultSubSize}
            min={10}
            max={18}
            step={1}
            onChange={setSubheaderSize}
          />
          {/* 2026-09-08：联系方式/标签图标显隐开关 */}
          <Button
            size="sm"
            variant={useIconMode ? 'outline' : 'default'}
            onClick={toggleIconMode}
            title={t('editor.layoutIconModeHint')}
          >
            {useIconMode ? t('editor.layoutIconModeOn') : t('editor.layoutIconModeOff')}
          </Button>
          {/* 2026-09-08 排版批 B：节排版面板（节标题改名/两栏/整节不跨页） */}
          <Button
            size="sm"
            variant={secPanelOpen ? 'default' : 'outline'}
            onClick={() => setSecPanelOpen((v) => !v)}
            title={t('editor.sectionLayoutHint')}
          >
            {t('editor.sectionLayout')}
          </Button>
          {secPanelOpen ? (
            <div
              className="rounded-lg border border-border bg-surface p-3 text-xs shadow-md"
              style={{ position: 'absolute', top: '100%', left: 8, zIndex: 30, width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div>
                <div className="mb-1 font-medium text-foreground/80">{t('editor.sectionPick')}</div>
                <select
                  className="w-full rounded-md border border-border bg-surface px-2 py-1"
                  value={pickedId}
                  onChange={(e) => setPickedId(e.target.value)}
                >
                  {['education', 'work', 'projects', 'skills', 'certificates', 'languages'].map((id) => (
                    <option key={id} value={id}>
                      {t(`editor.section.${id}`)}
                    </option>
                  ))}
                  {(customSections ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1 font-medium text-foreground/80">{t('editor.sectionTitleOverride')}</div>
                <input
                  className="w-full rounded-md border border-border bg-surface px-2 py-1"
                  value={pickedMeta?.title ?? ''}
                  placeholder={pickedLabel}
                  onChange={(e) => updateMeta({ title: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pickedMeta?.columns === 2}
                  onChange={(e) => updateMeta({ columns: e.target.checked ? 2 : 1 })}
                />
                {t('editor.sectionTwoCols')}
              </label>
              <label className="flex items-center gap-2" title={t('editor.sectionKeepTogetherHint')}>
                <input
                  type="checkbox"
                  checked={pickedMeta?.keepTogether === true}
                  disabled={fitToPage}
                  onChange={(e) => updateMeta({ keepTogether: e.target.checked })}
                />
                {t('editor.sectionKeepTogether')}
                {fitToPage ? <span className="text-foreground/50">（{t('editor.sectionKeepTogetherHint')}）</span> : null}
              </label>
              <Button size="sm" variant="outline" onClick={clearPickedMeta}>
                {t('editor.sectionMetaReset')}
              </Button>
            </div>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setField('layout.sectionFonts', {})}
            disabled={!layout?.sectionFonts || Object.keys(layout.sectionFonts).length === 0}
            title={t('editor.resetSectionFontsHint')}
          >
            {t('editor.resetSectionFonts')}
          </Button>
          <Button size="sm" variant="outline" onClick={reset}>
            {t('editor.layoutReset')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
