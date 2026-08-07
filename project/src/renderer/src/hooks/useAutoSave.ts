/**
 * useAutoSave —— F11 自动保存（§5.3）
 * 订阅 store 变更 → 500ms 防抖 → resume:save（IPC invoke）→ 回执驱动「已保存/保存中」状态条。
 * 防抖窗与 F3 历史栈同窗（500ms），避免抖动。
 */
import { useEffect, useState } from 'react'
import { useResumeStore } from '../store/useResumeStore'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useAutoSave(): { state: SaveState } {
  const resumeId = useResumeStore((s) => s.resumeId)
  const resume = useResumeStore((s) => s.resume)
  const [state, setState] = useState<SaveState>('idle')

  useEffect(() => {
    if (!resumeId) return
    setState('saving')
    const timer = setTimeout(() => {
      window.electronAPI.resumes
        .save(resumeId, resume)
        .then(() => setState('saved'))
        .catch(() => setState('error'))
    }, 500)
    return () => clearTimeout(timer)
  }, [resumeId, resume])

  return { state }
}
