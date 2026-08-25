/**
 * module-drag-handle —— 模块排序拖拽手柄（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 * HTML5 DnD：仅手柄可拖，避免干扰表单输入。
 */
export function ModuleDragHandle({
  id,
  onDragStart,
  onDragEnd
}: {
  id: string
  onDragStart: (id: string) => void
  onDragEnd: () => void
}): React.JSX.Element {
  return (
    <span
      draggable
      title="⋮⋮"
      className="module-drag-handle"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(id)
      }}
      onDragEnd={onDragEnd}
    >
      ⋮⋮
    </span>
  )
}
