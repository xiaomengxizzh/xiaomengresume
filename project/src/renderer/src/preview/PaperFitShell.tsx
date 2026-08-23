/**
 * PaperFitShell —— 整页 A4 适配缩放壳（2026-08-23 R1 抽取自 BasicPreview，模板设置屏复用）
 * 纸张固定为 A4 一页（794×1123），永不随内容撑高；按比例缩放到可用区完整可见
 * （宽高同时约束、封顶 100%），居中显示；内容超过一页 A4 高度时由 .preview-paper
 * 内部 overflow-y:auto 提供纵向滚动条。
 * 依赖 styles.css 既有类：.preview-pane（flex:1 撑满 + padding + 滚动条）、
 * .preview-scale-wrapper（margin:auto 居中 + overflow:hidden）、.preview-paper（A4 尺寸 + 变换）。
 * ⚠ 父容器必须 flex 列布局且有确定高度（.preview-pane 依赖 flex:1 取可用高算 scale；
 * 非 flex 容器下 ResizeObserver 缩放反馈会死循环——同 ImportWizard 接入注释）。
 */
import { useEffect, useRef, type ReactNode } from 'react'

/** 纸张基准（A4 @96dpi：210mm×297mm = 794×1123） */
const PAPER_WIDTH = 794
const A4_HEIGHT = 1123
/** 预览面板内边距（左右 32+32 + 缓冲；上下 28+56 + 缓冲），用于适配计算 */
const PAD_X = 80
const PAD_Y = 104

export function PaperFitShell({ children }: { children: ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const wrap = wrapRef.current
    const paper = paperRef.current
    if (!el || !wrap || !paper) return
    const update = (): void => {
      const availW = el.clientWidth - PAD_X
      const availH = el.clientHeight - PAD_Y
      // 纸张固定 A4（794×1123）：宽高同时约束缩放，整页 A4 始终完整可见（封顶 100%）。
      const s = Math.min(availW / PAPER_WIDTH, availH / A4_HEIGHT, 1)
      const scale = s > 0 ? s : 1
      const w = Math.round(PAPER_WIDTH * scale)
      const h = Math.round(A4_HEIGHT * scale)
      // 防循环（2026-08-09）：尺寸未变不重复写 DOM——wrap 宽高变化会反馈 ResizeObserver，
      // 任何容器配置下（如导入向导非 flex 容器）避免缩放死循环（无限缩小）
      if (wrap.style.width === `${w}px` && wrap.style.height === `${h}px`) return
      el.style.setProperty('--preview-scale', String(scale))
      // transform 不改变布局尺寸 → 手动同步 wrapper 实际宽高（避免滚动条/居中错误）
      wrap.style.width = `${w}px`
      wrap.style.height = `${h}px`
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
          {children}
        </div>
      </div>
    </div>
  )
}
