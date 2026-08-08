import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppBootstrap } from './hooks/useAppBootstrap'
import { NavBar } from './components/nav/NavBar'
import { ResumesHome } from './views/ResumesHome'
import { AiHome } from './views/AiHome'
import { SettingsHome } from './views/SettingsHome'
import { ResumesList } from './views/ResumesList'
import { ComingSoon } from './views/ComingSoon'
import { EditorView } from './views/EditorView'
import { useResumeStore } from './store/useResumeStore'
import { getTemplate } from './templates/registry'

/**
 * M2 F5 D10：导出模式（隐藏打印窗口经 ?export=1&resumeId= 加载应用）
 * 只渲染当前简历的模板（含 data-redact 隐私）+ 「仅第一页」CSS 截断类，
 * 完成后置 window.__exportReady = true（主进程 waitForReact 轮询该标志）。
 */
function ExportView(): React.JSX.Element | null {
  const resume = useResumeStore((s) => s.resume)
  const Template = getTemplate(resume.layout?.templateId).component

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // D13：仅第一页 → 根节点挂 print-first-page-only（CSS overflow 截断）
    if (params.get('pages') === 'first') {
      document.body.classList.add('print-first-page-only')
    }
    // React 渲染完成后置位就绪标志（主进程轮询）
    requestAnimationFrame(() => {
      window.__exportReady = true
    })
    return () => {
      document.body.classList.remove('print-first-page-only')
    }
  }, [])

  return (
    <div className="export-root">
      <Template />
    </div>
  )
}

export default function App(): React.JSX.Element {
  const { t } = useTranslation()
  useKeyboardShortcuts()
  useAppBootstrap()

  const currentView = useResumeStore((s) => s.currentView)

  // M2 F5 D10：导出模式（打印窗口专用）——不挂 UI 壳，只渲染模板
  const isExportMode = new URLSearchParams(window.location.search).get('export') === '1'

  if (isExportMode) {
    return <ExportView />
  }

  const renderView = (): React.JSX.Element => {
    if (currentView === 'editor') return <EditorView />
    if (currentView === 'resumes-home') return <ResumesHome />
    if (currentView === 'resumes-list') return <ResumesList />
    if (currentView === 'ai-home') return <AiHome />
    if (currentView === 'settings-home') return <SettingsHome />
    if (currentView.startsWith('coming:')) {
      // 子页占位：'coming:grammar' → title 用对应子项 title
      const sub = currentView.slice('coming:'.length)
      const titleMap: Record<string, { title: string; desc?: string }> = {
        import: { title: t('homeCard.import'), desc: t('homeCard.importDesc') },
        jobs: { title: t('homeCard.jobs'), desc: t('homeCard.jobsDesc') },
        grammar: { title: t('navSub.grammar'), desc: t('homeDesc.grammar') },
        intro: { title: t('navSub.intro'), desc: t('homeDesc.intro') },
        polish: { title: t('navSub.polish'), desc: t('homeDesc.polish') },
        match: { title: t('navSub.match'), desc: t('homeDesc.match') },
        appearance: { title: t('navSub.appearance'), desc: t('homeDesc.appearance') },
        aiSettings: { title: t('navSub.aiSettings'), desc: t('homeDesc.aiSettings') },
        storage: { title: t('navSub.storage'), desc: t('homeDesc.storage') }
      }
      const m = titleMap[sub] ?? { title: sub }
      return <ComingSoon title={m.title} desc={m.desc} />
    }
    return <ResumesHome />
  }

  return (
    <div className="editor-shell" title={t('app.name')}>
      <NavBar />
      <div className="main-area">{renderView()}</div>
    </div>
  )
}
