/**
 * SettingsStorage —— M5-4 D3 存储位置屏（F21：设置区第 3 屏）
 * 数据层 storage 五通道已落码（choose/get/set/reset/open，2026-08-11）；
 * 本屏补齐 UI：当前路径 + 更改位置（迁移提示）+ 重置（二次确认）+ 打开文件夹。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { Button } from '../components/ui'
import { safeInvoke } from '../utils/safe-invoke'
import type { StorageInfo, StorageSetResult } from '@shared/ipc-channels'

export function SettingsStorage(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useResumeStore((s) => s.settings)
  const setSettings = useResumeStore((s) => s.setSettings)
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [notice, setNotice] = useState('')
  // G5：操作 busy 态——safeInvoke finally 复位，通道 reject 不再无反馈且可重复触发
  const [opsBusy, setOpsBusy] = useState(false)

  const refresh = async (): Promise<void> => {
    const next = await safeInvoke(window.electronAPI.storage.get(), { errorMessage: t('common.loadFailed') })
    if (next) setInfo(next)
  }
  useEffect(() => {
    void refresh()
  }, [])

  const changeLocation = async (): Promise<void> => {
    const dir = await safeInvoke(window.electronAPI.storage.choose(), { busy: setOpsBusy, errorMessage: t('common.opFailed') })
    if (!dir) return
    const result: StorageSetResult | null = await safeInvoke(window.electronAPI.storage.set(dir), {
      busy: setOpsBusy,
      errorMessage: t('common.opFailed')
    })
    if (!result) return
    setNotice(t('settings.storage.migrated', { count: result.migrated }))
    await refresh()
  }
  const resetLocation = async (): Promise<void> => {
    if (!window.confirm(t('settings.storage.resetConfirm'))) return
    const dir = await safeInvoke(window.electronAPI.storage.reset(), { busy: setOpsBusy, errorMessage: t('common.opFailed') })
    if (!dir) return
    setNotice(t('settings.storage.resetDone', { dir }))
    await refresh()
  }
  const exportLogs = async (): Promise<void> => {
    // 注意：logs.export() 以 null 表示「无日志」（合法解析值），与通道失败的 null 需区分
    const p = await safeInvoke(window.electronAPI.logs.export(), { busy: setOpsBusy, errorMessage: t('common.opFailed') })
    if (p === null) return
    setNotice(p ? t('settings.storage.logsExported', { path: p }) : t('settings.storage.logsNone'))
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
        <Button size="sm" variant="default" disabled={opsBusy} onClick={() => void changeLocation()}>
          {t('settings.storage.change')}
        </Button>
        <Button size="sm" variant="ghost" disabled={opsBusy} onClick={() => void resetLocation()}>
          {t('settings.storage.reset')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void window.electronAPI.storage.open()}>
          {t('settings.storage.open')}
        </Button>
        {/* M5-7 遗留处理：日志导出入口（关于页删除后补位于存储屏——数据/诊断语境） */}
        <Button size="sm" variant="ghost" disabled={opsBusy} onClick={() => void exportLogs()}>
          {t('settings.storage.exportLogs')}
        </Button>
      </div>

      {/* 2026-08-12 用户需求：关闭行为（最小化托盘 / 直接关闭；未设置时首次关窗弹窗询问） */}
      <div className="mt-6">
        <div className="mb-2 text-sm text-foreground/80">{t('settings.storage.closeBehavior.title')}</div>
        <div className="flex gap-2">
          {(['tray', 'quit'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setSettings({ closeBehavior: b })}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                settings.closeBehavior === b ? 'border-foreground bg-selected/40 text-foreground' : 'border-border text-foreground/70 hover:bg-selected/30'
              }`}
            >
              {t(`settings.storage.closeBehavior.options.${b}`)}
            </button>
          ))}
        </div>
        {!settings.closeBehavior ? (
          <div className="mt-1 text-xs text-foreground/50">{t('settings.storage.closeBehavior.notSet')}</div>
        ) : null}
      </div>
    </div>
  )
}
