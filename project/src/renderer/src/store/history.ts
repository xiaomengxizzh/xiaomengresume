/**
 * 历史栈管理器 —— F3 撤销/重做（2026-08-07 扩展：快照覆盖内容字段 + layout/theme）
 * 依据：《项目功能.md》F3。结构化克隆快照栈（上限 50 步）+ 500ms 防抖合并 + 提交级入栈。
 *
 * 语义：
 * - record(prevSnapshot) 在每次「提交级变更」前调用（失焦/回车/按钮），压入变更前快照。
 * - 500ms 防抖窗口内的多次提交合并为一步（窗口起点快照保留，后续丢弃）。
 * - undo(current) 弹栈返回上一个快照；redo(current) 返回被撤销的快照。
 * - 与 Tiptap 内部 undo 区分：Tiptap 只管内联编辑，Ctrl+Z 在 Tiptap 聚焦时交回其内部栈。
 */
export interface HistoryManager<T> {
  /** 提交级变更前调用（防抖合并） */
  record(snapshot: T): void
  /** 撤销：返回上一个快照（无则 undefined） */
  undo(current: T): T | undefined
  /** 重做：返回被撤销的快照（无则 undefined） */
  redo(current: T): T | undefined
  canUndo(): boolean
  canRedo(): boolean
  /** 加载新文档 / 新建时清空历史 */
  clear(): void
  readonly undoDepth: number
  readonly redoDepth: number
}

export interface HistoryOptions {
  /** 撤销步数上限（默认 50） */
  limit?: number
  /** 防抖合并窗口 ms（默认 500，与自动保存同窗避免抖动） */
  debounceMs?: number
}

export function createHistoryManager<T>(opts: HistoryOptions = {}): HistoryManager<T> {
  const limit = opts.limit ?? 50
  const debounceMs = opts.debounceMs ?? 500

  let undoStack: T[] = []
  let redoStack: T[] = []
  let lastRecordAt: number | null = null

  return {
    get undoDepth() {
      return undoStack.length
    },
    get redoDepth() {
      return redoStack.length
    },
    record(snapshot: T): void {
      const now = Date.now()
      if (lastRecordAt !== null && now - lastRecordAt < debounceMs) {
        // 防抖窗内：合并，不重复压栈（栈顶已是窗口起点快照）
        return
      }
      undoStack.push(snapshot)
      if (undoStack.length > limit) {
        undoStack.shift()
      }
      lastRecordAt = now
      // 新提交清空 redo
      redoStack = []
    },
    undo(current: T): T | undefined {
      const prev = undoStack.pop()
      if (prev === undefined) return undefined
      redoStack.push(current)
      lastRecordAt = null // 撤销后重置防抖窗（避免连续撤销被合并）
      return prev
    },
    redo(current: T): T | undefined {
      const next = redoStack.pop()
      if (next === undefined) return undefined
      undoStack.push(current)
      lastRecordAt = null
      return next
    },
    canUndo(): boolean {
      return undoStack.length > 0
    },
    canRedo(): boolean {
      return redoStack.length > 0
    },
    clear(): void {
      undoStack = []
      redoStack = []
      lastRecordAt = null
    }
  }
}
