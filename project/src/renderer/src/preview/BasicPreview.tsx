/**
 * BasicPreview —— F2 右栏实时预览壳（2026-08-08 M2 改造）
 * A4 一页式预览的缩放适配逻辑已抽取为 PaperFitShell（2026-08-23 R1，模板设置屏复用），
 * 本组件只负责选模板：store 实时预览 / 外部 preview 数据（导入向导草稿等）。
 * 2026-08-08 M2 L1 修复：按 layout.templateId 从 templateRegistry 取组件渲染（原硬编码 ClassicTemplate）。
 */
import { useResumeStore } from '../store/useResumeStore'
import { getTemplate } from '../templates/registry'
import type { Resume } from '@shared/schema/resume'
import { PaperFitShell } from './PaperFitShell'

export function BasicPreview({
  preview
}: {
  /** 外部简历预览（导入向导草稿等）：传入则用外部数据渲染对应模板；省略 = store 实时预览 */
  preview?: { resume: Resume; templateId?: string }
}): React.JSX.Element {
  const storeTemplateId = useResumeStore((s) => s.resume.layout?.templateId)

  // L1 修复：按 templateId 取组件（缺省回落 classic）
  // 注：store 模式 resume 内容订阅在 ResumeBody 内部（useThrottledResume，P2 rAF 合并），
  // 本壳不再额外订阅 resume——避免每键多一层重渲；preview 模式直接传外部 resume。
  const Template = preview ? getTemplate(preview.templateId).component : getTemplate(storeTemplateId).component

  return (
    <PaperFitShell>
      {preview ? <Template resume={preview.resume} emptyHints /> : <Template emptyHints />}
    </PaperFitShell>
  )
}
