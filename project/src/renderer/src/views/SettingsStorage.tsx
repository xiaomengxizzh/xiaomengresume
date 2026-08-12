/**
 * SettingsStorage —— M5-4 D3 存储位置屏（F21：设置区第 3 屏）
 * 数据层 storage 五通道已落码（choose/get/set/reset/open，2026-08-11）；
 * 本屏补齐 UI：当前路径 + 更改位置（迁移提示）+ 重置（二次确认）+ 打开文件夹。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { Button } from '../components/ui'
import type { StorageInfo, StorageSetResult } from '@shared/ipc-channels'

export function SettingsStorage(): React.JSX.Element {
  const { t } = useTranslation()
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [notice, setNotice] = useState('')

  const refresh = async (): Promise<void> => {
    setInfo(await window.electronAPI.storage.get())
  }
  useEffect(() => {
    void refresh()
  }, [])

  const changeLocation = async (): Promise<void> => {
    const dir = await window.electronAPI.storage.choose()
    if (!dir) return
    const result: StorageSetResult = await window.electronAPI.storage.set(dir)
    setNotice(t('settings.storage.migrated', { count: result.migrated }))
    await refresh()
  }
  const resetLocation = async (): Promise<void> => {
    if (!window.confirm(t('settings.storage.resetConfirm'))) return
    const dir = await window.electronAPI.storage.reset()
    setNotice(t('settings.storage.resetDone', { dir }))
    await refresh()
  }

  return (
    <div className="home-view">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => useResumeStore.getState().setCurrentView('settings-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="home-title">{t('settings.storage.title')}</h2>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="text-sm text-foreground/80">{t('settings.storage.currentPath')}</div>
        <div className="truncate rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-foreground/70" title={info?.currentPath}>
          {info?.currentPath ?? '—'}
        </div>
        {info?.exists === false ? <div className="text-xs text-danger">{t('settings.storage.notExist')}</div> : null}
        {notice ? <div className="text-xs text-foreground/60">{notice}</div> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="default" onClick={() => void changeLocation()}>
          {t('settings.storage.change')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void resetLocation()}>
          {t('settings.storage.reset')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void window.electronAPI.storage.open()}>
          {t('settings.storage.open')}
        </Button>
      </div>
    </div>
  )
}
