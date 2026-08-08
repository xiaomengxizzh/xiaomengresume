/**
 * useKeyboardShortcuts —— 全局快捷键（2026-08-07 UI 重构；2026-08-08 F3 统一撤销栈）
 * F3 撤销/重做：Ctrl+Z / Ctrl+Y（macOS Cmd+Z / Cmd+Shift+Z）——统一走 store 50 步栈
 * （TiptapField 已禁用内部 UndoRedo，双栈双向污染修复后无需按焦点分流）。
 * 顶栏按钮已移除，快捷键为唯一入口。
 * 隐藏开发通道：Ctrl+Shift+O / Ctrl+Alt+O 打开内置示例（验收对照 material/简历示例1.pdf 用，不占 UI）。
 */
import { useEffect } from 'react'
import { useResumeStore } from '../store/useResumeStore'

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
      // P2 修复：仅 dev 模式注册 + 排除 AltGr（欧式键盘 AltGr = Ctrl+Alt，日常输入可误触发；
      // 且该通道静默替换当前简历、清空撤销栈，非 dev 不应暴露）
      if (key === 'o' && (e.shiftKey || e.altKey)) {
        if (!import.meta.env.DEV) return
        if (e.getModifierState && e.getModifierState('AltGraph')) return
        e.preventDefault()
        void openSample()
        return
      }

      // M2 F16：Ctrl+Shift+P 切换隐私打码模式（D6；与 Ctrl+Shift+O 不冲突）
      if (key === 'p' && e.shiftKey) {
        e.preventDefault()
        useResumeStore.getState().togglePrivacyMode()
        return
      }

      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey)
      if (!isUndo && !isRedo) return
      e.preventDefault()
      if (isUndo) useResumeStore.getState().undo()
      else useResumeStore.getState().redo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
