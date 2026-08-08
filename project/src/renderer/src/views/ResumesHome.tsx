/**
 * ResumesHome —— 简历主功能首页（5 卡片：新建/打开或最近/导入/管理/岗位目录）
 * 定案子功能清单（用户 2026-08-07 拍板）；「新建空白」直接进编辑器，其余跳子页或占位。
 * 2026-08-08 M2 L7/D14：顶部欢迎面板（基础版：欢迎文案 + 引导，不含最近简历区——随 M3 WP-T1）。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { HomeView, type HomeItem } from './HomeView'

export function ResumesHome(): React.JSX.Element {
  const { t } = useTranslation()
  const newResume = useResumeStore((s) => s.newResume)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)
  const resumeId = useResumeStore((s) => s.resumeId)

  const items: HomeItem[] = [
    {
      key: 'newBlank',
      titleKey: 'homeCard.newBlank',
      descKey: 'homeCard.newBlankDesc',
      onClick: () => {
        // 若已有当前简历（recent 自动加载），直接进编辑器；否则创建新空白
        if (resumeId) {
          setCurrentView('editor')
        } else {
          newResume()
          setCurrentView('editor')
        }
      }
    },
    {
      key: 'openRecent',
      titleKey: 'homeCard.openRecent',
      descKey: 'homeCard.openRecentDesc',
      onClick: () => setCurrentView('resumes-list')
    },
    {
      key: 'import',
      titleKey: 'homeCard.import',
      descKey: 'homeCard.importDesc',
      disabled: true,
      onClick: () => {
        // 导入向导随 M4（2026-08-08 清理：移除空操作占位 void t / void loadResume）
      }
    },
    {
      key: 'manage',
      titleKey: 'homeCard.manage',
      descKey: 'homeCard.manageDesc',
      onClick: () => setCurrentView('resumes-list')
    },
    {
      key: 'jobs',
      titleKey: 'homeCard.jobs',
      descKey: 'homeCard.jobsDesc',
      disabled: true,
      onClick: () => {
        // 岗位目录随 F19 v1.1
      }
    }
  ]
  return (
    <>
      {/* L7/D14：欢迎面板（基础版，welcome.* key 复活） */}
      <div className="mb-4 rounded-xl bg-surface p-5 shadow-sm">
        <div className="text-lg font-semibold text-foreground">{t('welcome.title')}</div>
        <div className="mt-1 text-sm text-foreground/60">{t('welcome.subtitle')}</div>
      </div>
      <HomeView items={items} />
    </>
  )
}