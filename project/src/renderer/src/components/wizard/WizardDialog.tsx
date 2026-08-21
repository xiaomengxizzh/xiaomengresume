/**
 * WizardDialog 使用向导弹窗（B2 批，2026-08-21 向导弹窗 D1-L1）
 * 复用 ui/dialog 模态壳（Esc/遮罩关闭内置）；两态：
 * list 问题列表（按 WIZARD_CATEGORIES 分组小标题）→ 步骤面板（编号步骤 +
 * 「前往」直达 + hint 完成标志行 + 返回）。文案全走 i18n（F13），key 由 B3 批补。
 * 样式只用令牌类（border-border/bg-surface/text-foreground 等）。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '../ui/dialog'
import { WIZARD_CATEGORIES, WIZARD_TOPICS } from './wizard-topics'
import type { WizardTargetView } from './wizard-topics'
import { useResumeStore } from '../../store/useResumeStore'

interface WizardDialogProps {
  open: boolean
  onClose: () => void
}

export function WizardDialog({ open, onClose }: WizardDialogProps): React.JSX.Element | null {
  const { t } = useTranslation()
  // null = 列表态；非空 = 所选题的步骤面板态
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  // 组件受控常驻挂载（open 为 prop）：关闭即清选择，保证重开必回问题列表态
  useEffect(() => {
    if (!open) setSelectedTopicId(null)
  }, [open])

  const topic =
    selectedTopicId !== null ? (WIZARD_TOPICS.find((tp) => tp.id === selectedTopicId) ?? null) : null

  /** 「前往」直达：切视图后关弹窗 */
  const goTo = (view: WizardTargetView): void => {
    useResumeStore.getState().setCurrentView(view)
    onClose()
  }

  return (
    <Dialog open={open} title={topic ? t(topic.titleKey) : t('wizard.title')} onClose={onClose}>
      {topic === null ? (
        <div className="flex flex-col gap-4">
          {WIZARD_CATEGORIES.map((cat) => {
            const catKey = `wizard.category.${cat}`
            const topics = WIZARD_TOPICS.filter((tp) => tp.categoryKey === catKey)
            if (topics.length === 0) return null
            return (
              <section key={cat}>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-foreground/60">
                  {t(catKey)}
                </h3>
                <div className="flex flex-col gap-2">
                  {topics.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      onClick={() => setSelectedTopicId(tp.id)}
                      className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-border/40"
                    >
                      {t(tp.titleKey)}
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          {/* L2 锚点：「没找到？问 AI」入口位（讨论稿 D1-L2，本批不实现） */}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {topic.steps.map((step, i) => {
            const target = step.targetView
            return (
              <div
                key={step.textKey}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="shrink-0 font-semibold text-foreground/50">{i + 1}</span>
                  <span className="min-w-0">{t(step.textKey)}</span>
                </span>
                {target !== undefined && (
                  <button
                    type="button"
                    onClick={() => goTo(target)}
                    className="shrink-0 cursor-pointer rounded-lg border border-border px-2.5 py-1 text-xs transition-colors hover:bg-border/40"
                  >
                    {t('wizard.go')} →
                  </button>
                )}
              </div>
            )
          })}
          {/* 完成标志行：本题主旨回顾 */}
          <p className="border-t border-border pt-3 text-xs text-foreground/60">{t(topic.hintKey)}</p>
          <div className="flex">
            <button
              type="button"
              onClick={() => setSelectedTopicId(null)}
              className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-border/40"
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
