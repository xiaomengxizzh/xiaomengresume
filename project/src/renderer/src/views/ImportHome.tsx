/**
 * ImportHome —— M4a 导入入口（4 卡片：PDF / Word / JSON / 图片）
 * 点击 → electronAPI.import.run({ format }) → 成功进三步核对向导（ImportWizard）；
 * 扫描件/图片（needsVision）→ VISION_REQUIRED 提示（M4b 占位，不崩溃）；
 * 错误（PARSE_FAILED/NO_PROVIDER…）→ 按 code 查 i18n 提示。
 * 图片卡片标注 M4b（点击仍可试选文件，主进程返回占位草稿提示）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImportDraft, ImportFormat, AiError } from '@shared/ipc-channels'
import { ImportWizard } from '../components/import/ImportWizard'
import { Button } from '../components/ui'

interface ImportCard {
  key: string
  format: ImportFormat
  titleKey: string
  descKey: string
  m4b?: boolean
}

const CARDS: ImportCard[] = [
  { key: 'pdf', format: 'pdf', titleKey: 'import.cardPdf', descKey: 'import.cardPdfDesc' },
  { key: 'word', format: 'docx', titleKey: 'import.cardWord', descKey: 'import.cardWordDesc' },
  { key: 'json', format: 'json', titleKey: 'import.cardJson', descKey: 'import.cardJsonDesc' },
  { key: 'image', format: 'image', titleKey: 'import.cardImage', descKey: 'import.cardImageDesc', m4b: true }
]

export function ImportHome(): React.JSX.Element {
  const { t } = useTranslation()
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
      <h2 className="home-title">{t('import.title')}</h2>
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
              onClick={() => void startImport(c.format)}
            >
              <span className="home-card-title">
                {t(c.titleKey)}
                {c.m4b ? <span className="ml-2 text-xs font-normal text-foreground/40">（M4b）</span> : null}
              </span>
              <span className="home-card-desc">{t(c.descKey)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
