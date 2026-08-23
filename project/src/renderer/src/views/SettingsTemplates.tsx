/**
 * SettingsTemplates —— 模板设置屏（M5-5 模板设置主功能 + 2026-08-12 界面调整批重设计）
 * 重设计（用户定案）：设置屏改为「图书式翻书选择」——横排三槽位（中间当前模板完整突出、两侧露边），
 * 左右箭头循环切换；卡片零按钮，点击任意卡进入该模板的独立编辑视图（复用 A4 编辑能力），编辑视图独立返回按钮回图书。
 * 保留：A1 入口 + A6 默认模板可设（即时生效）+ A2 预览语义（编辑草稿不实时联动，点「保存」后 store 更新 → 预览重渲染）。
 * 示例数据 = shared/sample-resume.json（王晨，内嵌不进简历目录，与「打开示例」同源）。
 * 2026-08-23 R1+R2：编辑视图预览改 PaperFitShell（整页 A4 适配缩放，与编辑器右栏同比例）；
 * 预览数据改 makePreviewResume（layout 剥离为仅 templateId，滑杆实时预览生效）。
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { templateRegistry, getTemplate, type TemplateId } from '../templates/registry'
import { TemplateSettingsEditor } from '../components/settings/TemplateSettingsEditor'
import { TemplateBook } from '../components/template-book'
import { PaperFitShell } from '../preview/PaperFitShell'
import { makePreviewResume } from '../preview/make-preview-resume'

const TEMPLATE_IDS: TemplateId[] = ['classic', 'modern', 'compact']

export function SettingsTemplates(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useResumeStore((s) => s.settings)
  const setSettings = useResumeStore((s) => s.setSettings)
  const [selected, setSelected] = useState<TemplateId>(() =>
    TEMPLATE_IDS.includes(settings.defaultTemplateId as TemplateId) ? (settings.defaultTemplateId as TemplateId) : 'classic'
  )
  // null = 图书选择；非空 = 该模板独立编辑视图
  const [editing, setEditing] = useState<TemplateId | null>(null)
  // R2：layout 剥离为仅 templateId——ResumeBody 覆盖链回落 模板覆盖层草稿 > 出厂 preset（滑杆实时生效）；
  // 按编辑目标缓存深拷贝（滑杆重渲不再重复 clone 示例）
  const previewResume = useMemo(() => (editing === null ? null : makePreviewResume(editing)), [editing])

  const backBtn =
    'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground'

  // 编辑视图：独立全屏（返回回图书 + 模板名 + 左编辑面板 / 右真实渲染预览）
  if (editing !== null && previewResume !== null) {
    const Preview = getTemplate(editing).component
    return (
      <div className="home-view">
        <div className="flex items-center gap-2">
          <button type="button" className={backBtn} onClick={() => setEditing(null)}>
            ← {t('common.back')}
          </button>
          <h2 className="home-title">{t(templateRegistry[editing].nameKey)}</h2>
        </div>

        <div className="flex gap-4">
          <div className="w-64 shrink-0">
            <div className="rounded-lg border border-border p-4">
              <TemplateSettingsEditor templateId={editing} />
            </div>
          </div>
          {/* R1：整页 A4 适配缩放壳——容器必须 flex 列 + 确定高度（.preview-pane 依赖 flex:1
              撑高算 scale，非 flex 触发 ResizeObserver 缩放死循环）；与编辑器右栏同比例 */}
          <div className="flex h-[70vh] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border">
            <PaperFitShell>
              <Preview resume={previewResume} />
            </PaperFitShell>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-view">
      <div className="flex items-center gap-2">
        <button type="button" className={backBtn} onClick={() => useResumeStore.getState().setCurrentView('settings-home')}>
          ← {t('common.back')}
        </button>
        <h2 className="home-title">{t('settings.templates.title')}</h2>
      </div>

      {/* A6：默认模板（新建空白预选，即时生效）；UI 诊断：与图书卡语义区分说明——
          此处选「新建时预选哪个」，下方图书卡是「进入编辑该模板参数」 */}
      <div>
        <div className="mb-2 text-sm text-foreground/80">
          {t('settings.templates.defaultTemplate')}
          <span className="ml-2 text-xs text-foreground/45">{t('settings.templates.defaultTemplateHint')}</span>
        </div>
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

      {/* 图书式翻书选择（点任意卡进入编辑） */}
      <TemplateBook templates={TEMPLATE_IDS} selected={selected} onSelect={setSelected} onOpen={setEditing} />

      <div className="text-center text-xs text-foreground/50">{t('settings.templates.clickToEdit')}</div>
    </div>
  )
}
