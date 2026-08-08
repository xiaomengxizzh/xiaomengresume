/**
 * ResumesList —— 「管理多份」/「打开或最近」简历列表（T1：recent 走 resumes:recent 按活动时间倒序）
 * 点击行 → 打开简历进入编辑器。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'

interface ListItem {
  id: string
  name: string
  time?: string
}

export function ResumesList({ mode = 'all' }: { mode?: 'all' | 'recent' }): React.JSX.Element {
  const { t } = useTranslation()
  const loadResume = useResumeStore((s) => s.loadResumeIntoEditor)
  const [items, setItems] = useState<ListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
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
      .catch((e: unknown) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [mode])

  const open = async (id: string): Promise<void> => {
    try {
      const resume = await window.electronAPI.resumes.open(id)
      loadResume(id, resume)
    } catch (e) {
      // P2 修复：文件被删/损坏时 open 抛错，原 unhandled rejection 无任何反馈
      setError(String(e))
    }
  }

  return (
    <div className="home-view">
      <h2 className="home-title">{mode === 'recent' ? t('navSub.openRecent') : t('homeCard.manage')}</h2>
      {error ? (
        <p className="text-xs text-foreground/60">{error}</p>
      ) : items === null ? (
        <p className="text-xs text-foreground/60">…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-foreground/60">{t('homeEmpty.resumes')}</p>
      ) : (
        <div className="resume-list">
          {items.map((r) => (
            <button key={r.id} type="button" className="resume-list-item" onClick={() => void open(r.id)}>
              <span className="resume-list-name">{r.name}</span>
              <span className="resume-list-meta">
                {r.time ? new Date(r.time).toLocaleString() : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
