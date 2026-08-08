/**
 * ExportDialog —— M2 F5 导出屏（D4：模态弹窗；D5：多页语义；D7：ATS 静态说明）
 * 4 格式卡片（文字版 PDF ✅ / 图片版 PDF ⏳v1.1 / 图片 ⏳v1.1 / JSON ✅）
 * + 目标位置（默认 简历存储 > 上次记忆 > 下载目录 + 「选择文件夹」）
 * + 页数提示（D12：内容约 N 页；N>1 时「全部导出」默认 + 「仅第一页」标注截断）
 * + 隐私联动提示（F16 开启时顶部提示自动脱敏）+ 进度条 + 错误 toast。
 * 零新依赖：纯 React + IPC（window.electronAPI.export）。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { Button } from '../ui'
import { getTemplate } from '../../templates/registry'
import type { ExportFormat, ExportProgress } from '@shared/ipc-channels'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  resumeId: string
}

type FormatCard = {
  id: ExportFormat
  titleKey: string
  descKey: string
  available: boolean
  badge?: string
}

const FORMATS: FormatCard[] = [
  { id: 'textPdf', titleKey: 'export.format.textPdf', descKey: 'export.format.textPdf.desc', available: true },
  { id: 'imagePdf', titleKey: 'export.format.imagePdf', descKey: 'export.format.imagePdf.desc', available: false, badge: 'export.commingSoon' },
  { id: 'image', titleKey: 'export.format.image', descKey: 'export.format.image.desc', available: false, badge: 'export.commingSoon' },
  { id: 'json', titleKey: 'export.format.json', descKey: 'export.format.json.desc', available: true }
]

/** 估算简历页数（D12：轻量渲染测量。打印窗口预渲染太重，M2 用内容高度估算；±1 页误差标注"约"） */
export function estimatePageCount(resumeHeightPx: number): number {
  if (resumeHeightPx <= 0) return 1
  // A4 内容高 ≈ 1123px - 2×边距(约 85px) ≈ 1038px；向上取整
  return Math.max(1, Math.ceil(resumeHeightPx / 1038))
}

export function ExportDialog({ open, onClose, resumeId }: ExportDialogProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<ExportFormat>('textPdf')
  const [folder, setFolder] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [pageCount, setPageCount] = useState(1)
  const [pages, setPages] = useState<'all' | 'first'>('all')
  const paperRef = useRef<HTMLDivElement>(null)
  const privacyMode = useResumeStore((s) => s.privacyMode)
  const templateId = useResumeStore((s) => s.resume.layout?.templateId)
  const MeasureTemplate = getTemplate(templateId).component

  // 弹窗打开时估算页数（D12：测量隐藏渲染的模板内容高度）
  useEffect(() => {
    if (!open) return
    setError('')
    setProgress(0)
    setRunning(false)
    setPages('all')
    // 延迟一帧等隐藏模板渲染完成
    const raf = requestAnimationFrame(() => {
      const paper = paperRef.current
      if (paper) {
        setPageCount(estimatePageCount(paper.scrollHeight))
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  // 页数随内容变化刷新（防抖 300ms）
  useEffect(() => {
    if (!open) return
    const paper = paperRef.current
    if (!paper) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setPageCount(estimatePageCount(paper.scrollHeight))
      }, 300)
    })
    ro.observe(paper)
    return () => {
      ro.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [open])

  const runExport = useCallback(async (): Promise<void> => {
    if (!resumeId) return
    setRunning(true)
    setError('')
    setProgress(0.05)
    const unsub = window.electronAPI.export.onProgress((p: ExportProgress) => {
      setProgress(p.ratio)
    })
    try {
      const result = await window.electronAPI.export.run({
        format: selected,
        folderPath: folder || undefined,
        pages,
        resumeId
      } as never)
      if (result.canceled) {
        // 用户取消：静默关闭
      } else if (result.error) {
        setError(result.error)
      } else {
        setProgress(1)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      unsub()
      setRunning(false)
    }
  }, [selected, folder, pages, resumeId, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={running ? undefined : onClose}>
      <div
        className="w-[520px] max-w-[92vw] rounded-xl bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('export.title')}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{t('export.title')}</h2>
          <button type="button" className="text-lg text-foreground/50 hover:text-foreground" onClick={onClose} disabled={running} aria-label={t('export.close')}>
            ✕
          </button>
        </div>

        {/* 隐私联动提示（F16） */}
        {privacyMode ? (
          <div className="mb-3 rounded-md bg-[#fcebeb] px-3 py-2 text-xs text-[#a32d2d]">{t('export.privacyHint')}</div>
        ) : null}

        {/* 4 格式卡片 */}
        <div className="grid grid-cols-2 gap-2.5">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              disabled={!f.available || running}
              className={`rounded-lg border p-3 text-left transition-colors ${
                selected === f.id ? 'border-foreground/40 bg-selected/40' : 'border-border bg-surface hover:border-foreground/30'
              } ${!f.available ? 'cursor-not-allowed opacity-55' : ''}`}
              onClick={() => setSelected(f.id)}
            >
              <div className="text-sm font-medium text-foreground">{t(f.titleKey)}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-foreground/60">{t(f.descKey)}</div>
              {f.badge ? <div className="mt-1 text-[11px] text-foreground/40">{t(f.badge)}</div> : null}
            </button>
          ))}
        </div>

        {/* 页数提示（D12/D13） */}
        {selected === 'textPdf' && pageCount > 1 ? (
          <div className="mt-3 rounded-md bg-[#fff3cd] px-3 py-2 text-xs text-[#7a5c00]">
            {t('export.pageCountHint', { count: pageCount })}
            <div className="mt-1.5 flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="pages" checked={pages === 'all'} onChange={() => setPages('all')} disabled={running} />
                {t('export.pagesAll', { count: pageCount })}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="pages" checked={pages === 'first'} onChange={() => setPages('first')} disabled={running} />
                {t('export.pagesFirst')}
              </label>
              <span className="text-foreground/50">{t('export.pagesFirstWarn')}</span>
            </div>
          </div>
        ) : null}

        {/* 目标位置 */}
        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 text-xs text-foreground/70">{t('export.target')}</span>
          <input
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-foreground/40"
            value={folder}
            placeholder={t('export.defaultFolder')}
            onChange={(e) => setFolder(e.target.value)}
            disabled={running}
          />
          <Button size="sm" variant="outline" onClick={() => setFolder('')} disabled={running}>
            {t('export.chooseFolder')}
          </Button>
        </div>

        {/* 进度条 */}
        {running ? (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50">
              <div className="h-full bg-foreground/60 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-1 text-center text-xs text-foreground/60">{t('export.progress')}</div>
          </div>
        ) : null}

        {/* 错误提示 */}
        {error ? <div className="mt-2 text-xs text-[#a32d2d]">{error}</div> : null}

        {/* ATS 静态说明（D7：砍动态分级提示后的替代） */}
        <div className="mt-3 border-t border-border/70 pt-2 text-[11px] leading-relaxed text-foreground/45">{t('export.atsNote')}</div>

        {/* 操作按钮 */}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {t('export.cancel')}
          </Button>
          <Button onClick={() => void runExport()} disabled={running}>
            {t('export.run')}
          </Button>
        </div>

        {/* 隐藏的页数测量锚：真实渲染当前模板（A4 宽 794px，随内容撑高），仅测量用 */}
        <div className="pointer-events-none absolute -left-[9999px] top-0">
          <div className="preview-paper-body" ref={paperRef} style={{ width: 794 }}>
            <MeasureTemplate />
          </div>
        </div>
      </div>
    </div>
  )
}
