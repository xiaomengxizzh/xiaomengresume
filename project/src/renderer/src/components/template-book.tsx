/**
 * template-book.tsx —— 模板图书式翻书选择器（2026-08-12 界面调整批 · 用户定案）
 * 交互：横排 3 槽位——中间 = 当前模板完整突出（大卡），左右 = 相邻模板缩小（取模循环）；
 * 左右箭头循环切换（未来多模板时即翻页浏览）；卡片零按钮，点击任意卡进入该模板编辑。
 * 布局（2026-08-12 方案 A，用户确认）：卡片随容器宽自适应缩放——ResizeObserver 量容器宽 →
 * 三卡按 1 : 1.8 : 1 分配可用宽（侧卡全显不再裁切 + 卡间 gap 28px），scale = 槽位宽 ÷ 794 保 A4 比例不变形；
 * 最小侧卡宽 143px（scale 0.18）保护窄窗口可读性。配色走当前 UI 主题令牌，柔顺卡片风。
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { templateRegistry, type TemplateId } from '../templates/registry'
import { TemplatePreviewCard } from './template-preview-card'

interface Props {
  templates: TemplateId[]
  selected: TemplateId
  onSelect: (id: TemplateId) => void
  onOpen: (id: TemplateId) => void
}

/** 中间突出比例（中卡宽 / 侧卡宽） */
const MAIN_RATIO = 1.8
/** 卡间 gap（px） */
const CARD_GAP = 28
/** 侧卡最小宽（scale 0.18，窄窗口可读性保护） */
const SIDE_MIN_W = Math.round(794 * 0.18)
/** 固定占宽：左右箭头 2×36 + 外层 gap-3 2×12 */
const FIXED_W = 96
/** 测量前 fallback 容器宽（窗口 1280 主区典型值，避免首帧闪烁） */
const FALLBACK_W = 780

function ChevronIcon({ dir }: { dir: 'left' | 'right' }): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  )
}

export function TemplateBook({ templates, selected, onSelect, onOpen }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(FALLBACK_W)

  // 方案 A：容器宽自适应——量宽度反推卡片 scale（随窗口/容器变化，宽则卡片等比放大）
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setContainerW(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const idx = templates.indexOf(selected)
  const prev = templates[(idx - 1 + templates.length) % templates.length]
  const next = templates[(idx + 1) % templates.length]

  // 三卡分配：s + gap + 1.8s + gap + s = 卡组宽 = containerW − FIXED_W
  const s = Math.max(SIDE_MIN_W, (containerW - FIXED_W - CARD_GAP * 2) / (2 + MAIN_RATIO))
  const m = MAIN_RATIO * s
  const scaleSide = s / 794
  const scaleMain = m / 794

  const arrowBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground/70 transition-colors hover:bg-selected/40 hover:text-foreground'
  const name = (id: TemplateId): string => t(templateRegistry[id].nameKey)
  const cardBtn = 'rounded-md transition-transform hover:-translate-y-1'

  return (
    <div ref={boxRef} className="flex items-center justify-center gap-3 py-4">
      {/* 左箭头：切到前一模板 */}
      <button
        type="button"
        className={arrowBtn}
        aria-label={t('settings.templates.prev')}
        title={t('settings.templates.prev')}
        onClick={() => onSelect(prev)}
      >
        <ChevronIcon dir="left" />
      </button>

      <div className="flex items-center justify-center gap-[28px]">
        {/* 左卡：前一模板（全显，略小） */}
        <button
          type="button"
          className={`${cardBtn} opacity-60 transition-opacity hover:opacity-90`}
          style={{ width: s }}
          aria-label={`${t('settings.templates.openEditor', { name: name(prev) })}`}
          title={name(prev)}
          onClick={() => onOpen(prev)}
        >
          <TemplatePreviewCard templateId={prev} scale={scaleSide} />
        </button>

        {/* 中卡：当前模板完整突出（1.8×） */}
        <button
          type="button"
          className={cardBtn}
          style={{ width: m }}
          aria-label={`${t('settings.templates.openEditor', { name: name(selected) })}`}
          title={name(selected)}
          onClick={() => onOpen(selected)}
        >
          <TemplatePreviewCard templateId={selected} scale={scaleMain} />
        </button>

        {/* 右卡：后一模板（全显，略小） */}
        <button
          type="button"
          className={`${cardBtn} opacity-60 transition-opacity hover:opacity-90`}
          style={{ width: s }}
          aria-label={`${t('settings.templates.openEditor', { name: name(next) })}`}
          title={name(next)}
          onClick={() => onOpen(next)}
        >
          <TemplatePreviewCard templateId={next} scale={scaleSide} />
        </button>
      </div>

      {/* 右箭头：切到后一模板 */}
      <button
        type="button"
        className={arrowBtn}
        aria-label={t('settings.templates.next')}
        title={t('settings.templates.next')}
        onClick={() => onSelect(next)}
      >
        <ChevronIcon dir="right" />
      </button>
    </div>
  )
}
