/**
 * BasicPreview —— F2 右栏实时预览壳（2026-08-08 M2 改造）
 * A4 一页式预览（用户最终需求）：纸张固定为 A4 一页（794×1123），永不随内容撑高；
 *   按比例缩放到预览区完整可见（宽高同时约束、封顶 100%），居中显示；
 *   内容超过一页 A4 高度时，由 .preview-paper 内部 overflow-y:auto 提供纵向滚动条。
 * 2026-08-08 M2 L1 修复：按 layout.templateId 从 templateRegistry 取组件渲染（原硬编码 ClassicTemplate）。
 */
import { useEffect, useRef } from 'react'
import { useResumeStore } from '../store/useResumeStore'
import { getTemplate } from '../templates/registry'
import type { Resume } from '@shared/schema/resume'

/** 纸张基准（A4 @96dpi：210mm×297mm = 794×1123） */
const PAPER_WIDTH = 794
const A4_HEIGHT = 1123
/** 预览面板内边距（左右 32+32 + 缓冲；上下 28+56 + 缓冲），用于适配计算 */
const PAD_X = 80
const PAD_Y = 104

export function BasicPreview({
  preview
}: {
  /** 外部简历预览（导入向导草稿等）：传入则用外部数据渲染对应模板；省略 = store 实时预览 */
  preview?: { resume: Resume; templateId?: string }
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const storeTemplateId = useResumeStore((s) => s.resume.layout?.templateId)

  // L1 修复：按 templateId 取组件（缺省回落 classic）
  // 注：store 模式 resume 内容订阅在 ResumeBody 内部（useThrottledResume，P2 rAF 合并），
  // 本壳不再额外订阅 resume——避免每键多一层重渲；preview 模式直接传外部 resume。
  const Template = preview ? getTemplate(preview.templateId).component : getTemplate(storeTemplateId).component

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
          {preview ? <Template resume={preview.resume} emptyHints /> : <Template emptyHints />}
        </div>
      </div>
    </div>
  )
}
