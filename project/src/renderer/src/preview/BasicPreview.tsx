/**
 * BasicPreview —— F2 右栏实时预览壳（2026-08-07 UI 重构）
 * A4 一页式预览（用户最终需求）：纸张固定为 A4 一页（794×1123），永不随内容撑高；
 *   按比例缩放到预览区完整可见（宽高同时约束、封顶 100%），居中显示；
 *   内容超过一页 A4 高度时，由 .preview-paper 内部 overflow-y:auto 提供纵向滚动条。
 */
import { useEffect, useRef } from 'react'
import { useResumeStore } from '../store/useResumeStore'
import { ClassicTemplate } from './ClassicTemplate'

/** 纸张基准（A4 @96dpi：210mm×297mm = 794×1123） */
const PAPER_WIDTH = 794
const A4_HEIGHT = 1123
/** 预览面板内边距（左右 32+32 + 缓冲；上下 28+56 + 缓冲），用于适配计算 */
const PAD_X = 80
const PAD_Y = 104

export function BasicPreview(): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  useResumeStore((s) => s.resume)

  useEffect(() => {
    const el = ref.current
    const wrap = wrapRef.current
    const paper = paperRef.current
    if (!el || !wrap || !paper) return
    const update = (): void => {
      const availW = el.clientWidth - PAD_X
      const availH = el.clientHeight - PAD_Y
      // 纸张固定 A4（794×1123）：宽高同时约束缩放，整页 A4 始终完整可见（封顶 100%）。
      // 不再读取内容高 —— 纸张不会因内容多而被撑成两页；内容超高由纸张内部滚动条处理。
      const s = Math.min(availW / PAPER_WIDTH, availH / A4_HEIGHT, 1)
      const scale = s > 0 ? s : 1
      el.style.setProperty('--preview-scale', String(scale))
      // transform 不改变布局尺寸 → 手动同步 wrapper 实际宽高（避免滚动条/居中错误）
      wrap.style.width = `${Math.round(PAPER_WIDTH * scale)}px`
      wrap.style.height = `${Math.round(A4_HEIGHT * scale)}px`
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div className="preview-pane" ref={ref}>
      <div className="preview-scale-wrapper" ref={wrapRef}>
        <div ref={paperRef} className="preview-paper">
          <ClassicTemplate />
        </div>
      </div>
    </div>
  )
}
