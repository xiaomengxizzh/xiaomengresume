/**
 * ResumesManager —— 简历管理（2026-08-09 T8 四大入口重构；T2 批量删除选择模式）
 * 简历目录列表（名称 + 最后编辑时间）+ 打开/新建/导入。
 * 批量删除：右上「批量删除」→ 进入选择模式（行复选框 + 顶部全选）→ 勾选删除。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { ResumesList } from './ResumesList'
import { Button } from '../components/ui'
import type { ImportBatchResult } from '@shared/ipc-channels'

export function ResumesManager(): React.JSX.Element {
  const { t } = useTranslation()
  const newResume = useResumeStore((s) => s.newResume)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  // R8：批量导入结果摘要（成功 N / 失败清单）
  const [batchResult, setBatchResult] = useState<ImportBatchResult | null>(null)

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = (ids: string[]): void => {
    setSelected((prev) => (prev.size === ids.length ? new Set() : new Set(ids)))
  }

  const removeSelected = async (): Promise<void> => {
    if (selected.size === 0) return
    if (!window.confirm(t('resumesJobs.confirmDelete', { count: selected.size }))) return
    setBusy(true)
    try {
      await Promise.all([...selected].map((id) => window.electronAPI.resumes.remove(id)))
      setSelected(new Set())
      setSelectMode(false)
      setReloadTick((v) => v + 1)
    } finally {
      setBusy(false)
    }
  }

  /** R8：批量导入（多选 → 主进程逐份落盘；结果摘要展示） */
  const runBatch = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await window.electronAPI.import.runBatch()
      if (res.ok) {
        setBatchResult(res.data)
        setReloadTick((v) => v + 1)
      } else if (res.error.code !== 'CANCELLED') {
        window.alert(t('import.batchFail', { code: res.error.code }))
      }
    } catch {
      window.alert(t('import.batchFail', { code: 'UNKNOWN' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2.5">
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => setCurrentView('resumes-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="text-sm font-semibold text-foreground">{t('navSub.manage')}</h2>
        <div className="ml-auto flex items-center gap-2">
          {selectMode ? (
            <>
              {selected.size > 0 ? (
                <Button size="sm" variant="danger" disabled={busy} onClick={() => void removeSelected()}>
                  {t('resumesJobs.bulkDelete')}（{selected.size}）
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectMode(false)
                  setSelected(new Set())
                }}
              >
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setCurrentView('resumes-new')}>
                {t('resumesManager.import')}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void runBatch()}>
                {t('resumesManager.batchImport')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectMode(true)}>
                {t('resumesJobs.bulkDelete')}
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={() => {
                  newResume()
                  setCurrentView('editor')
                }}
              >
                {t('resumesManager.new')}
              </Button>
            </>
          )}
        </div>
      </div>
      {/* R8：批量导入结果摘要 */}
      {batchResult ? (
        <div className="border-b border-border/70 bg-success-bg/60 px-4 py-2 text-xs">
          <span className="text-foreground">{t('import.batchDone', { count: batchResult.imported })}</span>
          {batchResult.failed.length > 0 ? (
            <span className="ml-2 text-danger">
              {t('import.batchFailed', { count: batchResult.failed.length })}：{batchResult.failed.map((f) => f.fileName).join('、')}
            </span>
          ) : null}
          <button type="button" className="ml-3 text-foreground/50 underline hover:text-foreground" onClick={() => setBatchResult(null)}>
            {t('common.close')}
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ResumesList
          key={reloadTick}
          mode="all"
          selectable={selectMode}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      </div>
    </div>
  )
}
