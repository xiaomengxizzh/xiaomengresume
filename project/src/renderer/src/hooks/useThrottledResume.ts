/**
 * useThrottledResume —— 预览渲染节流订阅（P2，用户拍板 C：实时 + rAF 合并）
 * resume 每次 setField 变化 → 下一帧取最新值渲染；同一帧内多次 setField 合并为一次渲染
 * （滑块连续拖动、IME 组合、批量操作等高频事件受益；打字单键间隔 >1 帧仍逐键渲染，
 * 总开销仅延迟一帧，配合 cloneResume 的 photo 引用剥离缓解大简历卡顿）。
 */
import { useEffect, useRef, useState } from 'react'
import { useResumeStore } from '../store/useResumeStore'
import type { Resume } from '@shared/schema/resume'

export function useThrottledResume(): Resume {
  const resume = useResumeStore((s) => s.resume)
  const [display, setDisplay] = useState(resume)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setDisplay(useResumeStore.getState().resume)
    })
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [resume])

  return display
}
