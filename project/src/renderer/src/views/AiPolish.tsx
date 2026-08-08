/**
 * AiPolish —— AI 屏润色分区（F7 定案：润色入口在编辑器内，AI 屏为引导页）
 * 交互：顶栏选择简历/岗位后 → 「进入编辑器润色」→ 编辑器 SectionCard「AI 润色」按钮
 * 读取 aiContext.jobId 注入岗位要求；选区优先、无选中整字段（Q6 拍板）。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiContextBar } from '../components/ai/AiContextBar'

export function AiPolish(): React.JSX.Element {
  const { t } = useTranslation()
  const resumeId = useResumeStore((s) => s.aiContext.resumeId)
  const jobId = useResumeStore((s) => s.aiContext.jobId)
  const setCurrentView = useResumeStore((s) => s.setCurrentView)

  return (
    <div className="flex h-full flex-col">
      <AiContextBar />
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2">
        <h2 className="text-sm font-semibold">{t('navSub.polish')}</h2>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-foreground/70">{t('homeDesc.polish')}</p>
        <p className="text-xs text-foreground/50">
          {t('ai.polishDisabledHint')} {jobId ? '' : `（${t('ai.context.noJob')}）`}
        </p>
        <button
          type="button"
          className="rounded bg-foreground px-3 py-1 text-sm text-surface disabled:opacity-50"
          disabled={!resumeId}
          onClick={() => setCurrentView('editor')}
        >
          {t('common.open')} →
        </button>
      </div>
    </div>
  )
}
