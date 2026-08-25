/**
 * entry-batch —— 迭代优化批 P0-4/P0-1（2026-08-21）
 * - useEntryBatch：列表模块批量操作状态（全部显隐 / 批量删除选择模式；选择态为局部 UI state）
 * - BatchBar：批量操作条（非选择态 = 全部显示/隐藏 + 进入批量删除；选择态 = 全选/删除所选/取消）
 * - EntryDragHandle：条目拖拽手柄（HTML5 DnD 仅手柄可拖 + Alt+↑/↓ 键盘重排，复用 store.moveItem 单历史步）
 * 全部操作走 store 单历史步（一次撤销）；样式复用 module-drag-handle 先例。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'

/** 列表模块批量操作 hook（section ∈ LIST_SECTIONS；显隐仅 education/work/projects 有 visible 字段） */
export function useEntryBatch(section: string): {
  selectMode: boolean
  selected: Set<number>
  count: number
  showAll: () => void
  hideAll: () => void
  enter: () => void
  exit: () => void
  toggle: (i: number) => void
  toggleAll: () => void
  removeSelected: () => void
} {
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // 2026-08-25 批 B3：粗粒度 s.resume[section] 收敛为数字选择器（Object.is 比较长度，仅条目数变化才重渲，输出等价）
  const count = useResumeStore((s) => (s.resume[section as 'work'] as unknown[] | undefined)?.length ?? 0)

  const exit = (): void => {
    setSelectMode(false)
    setSelected(new Set())
  }
  return {
    selectMode,
    selected,
    count,
    showAll: () => useResumeStore.getState().setAllItemsVisible(section, true),
    hideAll: () => useResumeStore.getState().setAllItemsVisible(section, false),
    enter: () => setSelectMode(true),
    exit,
    toggle: (i) =>
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      }),
    toggleAll: () =>
      setSelected((prev) =>
        prev.size === count ? new Set<number>() : new Set(Array.from({ length: count }, (_, i) => i))
      ),
    removeSelected: () => {
      if (selected.size === 0) return
      useResumeStore.getState().removeItems(section, [...selected].sort((a, b) => b - a))
      exit()
    }
  }
}

export type EntryBatch = ReturnType<typeof useEntryBatch>

/** 批量操作条（items.length > 0 时由 Form 渲染在 SectionCard body 顶部） */
export function BatchBar({ batch, hasVisibility }: { batch: EntryBatch; hasVisibility: boolean }): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!hasVisibility && !batch.selectMode && batch.count === 0) return null
  if (batch.selectMode) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs">
        <label className="flex cursor-pointer items-center gap-1 text-foreground/70">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={batch.selected.size === batch.count && batch.count > 0}
            onChange={batch.toggleAll}
          />
          {t('editor.batch.selectAll')}
        </label>
        <span className="text-foreground/50">
          {t('editor.batch.selectedCount', { n: batch.selected.size, total: batch.count })}
        </span>
        <button
          type="button"
          className="ml-auto rounded-md border border-border px-2 py-0.5 font-medium text-danger transition-colors hover:bg-border/40 disabled:pointer-events-none disabled:opacity-40"
          disabled={batch.selected.size === 0}
          onClick={batch.removeSelected}
        >
          {t('editor.batch.deleteSelected')}
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-foreground/60 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={batch.exit}
        >
          {t('editor.batch.exit')}
        </button>
      </div>
    )
  }
  return (
    <div className="mb-2 flex items-center gap-1 text-xs text-foreground/60">
      {hasVisibility ? (
        <>
          <button type="button" className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-border/40 hover:text-foreground" onClick={batch.showAll}>
            {t('editor.batch.showAll')}
          </button>
          <button type="button" className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-border/40 hover:text-foreground" onClick={batch.hideAll}>
            {t('editor.batch.hideAll')}
          </button>
          <span className="text-border">|</span>
        </>
      ) : null}
      <button type="button" className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-border/40 hover:text-foreground" onClick={batch.enter}>
        {t('editor.batch.delete')}
      </button>
    </div>
  )
}

/** 条目拖拽手柄（HTML5 DnD 仅手柄可拖；Alt+↑/↓ 键盘重排；复用 module-drag-handle 样式） */
export function EntryDragHandle({
  index,
  onDragStart,
  onDragEnd,
  onMove
}: {
  index: number
  onDragStart: (index: number) => void
  onDragEnd: () => void
  onMove: (from: number, dir: -1 | 1) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <span
      draggable
      title="⋮⋮"
      role="button"
      tabIndex={0}
      aria-label={t('editor.batch.reorderHint')}
      className="module-drag-handle cursor-grab select-none text-[10px] leading-none text-foreground/55 hover:text-foreground"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(index))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(index)
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (e.altKey && e.key === 'ArrowUp') {
          e.preventDefault()
          onMove(index, -1)
        }
        if (e.altKey && e.key === 'ArrowDown') {
          e.preventDefault()
          onMove(index, 1)
        }
      }}
    >
      ⋮⋮
    </span>
  )
}
