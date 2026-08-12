import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAppBootstrap } from './hooks/useAppBootstrap'
import { useThemeApplier } from './hooks/useThemeApplier'
import { NavBar } from './components/nav/NavBar'
import { WindowControls } from './components/window-controls'
import { ResumesHome } from './views/ResumesHome'
import { SettingsHome } from './views/SettingsHome'
import { ResumesList } from './views/ResumesList'
import { ComingSoon } from './views/ComingSoon'
import { EditorView } from './views/EditorView'
import { SettingsAi } from './views/SettingsAi'
import { SettingsAppearance } from './views/SettingsAppearance'
import { SettingsStorage } from './views/SettingsStorage'
import { WelcomeView } from './views/WelcomeView'
import { NewResumeView } from './views/NewResumeView'
import { ResumesManager } from './views/ResumesManager'
import { JobsManager } from './views/JobsManager'
import { useResumeStore } from './store/useResumeStore'
import { getTemplate } from './templates/registry'

// 2026-08-11 A3：AI 五视图 + 导入首页 → 代码分割（lazy chunk，按需加载降启动峰值）。
// 编辑区/模板/ExportView 保持同步——高频核心交互 + export 模式需同步渲染保 __exportReady 时序。
const AiHome = lazy(() => import('./views/AiHome').then((m) => ({ default: m.AiHome })))
const AiGrammar = lazy(() => import('./views/AiGrammar').then((m) => ({ default: m.AiGrammar })))
const AiIntro = lazy(() => import('./views/AiIntro').then((m) => ({ default: m.AiIntro })))
const AiPolish = lazy(() => import('./views/AiPolish').then((m) => ({ default: m.AiPolish })))
const AiMatch = lazy(() => import('./views/AiMatch').then((m) => ({ default: m.AiMatch })))
const ImportHome = lazy(() => import('./views/ImportHome').then((m) => ({ default: m.ImportHome })))

/** A3：lazy 视图加载占位（本地 file:// chunk 毫秒级，防白屏） */
function ViewLoading(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center text-xs text-foreground/50">
      {t('common.loading')}
    </div>
  )
}

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
    let alive = true
    const params = new URLSearchParams(window.location.search)
    // D13：仅第一页 → 根节点挂 print-first-page-only（CSS overflow 截断）
    if (params.get('pages') === 'first') {
      document.body.classList.add('print-first-page-only')
    }
    const finalize = (): void => {
      // React 渲染 + 数据就绪后置位就绪标志（主进程轮询）
      if (alive) requestAnimationFrame(() => { window.__exportReady = true })
    }
    // B2（2026-08-11 photo 转存）：photo 为路径引用 → 预读为 dataURL 注入 store——
    // 模板同步渲染照片，printToPDF 同步快照不丢照片（预览场景由 ResumeBody 内部异步加载；
    // 导出场景在此握手，避免缺照片竞态）。预读失败（null）不阻断导出（模板回退无照片）。
    const photo = useResumeStore.getState().resume.basics.photo
    if (
      typeof photo === 'string' &&
      photo.trim().length > 0 &&
      !photo.trim().startsWith('data:') &&
      !['avatar', '/avatar.png', 'avatar.png'].includes(photo.trim())
    ) {
      void window.electronAPI.resumes.readPhoto(photo.trim()).then((dataUrl) => {
        if (!alive) return
        if (dataUrl) {
          const s = useResumeStore.getState()
          useResumeStore.setState({ resume: { ...s.resume, basics: { ...s.resume.basics, photo: dataUrl } } })
        }
        finalize()
      })
      return () => {
        alive = false
        document.body.classList.remove('print-first-page-only')
      }
    }
    finalize()
    return () => {
      alive = false
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
  useThemeApplier() // M5-4：外观应用（4 色/跟随系统/自定义主题派生/--ui-font）

  const currentView = useResumeStore((s) => s.currentView)

  // M2 F5 D10：导出模式（打印窗口专用）——不挂 UI 壳，只渲染模板
  const isExportMode = new URLSearchParams(window.location.search).get('export') === '1'

  if (isExportMode) {
    return <ExportView />
  }

  const renderView = (): React.JSX.Element => {
    if (currentView === 'welcome') return <WelcomeView /> // 2026-08-09：默认初始页 = 独立欢迎界面
    if (currentView === 'editor') return <EditorView />
    if (currentView === 'resumes-home') return <ResumesHome />
    if (currentView === 'resumes-list') return <ResumesList />
    if (currentView === 'resumes-recent') return <ResumesList mode="recent" />
    if (currentView === 'resumes-new') return <NewResumeView /> // 2026-08-09 T8：新建简历二级选择（含导入迁移）
    if (currentView === 'resumes-manage') return <ResumesManager /> // 2026-08-09 T8：简历管理
    if (currentView === 'jobs-manage') return <JobsManager /> // 2026-08-09 T8：岗位管理
    if (currentView === 'import-home') return <ImportHome />
    if (currentView === 'ai-home') return <AiHome />
    // M3 AI 四分区（导航子项直达；共享 store.aiContext 与「当前简历」）
    if (currentView === 'ai:grammar') return <AiGrammar />
    if (currentView === 'ai:intro') return <AiIntro />
    if (currentView === 'ai:polish') return <AiPolish />
    if (currentView === 'ai:match') return <AiMatch />
    if (currentView === 'settings-home') return <SettingsHome />
    if (currentView === 'settings-ai') return <SettingsAi />
    // M5-4：外观/存储设置屏落地（替换 coming: 占位）
    if (currentView === 'settings-appearance') return <SettingsAppearance />
    if (currentView === 'settings-storage') return <SettingsStorage />
    if (currentView.startsWith('coming:')) {
      // 子页占位（M3 后剩余：appearance / storage；import 已于 M4a 启用）
      const sub = currentView.slice('coming:'.length)
      const titleMap: Record<string, { title: string; desc?: string }> = {
        appearance: { title: t('navSub.appearance'), desc: t('homeDesc.appearance') },
        storage: { title: t('navSub.storage'), desc: t('homeDesc.storage') }
      }
      const m = titleMap[sub] ?? { title: sub }
      return <ComingSoon title={m.title} desc={m.desc} />
    }
    return <ResumesHome />
  }

  return (
    // M5 D4 无边框窗口壳：顶部 32px 拖拽区（window-drag-region）+ 右上三按钮（WindowControls）
    // 视图整体下移让位；export 模式（打印窗）早退不套此壳
    <div className="app-window-shell">
      <div className="window-drag-region" />
      <WindowControls />
      <div className="editor-shell" title={t('app.name')}>
        <NavBar />
        <div className="main-area">
          {/* A3：lazy 视图在 Suspense 内加载（fallback 防白屏） */}
          <Suspense fallback={<ViewLoading />}>{renderView()}</Suspense>
        </div>
      </div>
    </div>
  )
}
