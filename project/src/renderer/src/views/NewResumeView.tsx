/**
 * NewResumeView —— 新建简历二级选择界面（2026-08-09 T8 四大入口重构）
 * 左侧「新建空白简历」/ 右侧「导入已有简历」（导入功能完整迁移至此，原独立导入入口移除）。
 * 2026-08-11 A3：ImportHome lazy——消除静态引用（App.tsx 动态 import 才能拆 chunk；
 * ImportWizard 链随 ImportHome 一起拆出主包）。
 */
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'

const ImportHome = lazy(() => import('./ImportHome').then((m) => ({ default: m.ImportHome })))

export function NewResumeView(): React.JSX.Element {
  const { t } = useTranslation()
  const newResume = useResumeStore((s) => s.newResume)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const [showImport, setShowImport] = useState(false)

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
            onClick={() => {
              newResume()
              setCurrentView('editor')
            }}
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
