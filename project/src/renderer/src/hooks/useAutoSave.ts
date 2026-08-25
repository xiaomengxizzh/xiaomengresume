/**
 * useAutoSave —— F11 自动保存（§5.3）
 * 订阅 store 变更 → 500ms 防抖 → resume:save（IPC invoke）→ 回执驱动「已保存/保存中」状态条。
 * 2026-08-08 修复（P1）：
 *  - flush()：导出前 / EditorView 卸载前立即保存最新 resume（原防抖窗内切视图/导出读盘陈旧）
 *  - 失败自动重试（5s 间隔，最多 3 次）：保存失败后用户停止编辑也不丢改动
 *  - beforeunload 兜底：关窗前尽力落盘（Electron 异步 IPC 在销毁前尽力送达）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useResumeStore } from '../store/useResumeStore'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 500
const RETRY_DELAY_MS = 5_000
const MAX_RETRIES = 3

export function useAutoSave(): { state: SaveState; flush: () => Promise<boolean> } {
  const resumeId = useResumeStore((s) => s.resumeId)
  const resume = useResumeStore((s) => s.resume)
  const [state, setState] = useState<SaveState>('idle')

  // 最新值引用：flush/重试/卸载回调始终保存最新 resume（避免闭包捕获过期值）
  const latestRef = useRef({ resumeId, resume })
  latestRef.current = { resumeId, resume }
  const inFlightRef = useRef(false)
  // G2：飞行中被丢的保存请求标记——finally 补存一次，卸载 flush 撞上飞行保存不再丢最后一次编辑
  const pendingRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSave = useCallback(async (): Promise<boolean> => {
    // G2（2026-08-25 修复批②）：飞行中不丢请求——登记 pendingRef，当前保存完成后补存一次
    // 最新内容（防抖调度照常接管后续编辑；补存仅由真实被丢请求触发，无无限循环）。
    if (inFlightRef.current) {
      pendingRef.current = true
      return false
    }
    const current = latestRef.current
    if (!current.resumeId) return true
    inFlightRef.current = true
    setState('saving')
    try {
      await window.electronAPI.resumes.save(current.resumeId, current.resume)
      retryCountRef.current = 0
      setState('saved')
      return true
    } catch {
      setState('error')
      return false
    } finally {
      inFlightRef.current = false
      if (pendingRef.current) {
        pendingRef.current = false
        void doSave()
      }
    }
  }, [])

  // 500ms 防抖自动保存（与 F3 历史栈同窗，避免抖动）
  useEffect(() => {
    if (!resumeId) return
    setState('saving')
    const timer = setTimeout(() => {
      void doSave()
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [resumeId, resume, doSave])

  // 保存失败自动重试（最多 3 次；重试成功会经 doSave 重置计数）
  useEffect(() => {
    if (state !== 'error') return
    if (retryCountRef.current >= MAX_RETRIES) return
    retryCountRef.current += 1
    retryTimerRef.current = setTimeout(() => {
      void doSave()
    }, RETRY_DELAY_MS)
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [state, doSave])

  // 关窗兜底：单向 send 立即保存最新 resume（P2：invoke 回执在窗口销毁前不保证送达，
  // send 消息入队即达主进程，主进程 resume:save-now 落盘后随退出流程完成）
  // M5 D4：托盘模式 close→hide 不触发 beforeunload——另订阅 window:before-hide（主进程 close 拦截后发送）
  useEffect(() => {
    const saveNow = (): void => {
      const current = latestRef.current
      if (current.resumeId) {
        window.electronAPI.resumes.saveNow(current.resumeId, current.resume)
      }
    }
    const onUnload = (): void => saveNow()
    const offBeforeHide = window.electronAPI.window.onBeforeHide(() => saveNow())
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      offBeforeHide()
    }
  }, [])

  /** 立即保存最新 resume（导出前 / EditorView 卸载前调用，杜绝防抖窗内丢最后编辑） */
  const flush = useCallback((): Promise<boolean> => doSave(), [doSave])

  return { state, flush }
}
