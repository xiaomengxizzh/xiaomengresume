/**
 * NewResumeView —— 新建简历二级选择界面（2026-08-09 T8 四大入口重构）
 * 左侧「新建空白简历」/ 右侧「导入已有简历」（导入功能完整迁移至此，原独立导入入口移除）。
 * 2026-08-11 A3：ImportHome lazy——消除静态引用。
 * M5-5 A5：新建空白 → 先选模板（三卡缩略图，默认模板预选）→ 开始新建。
 */
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { templateRegistry, type TemplateId } from '../templates/registry'
import { TemplatePreviewCard } from '../components/template-preview-card'

const ImportHome = lazy(() => import('./ImportHome').then((m) => ({ default: m.ImportHome })))

const TEMPLATE_IDS: TemplateId[] = ['classic', 'modern', 'compact']

export function NewResumeView(): React.JSX.Element {
  const { t } = useTranslation()
  const newResume = useResumeStore((s) => s.newResume)
  const defaultTemplateId = useResumeStore((s) => s.settings.defaultTemplateId)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const [showImport, setShowImport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [picked, setPicked] = useState<TemplateId>(() =>
    TEMPLATE_IDS.includes(defaultTemplateId as TemplateId) ? (defaultTemplateId as TemplateId) : 'classic'
  )

  if (showImport) {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-xs text-foreground/50">{t('common.loading')}</div>
        }
      >
        <ImportHome />
      </Suspense>
    )
  }

  // M5-5 A5：模板选择步骤（空白简历先选模板）
  if (showTemplates) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-[680px]">
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
              onClick={() => setShowTemplates(false)}
            >
              ← {t('common.back')}
            </button>
            <h2 className="text-sm font-semibold text-foreground">{t('newResume.chooseTemplate')}</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {TEMPLATE_IDS.map((id) => {
              const meta = templateRegistry[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPicked(id)}
                  className={`flex flex-col items-center gap-2 rounded-card border p-3 transition-all hover:-translate-y-1 hover:shadow-card-hover ${
                    picked === id ? 'border-foreground bg-selected/30' : 'border-border bg-surface shadow-card-press'
                  }`}
                >
                  <TemplatePreviewCard templateId={id} />
                  <span className="text-center text-xs font-medium text-foreground">
                    {t(meta.nameKey)}
                    {defaultTemplateId === id ? `（${t('newResume.default')}）` : ''}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-card transition-opacity hover:opacity-90"
              onClick={() => {
                newResume(picked)
                setCurrentView('editor')
              }}
            >
              {t('newResume.start')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-[680px]">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
            onClick={() => setCurrentView('resumes-home')}
          >
            ← {t('common.back')}
          </button>
          <h2 className="text-sm font-semibold text-foreground">{t('navSub.newResume')}</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface p-6 shadow-card-press transition-all hover:-translate-y-1 hover:shadow-card-hover"
            onClick={() => setShowTemplates(true)}
          >
            <span className="text-3xl" aria-hidden>📝</span>
            <span className="text-base font-semibold text-foreground">{t('newResume.blank')}</span>
            <span className="text-xs text-foreground/55">{t('newResume.blankDesc')}</span>
          </button>
          <button
            type="button"
            className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface p-6 shadow-card-press transition-all hover:-translate-y-1 hover:shadow-card-hover"
            onClick={() => setShowImport(true)}
          >
            <span className="text-3xl" aria-hidden>📥</span>
            <span className="text-base font-semibold text-foreground">{t('newResume.import')}</span>
            <span className="text-xs text-foreground/55">{t('newResume.importDesc')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
