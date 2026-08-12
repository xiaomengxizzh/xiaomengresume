/**
 * SettingsTemplates —— M5-5 模板设置主功能（设置区第 4 屏）
 * A1 入口承接 + A2 模板预览屏（示例数据真实渲染）+ A6 默认模板可设 + 编辑（M5-3 A4 组件接入）。
 * 预览语义（A2 定案）：编辑草稿不实时联动，点「保存」后 store 更新 → 预览自动重渲染。
 * 示例数据 = shared/sample-resume.json（王晨，内嵌不进简历目录，与「打开示例」同源）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { templateRegistry, getTemplate, type TemplateId } from '../templates/registry'
import { TemplateSettingsEditor } from '../components/settings/TemplateSettingsEditor'
import { migrate } from '@shared/schema/resume'
import sample from '@shared/sample-resume.json'

const TEMPLATE_IDS: TemplateId[] = ['classic', 'modern', 'compact']
// 示例数据（共享单一事实源；migrate 即 parse 兜底 schema 演进）
const PREVIEW_RESUME = migrate(sample)

export function SettingsTemplates(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useResumeStore((s) => s.settings)
  const setSettings = useResumeStore((s) => s.setSettings)
  const [selected, setSelected] = useState<TemplateId>(() =>
    TEMPLATE_IDS.includes(settings.defaultTemplateId as TemplateId) ? (settings.defaultTemplateId as TemplateId) : 'classic'
  )

  const Preview = getTemplate(selected).component

  return (
    <div className="home-view">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => useResumeStore.getState().setCurrentView('settings-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="home-title">{t('settings.templates.title')}</h2>
      </div>

      {/* A6：默认模板（新建空白预选） */}
      <div className="mb-4">
        <div className="mb-2 text-sm text-foreground/80">{t('settings.templates.defaultTemplate')}</div>
        <div className="flex gap-2">
          {TEMPLATE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSettings({ defaultTemplateId: id })}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                settings.defaultTemplateId === id ? 'border-foreground bg-selected/40 text-foreground' : 'border-border text-foreground/70 hover:bg-selected/30'
              }`}
            >
              {t(templateRegistry[id].nameKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* 左：模板列表（缩略图卡；覆盖标记） */}
        <div className="w-40 shrink-0 space-y-3">
          {TEMPLATE_IDS.map((id) => {
            const Th = templateRegistry[id].thumbnail
            const hasOverride = Boolean(settings.templates?.[id])
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`w-full rounded-card border p-2 transition-all ${
                  selected === id ? 'border-foreground bg-selected/30' : 'border-border bg-surface hover:bg-selected/20'
                }`}
              >
                <Th />
                <div className="mt-1 text-center text-xs text-foreground">
                  {t(templateRegistry[id].nameKey)}
                  {hasOverride ? <span className="ml-1 text-[10px] text-foreground/50">{t('settings.templates.customized')}</span> : null}
                </div>
              </button>
            )
          })}
        </div>

        {/* 右：预览（示例数据真实渲染，保存后更新）+ 编辑 */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="overflow-auto rounded-lg border border-border bg-surface p-4" style={{ maxHeight: '48vh' }}>
            <Preview resume={PREVIEW_RESUME} />
          </div>
          <div className="rounded-lg border border-border p-4">
            <TemplateSettingsEditor templateId={selected} />
          </div>
        </div>
      </div>
    </div>
  )
}
