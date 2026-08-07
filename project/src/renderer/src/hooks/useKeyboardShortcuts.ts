/**
 * useKeyboardShortcuts —— 全局快捷键（2026-08-07 UI 重构）
 * F3 撤销/重做：Ctrl+Z / Ctrl+Y（macOS Cmd+Z / Cmd+Shift+Z）；与 Tiptap 内部 undo 区分
 * （编辑器聚焦时 Ctrl+Z 交回 Tiptap 内部栈）。顶栏按钮已移除，快捷键为唯一入口。
 * 隐藏开发通道：Ctrl+Shift+O / Ctrl+Alt+O 打开内置示例（验收对照 material/简历示例1.pdf 用，不占 UI）。
 */
import { useEffect } from 'react'
import { useResumeStore } from '../store/useResumeStore'

function isTiptapFocused(): boolean {
  const el = document.activeElement
  return !!el && !!el.closest('.ProseMirror')
}

async function openSample(): Promise<void> {
  try {
    const { id, resume } = await window.electronAPI.resumes.createSample()
    // 2026-08-07 二次评估修复：统一入口切编辑器视图（此前只 loadResume 不切视图——数据已换但用户停在原处）
    useResumeStore.getState().loadResumeIntoEditor(id, resume)
  } catch {
    // 隐藏开发通道：失败静默，不打扰用户
  }
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()

      // 隐藏开发通道：Ctrl+Shift+O / Ctrl+Alt+O 打开内置示例（验收对照用）
      if (key === 'o' && (e.shiftKey || e.altKey)) {
        e.preventDefault()
        void openSample()
        return
      }

      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey)
      if (!isUndo && !isRedo) return
      if (isTiptapFocused()) return // 交回 Tiptap 内部栈
      e.preventDefault()
      if (isUndo) useResumeStore.getState().undo()
      else useResumeStore.getState().redo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
