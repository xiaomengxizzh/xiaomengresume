/**
 * WelcomeView —— 独立欢迎界面（2026-08-09 用户改造；2026-08-10 简化）
 * 导航栏右侧默认初始页：品牌圆角图标 + 大标题 + 引导按钮（新建简历 / 打开简历）。
 * 2026-08-10：去紫色渐变背景容器（纯图标展示，图标=原容器尺寸）+ 删隐私声明文案。
 * 进入编辑器默认展示本页（store currentView 初始 'welcome'），不预载任何简历功能区。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { Button } from '../components/ui'

/** 品牌标志：material/图标_圆角.png（圆角版，与 public/icon.png 同源；品牌唯一标识） */
function BrandLogo(): React.JSX.Element {
  return <img src="/icon.png" alt="XM简历" className="h-20 w-20 object-contain" draggable={false} />
}

export function WelcomeView(): React.JSX.Element {
  const { t } = useTranslation()
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="w-full max-w-[520px] rounded-card border border-border p-10 text-center shadow-card-hover"
        style={{ background: 'linear-gradient(135deg, var(--brand-soft), var(--card) 62%)' }}
      >
        <div className="mb-5">
          <BrandLogo />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{t('welcome.title')}</h1>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {/* 2026-08-10 需求 1：新建简历 → 选择界面（新建空白/导入已有），与简历功能区同一 NewResumeView */}
          <Button variant="default" onClick={() => setCurrentView('resumes-new')}>
            {t('welcome.newResume')}
          </Button>
          <Button variant="outline" onClick={() => setCurrentView('resumes-recent')}>
            {t('welcome.openResume')}
          </Button>
        </div>
      </div>
    </div>
  )
}
