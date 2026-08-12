/**
 * template-book.tsx —— 模板图书式翻书选择器（2026-08-12 界面调整批 · 用户定案）
 * 交互（用户确认）：横排 3 槽位——中间 = 当前模板完整突出（大卡），左右 = 相邻模板缩小露边（取模循环）；
 * 左右箭头循环切换（未来多模板时即翻页浏览）；卡片零按钮，点击任意卡进入该模板编辑。
 * 配色走当前 UI 主题令牌（--card/--border/--foreground/--selected 等），柔顺卡片风，不用参考图蓝/橙。
 */
import { useTranslation } from 'react-i18next'
import { templateRegistry, type TemplateId } from '../templates/registry'
import { TemplatePreviewCard } from './template-preview-card'

interface Props {
  templates: TemplateId[]
  selected: TemplateId
  onSelect: (id: TemplateId) => void
  onOpen: (id: TemplateId) => void
}

const SCALE_MAIN = 0.4
const SCALE_SIDE = 0.22
/** 两侧卡露边可视宽（卡宽 175 × ~60%，余被 overflow 裁切） */
const SIDE_VISIBLE = 105

function ChevronIcon({ dir }: { dir: 'left' | 'right' }): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  )
}

export function TemplateBook({ templates, selected, onSelect, onOpen }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const idx = templates.indexOf(selected)
  const prev = templates[(idx - 1 + templates.length) % templates.length]
  const next = templates[(idx + 1) % templates.length]

  const arrowBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground/70 transition-colors hover:bg-selected/40 hover:text-foreground'
  const sideBtnClass = 'relative z-0 overflow-hidden rounded-md opacity-60 transition-opacity hover:opacity-90'
  const name = (id: TemplateId): string => t(templateRegistry[id].nameKey)

  return (
    <div className="flex items-center justify-center gap-3 py-4">
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

      <div className="flex items-center justify-center">
        {/* 左卡：前一模板（露右缘） */}
        <button
          type="button"
          className={sideBtnClass}
          style={{ width: SIDE_VISIBLE }}
          aria-label={`${t('settings.templates.openEditor', { name: name(prev) })}`}
          title={name(prev)}
          onClick={() => onOpen(prev)}
        >
          <div className="flex justify-end">
            <TemplatePreviewCard templateId={prev} scale={SCALE_SIDE} />
          </div>
        </button>

        {/* 中卡：当前模板完整突出 */}
        <button
          type="button"
          className="z-10 rounded-md transition-transform hover:-translate-y-1"
          aria-label={`${t('settings.templates.openEditor', { name: name(selected) })}`}
          title={name(selected)}
          onClick={() => onOpen(selected)}
        >
          <TemplatePreviewCard templateId={selected} scale={SCALE_MAIN} />
        </button>

        {/* 右卡：后一模板（露左缘） */}
        <button
          type="button"
          className={sideBtnClass}
          style={{ width: SIDE_VISIBLE }}
          aria-label={`${t('settings.templates.openEditor', { name: name(next) })}`}
          title={name(next)}
          onClick={() => onOpen(next)}
        >
          <div className="flex justify-start">
            <TemplatePreviewCard templateId={next} scale={SCALE_SIDE} />
          </div>
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
