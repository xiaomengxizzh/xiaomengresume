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

export default function App(): React.JSX.Element {
  const { t } = useTranslation()
  useKeyboardShortcuts()
  useAppBootstrap()

  const currentView = useResumeStore((s) => s.currentView)

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