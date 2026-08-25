/**
 * EditorPane —— F2 编辑器表单区（§3.2/§3.3/§3.7，2026-08-07 UI 重构）
 * 分区切换由左侧 NavBar 接管（原顶部 chips 移除）；顶部排版条（LayoutBar）+ 当前 section 表单卡片；
 * 单元级工具：字体选择 + AI 润色占位；预览反查驱动滚动 + 高亮闪烁。
 * 全部走 i18n key（禁硬编码中文，CH4 扫描）。
 *
 * 2026-08-25 批 B 巨石拆分（行为零变化）：SectionCard/EntryCard→section-card.tsx；
 * Photo/Identity→basics-blocks.tsx；TagsBlock+IconCombo+validateTagValue→tags-block.tsx；
 * 七内置 Form→summary/education/work/projects/skills/certificates/languages-form.tsx；
 * CustomSectionForm→custom-section-form.tsx；ModuleDragHandle→module-drag-handle.tsx；
 * 编辑器注册表/POLISH_FIELDS/openAssist 桥→assist-bridge.ts；useField/FieldRow/getString→form-kit.tsx。
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { parsePath } from '@shared/paths'
import { Button, Dialog, Input } from '../ui'
import { LayoutBar } from './LayoutBar'
import { AiAssistPanel } from './AiAssistPanel'
import { getFieldEditor, setOpenAssist } from './assist-bridge'
import { PhotoBlock, IdentityBlock } from './basics-blocks'
import { TagsBlock } from './tags-block'
import { SummaryForm } from './summary-form'
import { EducationForm } from './education-form'
import { WorkForm } from './work-form'
import { ProjectsForm } from './projects-form'
import { SkillsForm } from './skills-form'
import { CertificatesForm } from './certificates-form'
import { LanguagesForm } from './languages-form'
import { CustomSectionForm } from './custom-section-form'
import { ModuleDragHandle } from './module-drag-handle'

/* ── 模块列表常量（2026-08-09 模块化编辑入口）────────────────────────────── */

/** 内置可排序板块默认顺序（与模板 DEFAULT_SECTION_ORDER 一致；basics/summary 固定顶部） */
export const DEFAULT_MODULE_ORDER = ['education', 'work', 'projects', 'skills', 'certificates', 'languages']

/** 2026-08-09 T3：模块主分区卡片图标（emoji，按模块类型） */
const MODULE_ICONS: Record<string, string> = {
  education: '🎓',
  work: '💼',
  projects: '🚀',
  skills: '⚙️',
  certificates: '📜',
  languages: '🌐'
}

/* ── 主组件 ─────────────────────────────────────────────────────────────── */

export function EditorPane(): React.JSX.Element {
  const { t } = useTranslation()
  const activeSection = useResumeStore((s) => s.activeSection)
  const setActiveSection = useResumeStore((s) => s.setActiveSection)
  const setActiveFieldPath = useResumeStore((s) => s.setActiveFieldPath)
  const activeFieldPath = useResumeStore((s) => s.activeFieldPath)
  const resumeId = useResumeStore((s) => s.resumeId)
  const jobId = useResumeStore((s) => s.aiContext.jobId)
  const containerRef = useRef<HTMLDivElement>(null)

  /** M3 F7/F8：AI 辅助面板会话（polish/grammar + 目标字段 + 选区冻结快照） */
  const [assist, setAssist] = useState<{
    kind: 'polish' | 'grammar'
    field: string
    frozen: { from: number; to: number; text: string } | null
  } | null>(null)

  // 注入 SectionCard 按钮的打开函数（Form 内按钮经模块级 openAssist 回调）
  useEffect(() => {
    setOpenAssist((kind, field) => {
      if (!resumeId) return
      const editor = getFieldEditor(field)
      let frozen: { from: number; to: number; text: string } | null = null
      if (kind === 'polish' && editor) {
        const { from, to } = editor.state.selection
        if (from !== to) {
          frozen = { from, to, text: editor.state.doc.textBetween(from, to) }
        }
      }
      setAssist({ kind, field, frozen })
    })
    return () => {
      setOpenAssist(null)
    }
  }, [resumeId])

  // 预览反查：切到目标 section + 滚动 + 高亮闪烁（§3.7）
  useEffect(() => {
    if (!activeFieldPath) return
    const { section } = parsePath(activeFieldPath)
    if (section === 'layout') return
    if (section !== activeSection) setActiveSection(section)
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(`[data-section="${section}"]`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) // 2026-08-07：nearest 只在目标不可见时才滚，不强行拉顶（避免点击编辑时整体上移）
        el.classList.add('rm-flash')
        setTimeout(() => el.classList.remove('rm-flash'), 1200)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [activeFieldPath, activeSection, setActiveSection])

  /* ── 模块列表（2026-08-09 模块化编辑入口）───────────────────────────────
     进入编辑器默认展示全部模块卡片（非单卡）；basics/summary 固定顶部；
     可排序板块 + 自定义模块按 layout.sectionOrder 排列，拖拽手柄重排。
     2026-08-25 批 B3：顶层粗粒度 s.resume 收敛为 customSections/layout 细粒度——
     本组件仅消费这两个低频字段（basics 打字不再触发整树重渲染；Zustand 引用相等语义下等价）。 */
  const customSections = useResumeStore((s) => s.resume.customSections)
  const layout = useResumeStore((s) => s.resume.layout)
  const setField = useResumeStore((s) => s.setField)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  // 2026-08-13 修复：新建模块弹窗（原 window.prompt 在 Electron 渲染进程未实现恒返回 null → 点击无反应）
  const [moduleDlg, setModuleDlg] = useState(false)
  const [moduleTitle, setModuleTitle] = useState('')

  const customIds = (customSections ?? []).map((c) => c.id)
  const order = layout?.sectionOrder?.length ? layout.sectionOrder : DEFAULT_MODULE_ORDER
  const modules = order.filter((id) => DEFAULT_MODULE_ORDER.includes(id) || customIds.includes(id))
  for (const cid of customIds) {
    if (!modules.includes(cid)) modules.push(cid) // 未入序的自定义模块追加尾部
  }

  const BUILTIN_FORMS: Record<string, () => React.JSX.Element> = {
    education: () => <EducationForm />,
    work: () => <WorkForm />,
    projects: () => <ProjectsForm />,
    skills: () => <SkillsForm />,
    certificates: () => <CertificatesForm />,
    languages: () => <LanguagesForm />
  }

  /* R6：基本信息三透明模块（图片/姓名与职业/标签信息）——主分区内联编辑 + 拖拽排序（basicsOrder） */
  const BASIC_BLOCK_IDS = ['photo', 'identity', 'tags'] as const
  const basicsOrder = layout?.basicsOrder?.length
    ? layout.basicsOrder
    : [...BASIC_BLOCK_IDS]
  const BASIC_BLOCK_TITLES: Record<string, string> = {
    photo: t('editor.basicsBlock.photo'),
    identity: t('editor.basicsBlock.identity'),
    tags: t('editor.basicsBlock.tags')
  }
  const [basicDrag, setBasicDrag] = useState<string | null>(null)
  const [basicDrop, setBasicDrop] = useState<string | null>(null)
  const handleBasicDrop = (targetId: string): void => {
    setBasicDrop(null)
    if (!basicDrag || basicDrag === targetId) return
    const list = basicsOrder.filter((id) => id !== basicDrag) as Array<'photo' | 'identity' | 'tags'>
    const idx = list.indexOf(targetId as 'photo' | 'identity' | 'tags')
    list.splice(idx < 0 ? list.length : idx, 0, basicDrag as 'photo' | 'identity' | 'tags')
    setField('layout.basicsOrder', list)
    setBasicDrag(null)
  }

  const handleDrop = (targetId: string): void => {
    setDropTarget(null)
    if (!dragId || dragId === targetId) return
    const list = modules.filter((id) => id !== dragId)
    const idx = list.indexOf(targetId)
    list.splice(idx < 0 ? list.length : idx, 0, dragId)
    setField('layout.sectionOrder', list)
    setDragId(null)
  }

  const addCustomModule = (): void => {
    // 2026-08-13 修复：弹窗输入标题（替代 window.prompt——Electron 渲染进程未实现，恒 null）
    setModuleTitle('')
    setModuleDlg(true)
  }
  const confirmAddCustomModule = (): void => {
    const title = moduleTitle.trim()
    if (!title) return
    const id = crypto.randomUUID()
    const next = [
      ...(customSections ?? []),
      { id, title, content: { type: 'doc', content: [] } as never }
    ]
    setField('customSections', next)
    setField('layout.sectionOrder', modules.concat([id]))
    setModuleDlg(false)
  }

  return (
    <div className="editor-pane" ref={containerRef}>
      <LayoutBar />
      <div className="editor-scroll-body">
        {activeSection === null || activeSection === 'basics' ? (
          /* ── 模块主分区（2026-08-09 R6）：基本信息三透明模块内联顶部 + 其余模块卡网格 ── */
          <>
            <div className="basics-inline" data-section="basics">
              {basicsOrder.map((bid) => (
                <div
                  key={bid}
                  className={`basics-module ${basicDrop === bid ? 'module-card-dragover' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setBasicDrop(bid)
                  }}
                  onDragLeave={() => setBasicDrop((d) => (d === bid ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleBasicDrop(bid)
                  }}
                >
                  <ModuleDragHandle id={bid} onDragStart={setBasicDrag} onDragEnd={() => setBasicDrag(null)} />
                  <div className="basics-module-title">{BASIC_BLOCK_TITLES[bid] ?? bid}</div>
                  {bid === 'photo' ? <PhotoBlock /> : bid === 'identity' ? <IdentityBlock /> : <TagsBlock />}
                </div>
              ))}
            </div>
            <div className="module-grid">
              <button type="button" className="module-card module-card-tile" onClick={() => setActiveSection('summary')}>
                <span className="module-tile-icon" aria-hidden>✍️</span>
                <span className="module-tile-title">{t('editor.section.summary')}</span>
              </button>
              {modules.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`module-card module-card-tile ${dropTarget === id ? 'module-card-dragover' : ''}`}
                  draggable
                  onDragStart={() => setDragId(id)}
                  onDragEnd={() => setDragId(null)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDropTarget(id)
                  }}
                  onDragLeave={() => setDropTarget((d) => (d === id ? null : d))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(id)
                  }}
                  onClick={() => setActiveSection(id)}
                >
                  <ModuleDragHandle id={id} onDragStart={setDragId} onDragEnd={() => setDragId(null)} />
                  <span className="module-tile-icon" aria-hidden>
                    {MODULE_ICONS[id] ?? '📄'}
                  </span>
                  <span className="module-tile-title">
                    {id === 'custom' ? t('editor.section.custom') : DEFAULT_MODULE_ORDER.includes(id) ? t(`editor.section.${id}`) : (customSections?.find((c) => c.id === id)?.title ?? t('editor.section.custom'))}
                  </span>
                </button>
              ))}
            </div>
            <div className="module-add-row">
              {/* 2026-08-13 需求①：添加模块面板——未显示的内置模块（点击加入）+ 自定义模块 */}
              {DEFAULT_MODULE_ORDER.filter((m) => !modules.includes(m)).map((m) => (
                <Button key={m} size="sm" variant="outline" onClick={() => setField('layout.sectionOrder', modules.concat([m]))}>
                  ＋ {t(`editor.section.${m}`)}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={addCustomModule}>
                ＋ {t('editor.module.add')}
              </Button>
            </div>
          </>
        ) : (
          /* ── 单模块编辑分区（一次仅显示一个；左上返回按钮回模块主分区）── */
          <div data-section={activeSection} className="module-edit-pane">
            <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2">
              <button
                type="button"
                className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
                onClick={() => {
                  setActiveSection(null)
                  // 2026-08-09 T4 修复：清反查路径——否则预览反查 effect（activeFieldPath 残留）
                  // 随 activeSection 变化重跑，用旧路径立即把视图拉回分区，返回键失效
                  setActiveFieldPath(null)
                }}
              >
                ← {t('common.back')}
              </button>
              <h3 className="text-sm font-semibold text-foreground">
                {activeSection === 'basics' || activeSection === 'summary' || DEFAULT_MODULE_ORDER.includes(activeSection)
                  ? t(`editor.section.${activeSection}`)
                  : (customSections?.find((c) => c.id === activeSection)?.title ?? t('editor.section.custom'))}
              </h3>
            </div>
            {activeSection === 'summary' ? (
              <SummaryForm />
            ) : BUILTIN_FORMS[activeSection]?.() ?? <CustomSectionForm id={activeSection} />}
          </div>
        )}
      </div>
      {assist ? (
        <AiAssistPanel
          kind={assist.kind}
          resumeId={resumeId ?? ''}
          jobId={jobId}
          field={assist.field}
          editor={getFieldEditor(assist.field)}
          frozen={assist.frozen}
          onClose={() => setAssist(null)}
        />
      ) : null}
      {/* 2026-08-13 修复：新建自定义模块弹窗（替代 window.prompt——Electron 渲染进程未实现） */}
      <Dialog open={moduleDlg} title={t('editor.module.add')} onClose={() => setModuleDlg(false)}>
        <div className="space-y-3">
          <Input
            autoFocus
            value={moduleTitle}
            placeholder={t('editor.module.prompt')}
            onChange={(e) => setModuleTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmAddCustomModule()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setModuleDlg(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="default" disabled={!moduleTitle.trim()} onClick={confirmAddCustomModule}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
