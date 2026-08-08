/**
 * EditorView —— 编辑器子页（currentView='editor'）：顶栏 + 编辑/预览可拖拽双面板
 * 默认 50/50、clamp（编辑 ≥400 / 预览 ≥240）、rAF 节流。
 * 2026-08-07 回退：不再为「A4 绝对尺寸」自动压缩编辑区，预览纸张整体缩放适配。
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TopBar } from '../components/topbar/TopBar'
import { EditorPane } from '../components/editor/EditorPane'
import { BasicPreview } from '../preview/BasicPreview'
import { ExportDialog } from '../components/export/ExportDialog'
import { useAutoSave } from '../hooks/useAutoSave'
import { useResumeStore } from '../store/useResumeStore'

/** 预览面板最小宽（缩放方案下不需要纸张 864 保底，预览可窄纸张按比例缩；240 = 极小但完整可见） */
const PREVIEW_MIN = 240
/** 编辑面板最小宽（两列表单下限） */
const EDITOR_MIN = 400

export function EditorView(): React.JSX.Element {
  const { t } = useTranslation()
  const wsRef = useRef<HTMLDivElement>(null)
  const [split, setSplit] = useState(50)
  const dragging = useRef(false)
  const raf = useRef<number | null>(null)
  // 2026-08-08 P0-1 修复：挂载自动保存（此前全仓库零调用，编辑内容永不落盘）。
  // 防抖窗内切走视图会取消未落盘的最后一次编辑（500ms 窗口极小；退出兜底见 M5 计划）。
  const { state: saveState } = useAutoSave()
  // M2 F5：导出弹窗开关（D4 模态弹窗，EditorView 持有）
  const [exportOpen, setExportOpen] = useState(false)
  const resumeId = useResumeStore((s) => s.resumeId)
  // M2 F16 3d：隐私模式常驻提示（状态栏）
  const privacyMode = useResumeStore((s) => s.privacyMode)

  const updateFromClientX = (clientX: number): void => {
    const ws = wsRef.current
    if (!ws) return
    const rect = ws.getBoundingClientRect()
    const total = rect.width
    if (total <= 0) return
    const editorW = clientX - rect.left
    const minEditor = EDITOR_MIN
    const maxEditor = total - PREVIEW_MIN - 5
    const clamped = Math.min(Math.max(editorW, minEditor), Math.max(maxEditor, minEditor))
    setSplit((clamped / total) * 100)
  }

  useEffect(() => {
    const onMove = (e: MouseEvent): void => {
      if (!dragging.current) return
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => updateFromClientX(e.clientX))
    }
    const onUp = (): void => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <>
      <TopBar saveState={saveState} onExport={() => setExportOpen(true)} />
      <div className="workspace" ref={wsRef} style={{ ['--split' as string]: `${split}%` }}>
        <EditorPane />
        <div
          className="splitter"
          onMouseDown={(e) => {
            dragging.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
            updateFromClientX(e.clientX)
          }}
        />
        <BasicPreview />
      </div>
      {/* M2 F16 3d：隐私模式常驻提示（状态栏） */}
      {privacyMode ? (
        <div className="border-t border-border/60 bg-selected/30 px-4 py-1.5 text-center text-xs text-foreground/80">
          {t('status.privacyOn')} · {t('export.privacyHint')}
        </div>
      ) : null}
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} resumeId={resumeId ?? ''} />
    </>
  )
}