/**
 * ResumesList —— 「管理多份」/「打开或最近」简历列表（T1：recent 走 resumes:recent 按活动时间倒序）
 * 点击行 → 打开简历进入编辑器。
 * 2026-08-09 P1-5：空态/错误态组件化（EmptyState + 重试 + 新建引导），不再裸显 IPC 错误原文。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { EmptyState } from '../components/ui'

interface ListItem {
  id: string
  name: string
  time?: string
}

export function ResumesList({
  mode = 'all',
  selectable = false,
  selected,
  onToggle,
  onToggleAll
}: {
  mode?: 'all' | 'recent'
  /** 2026-08-09 T2：选择模式（批量删除）——行首显示复选框 + 顶部全选 */
  selectable?: boolean
  selected?: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: (ids: string[]) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const loadResume = useResumeStore((s) => s.loadResumeIntoEditor)
  const newResume = useResumeStore((s) => s.newResume)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setItems(null)
    const load =
      mode === 'recent'
        ? window.electronAPI.resumes.recent().then((list) =>
            list.map((r) => ({ id: r.id, name: r.name, time: r.lastActivityAt }))
          )
        : window.electronAPI.resumes.list().then((list) =>
            list.map((r) => ({ id: r.id, name: r.name, time: r.updatedAt }))
          )
    load
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [mode, reloadTick])

  const open = async (id: string): Promise<void> => {
    try {
      const resume = await window.electronAPI.resumes.open(id)
      loadResume(id, resume)
    } catch (e) {
      // P2 修复：文件被删/损坏时 open 抛错，原 unhandled rejection 无任何反馈
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const createBlank = (): void => {
    newResume()
    setCurrentView('editor')
  }

  return (
    <div className="home-view">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => setCurrentView('resumes-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="home-title">{mode === 'recent' ? t('navSub.openResume') : t('homeCard.manage')}</h2>
      </div>
      {error ? (
        // P1-5：错误态组件化——友好文案 + 重试，不裸显 IPC 错误原文
        <EmptyState
          error
          title={t('resumeList.loadError')}
          desc={t('resumeList.loadErrorDesc')}
          secondary={{ label: t('resumeList.retry'), onClick: () => setReloadTick((v) => v + 1) }}
        />
      ) : items === null ? (
        <p className="text-xs text-foreground/60">…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title={t('homeEmpty.resumes')}
          desc={mode === 'recent' ? t('resumeList.emptyRecentDesc') : undefined}
          action={{ label: t('navSub.newBlank'), onClick: createBlank }}
        />
      ) : (
        <div className="resume-list">
          {selectable && items.length > 0 ? (
            <label className="mb-1 flex cursor-pointer items-center gap-2 px-1 text-xs text-foreground/70">
              <input
                type="checkbox"
                className="accent-foreground"
                checked={selected?.size === items.length}
                onChange={() => onToggleAll?.(items.map((r) => r.id))}
              />
              {t('resumesJobs.selectAll')}
            </label>
          ) : null}
          {items.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              {selectable ? (
                <input
                  type="checkbox"
                  className="shrink-0 accent-foreground"
                  checked={selected?.has(r.id) ?? false}
                  onChange={() => onToggle?.(r.id)}
                  aria-label={r.name}
                />
              ) : null}
              <button type="button" className="resume-list-item min-w-0 flex-1" onClick={() => void open(r.id)}>
                <span className="resume-list-name">{r.name}</span>
                <span className="resume-list-meta">
                  {r.time ? new Date(r.time).toLocaleString() : '—'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
