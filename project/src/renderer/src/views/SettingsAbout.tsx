/**
 * SettingsAbout —— M5-6 D8 关于页（设置区）
 * 版本信息（app:get-info）+ 开源链接（GitHub）+ 导出日志按钮（logs:export）。
 * 许可声明/贡献指引不进前端 UI（用户定案：走项目文件 LICENSE/CONTRIBUTING）。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { Button } from '../components/ui'
import type { AppInfo } from '@shared/ipc-channels'

const GITHUB_URL = 'https://github.com/xiaomengxizzh/xiaomengresume'

export function SettingsAbout(): React.JSX.Element {
  const { t } = useTranslation()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void window.electronAPI.app.getInfo().then(setInfo)
  }, [])

  const exportLogs = async (): Promise<void> => {
    const p = await window.electronAPI.logs.export()
    if (p) setNotice(t('settings.about.logsExported', { path: p }))
    else setNotice(t('settings.about.logsNone'))
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
        <h2 className="home-title">{t('settings.about.title')}</h2>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/80">{t('settings.about.version')}</span>
          <span className="text-foreground">{info?.version ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/80">Electron</span>
          <span className="text-foreground/70">{info?.electron ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/80">Chromium</span>
          <span className="text-foreground/70">{info?.chrome ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/80">Node</span>
          <span className="text-foreground/70">{info?.node ?? '—'}</span>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm text-[var(--primary)] hover:underline"
        >
          {t('settings.about.sourceCode')} ↗
        </a>
        <div className="border-t border-border pt-3">
          <Button size="sm" variant="default" onClick={() => void exportLogs()}>
            {t('settings.about.exportLogs')}
          </Button>
          {notice ? <div className="mt-2 text-xs text-foreground/60">{notice}</div> : null}
        </div>
      </div>
    </div>
  )
}
