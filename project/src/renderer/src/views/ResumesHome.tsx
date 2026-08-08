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

  const items: HomeItem[] = [
    {
      key: 'newBlank',
      titleKey: 'homeCard.newBlank',
      descKey: 'homeCard.newBlankDesc',
      onClick: () => {
        // P1 修复（2026-08-08）：无条件新建空白。原实现用 resumeId 判断"是否已在编辑器上下文"，
        // 但启动恢复永久置位 resumeId → newResume() 分支不可达，老用户「新建空白」永远只是
        // 回到编辑器显示最近简历。当前简历内容已由自动保存落盘，新建不会丢失。
        newResume()
        setCurrentView('editor')
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