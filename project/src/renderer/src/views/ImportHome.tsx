/**
 * ImportHome —— M4a 导入入口（4 卡片：PDF / Word / JSON / 图片）
 * 点击 → electronAPI.import.run({ format }) → 成功进三步核对向导（ImportWizard）；
 * 扫描件/图片（needsVision）→ VISION_REQUIRED 提示（M4b 占位，不崩溃）；
 * 错误（PARSE_FAILED/NO_PROVIDER…）→ 按 code 查 i18n 提示。
 * 2026-08-09 P2-1/P2-5：图片卡标注 i18n 化（「敬请期待」，不再外泄内部代号 M4b）+ 四卡格式图标。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportDraft, ImportFormat, AiError } from '@shared/ipc-channels'
import { ImportWizard } from '../components/import/ImportWizard'
import { Button } from '../components/ui'
import { useResumeStore } from '../store/useResumeStore'

interface ImportCard {
  key: string
  format: ImportFormat
  titleKey: string
  descKey: string
  m4b?: boolean
}

/** P2-5：四格式线框图标（内联 SVG，零依赖，对齐 nav 图标 stroke 1.5 风格） */
function FormatIcon({ format }: { format: ImportFormat }): React.JSX.Element {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (format === 'pdf') {
    return (
      <svg {...common}>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 12l1.5 3 1.5-3M9.8 13.5h1.4M13 12l1.5 3L16 12" />
      </svg>
    )
  }
  if (format === 'docx') {
    return (
      <svg {...common}>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6M9 15h4" />
      </svg>
    )
  }
  if (format === 'json') {
    return (
      <svg {...common}>
        <path d="M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3 17l5-4 4 3 4-5 5 6" />
    </svg>
  )
}

const CARDS: ImportCard[] = [
  { key: 'pdf', format: 'pdf', titleKey: 'import.cardPdf', descKey: 'import.cardPdfDesc' },
  { key: 'word', format: 'docx', titleKey: 'import.cardWord', descKey: 'import.cardWordDesc' },
  { key: 'json', format: 'json', titleKey: 'import.cardJson', descKey: 'import.cardJsonDesc' },
  { key: 'image', format: 'image', titleKey: 'import.cardImage', descKey: 'import.cardImageDesc', m4b: true }
]

export function ImportHome(): React.JSX.Element {
  const { t } = useTranslation()
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const [busy, setBusy] = useState<'parsing' | 'mapping' | null>(null)
  const [draft, setDraft] = useState<ImportDraft | null>(null)
  const [vision, setVision] = useState<ImportDraft | null>(null)
  const [error, setError] = useState<AiError | null>(null)

  const startImport = async (format: ImportFormat): Promise<void> => {
    setBusy(format === 'json' ? 'parsing' : 'mapping')
    setError(null)
    setVision(null)
    try {
      const res = await window.electronAPI.import.run({ format })
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (res.data.needsVision) {
        setVision(res.data)
        return
      }
      setDraft(res.data)
    } catch (err) {
      // 2026-08-09 修复：任何异常（IPC handler 缺失/主进程未重启/时序）都不得静默——
      // 原无 catch，import.run reject 时 finally 清 busy 后无任何提示（用户端"无反馈"）。
      console.error('[import] run failed:', err)
      setError({ code: 'UNKNOWN', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(null)
    }
  }

  const reset = (): void => {
    setDraft(null)
    setVision(null)
    setError(null)
  }

  // 向导渲染（draft 就绪后替换卡片区）
  if (draft) {
    return (
      <>
        <ImportWizard draft={draft} onCancel={reset} />
        <div className="mt-2 text-center">
          <Button variant="ghost" size="sm" onClick={reset}>
            {t('import.cancelImport')}
          </Button>
        </div>
      </>
    )
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
        <h2 className="home-title">{t('import.title')}</h2>
      </div>
      <p className="home-subtitle">{t('import.subtitle')}</p>

      {vision ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[13px] text-amber-700">
          <span className="font-medium">{t('import.visionRequired')}</span>
          <span className="block text-xs opacity-80">（{vision.fileName} · {vision.format}）</span>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger">
          {t(`import.error.${error.code}`)}
          {error.code === 'NO_PROVIDER' ? (
            <span className="block text-xs opacity-80">（JSON 导入无需 AI，可直接使用）</span>
          ) : null}
          {error.code === 'UNKNOWN' && error.message ? (
            <span className="mt-1 block break-all text-xs opacity-70">{error.message}</span>
          ) : null}
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => setError(null)}>
            ✕
          </Button>
        </div>
      ) : null}

      {busy ? (
        <div className="home-card">
          <span className="home-card-title">{busy === 'mapping' ? t('import.mapping') : t('import.parsing')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CARDS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`home-card ${c.m4b ? 'disabled' : ''}`}
              title={c.m4b ? t('import.m4bBadge') : undefined}
              onClick={() => void startImport(c.format)}
            >
              <span className="home-card-title">
                <span className="mr-2 inline-flex text-foreground/60">
                  <FormatIcon format={c.format} />
                </span>
                {t(c.titleKey)}
                {c.m4b ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-border/40 px-1.5 py-0.5 text-[11px] font-normal text-foreground/55">
                    {t('import.m4bBadge')}
                  </span>
                ) : null}
              </span>
              <span className="home-card-desc">{t(c.descKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
