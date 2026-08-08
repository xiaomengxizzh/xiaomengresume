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
 *
 * 2026-08-08 竞态修复：__exportReady 必须在【简历数据加载完成】后置位。
 * 原先在 mount 的 rAF 置位，而 useAppBootstrap 的 resumes.open 是异步 IPC
 * （数十~数百 ms），rAF（≈16ms）几乎必然先触发 → 主进程打印空模板 PDF。
 * 现以 resumeId 非空（loadResume 完成）为就绪条件，数据未就绪不渲染、不置位。
 */
function ExportView(): React.JSX.Element | null {
  const resume = useResumeStore((s) => s.resume)
  const resumeId = useResumeStore((s) => s.resumeId)
  const Template = getTemplate(resume.layout?.templateId).component

  // 就绪 = 目标简历已加载（loadResume 设置 resumeId；初始为 null）
  const ready = resumeId !== null

  useEffect(() => {
    if (!ready) return
    const params = new URLSearchParams(window.location.search)
    // D13：仅第一页 → 根节点挂 print-first-page-only（CSS overflow 截断）
    if (params.get('pages') === 'first') {
      document.body.classList.add('print-first-page-only')
    }
    // React 渲染 + 数据就绪后置位就绪标志（主进程轮询）
    requestAnimationFrame(() => {
      window.__exportReady = true
    })
    return () => {
      document.body.classList.remove('print-first-page-only')
    }
  }, [ready])

  // 数据未就绪：不渲染模板（避免主进程打印空内容），主进程 waitForReact 会等
  if (!ready) return null

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
