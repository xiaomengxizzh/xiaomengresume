/**
 * AiPolish —— AI 屏润色分区（F7 定案：润色入口在编辑器内，AI 屏为引导页）
 * 交互：顶栏选择简历/岗位后 → 「进入编辑器润色」→ 编辑器 SectionCard「AI 润色」按钮
 * 读取 aiContext.jobId 注入岗位要求；选区优先、无选中整字段（Q6 拍板）。
 * 2026-08-09 T7：删除多余提示文案「润色需要简历与岗位（未绑定岗位）」——保留引导卡，卡片位置大小不变。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiScreenLayout } from '../components/ai/AiScreenLayout'
import { EmptyState } from '../components/ui'

export function AiPolish(): React.JSX.Element {
  const { t } = useTranslation()
  const resumeId = useResumeStore((s) => s.aiContext.resumeId)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  return (
    <AiScreenLayout icon="polish" backTo="ai-home" title={t('navSub.polish')}>
      <div className="mx-auto flex max-w-[var(--ui-content-max-width)] flex-col items-center gap-3 py-8 text-center">
        <EmptyState
          title={t('navSub.polish')}
          desc={t('homeDesc.polish')}
          action={resumeId ? { label: `${t('common.open')} →`, onClick: () => setCurrentView('editor') } : undefined}
        />
      </div>
    </AiScreenLayout>
  )
}
