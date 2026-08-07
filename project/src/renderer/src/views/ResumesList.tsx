/**
 * ResumesList —— 「管理多份」/「打开或最近」简历列表（拉取 resumes:list）
 * 点击行 → 打开简历进入编辑器。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import type { ResumeSummary } from '@shared/ipc-channels'

export function ResumesList(): React.JSX.Element {
  const { t } = useTranslation()
  const loadResume = useResumeStore((s) => s.loadResumeIntoEditor)
  const [items, setItems] = useState<ResumeSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.electronAPI.resumes
      .list()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch((e: unknown) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  const open = async (id: string): Promise<void> => {
    const resume = await window.electronAPI.resumes.open(id)
    loadResume(id, resume)
  }

  return (
    <div className="home-view">
      <h2 className="home-title">{t('homeCard.manage')}</h2>
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
                {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}