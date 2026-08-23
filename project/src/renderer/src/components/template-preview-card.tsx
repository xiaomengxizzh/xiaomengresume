/**
 * TemplatePreviewCard —— 模板卡真实预览（M5-7：不用模拟 thumb，真实模板渲染示例数据 + scale 缩小）
 * 用户要求：模板页面采用模板预览画面，不要采用模拟渲染图。
 * 实现：A4 纸张（794×1123）真实渲染示例数据（王晨，shared 单一事实源）→ transform scale 缩小到卡片尺寸；
 * pointer-events:none 防误触（模板内交互元素不响应）。
 * 2026-08-12 界面调整批：加可选 scale prop（图书式选择中间大卡 / 两侧小卡；默认 0.21 保持既有调用不变）。
 * 2026-08-23 R2：预览数据改 makePreviewResume——layout 剥离为仅剩组件 prop 的 templateId，
 * 覆盖链回落 模板覆盖层 > 各模板出厂 preset（此前三卡全被王晨 classic layout 压死）。
 */
import { memo } from 'react'
import { getTemplate, type TemplateId } from '../templates/registry'
import { makePreviewResume } from '../preview/make-preview-resume'
import type { Resume } from '@shared/schema/resume'

/** 卡内可视宽约 170 → 默认 scale 0.21 显示 A4 顶部（含头部+首节） */
const SCALE_DEFAULT = 0.21
/** per-templateId 预览数据缓存（卡渲染只读不 mutate；3 模板封顶 3 份，避免每次渲染深拷贝示例） */
const PREVIEW_RESUMES: Partial<Record<TemplateId, Resume>> = {}
function previewResumeFor(templateId: TemplateId): Resume {
  return (PREVIEW_RESUMES[templateId] ??= makePreviewResume(templateId))
}

interface Props {
  templateId: TemplateId
  scale?: number
}

export const TemplatePreviewCard = memo(function TemplatePreviewCard({ templateId, scale = SCALE_DEFAULT }: Props): React.JSX.Element {
  const Comp = getTemplate(templateId).component
  const W = Math.round(794 * scale)
  const H = Math.round(1123 * scale)
  return (
    <div
      className="pointer-events-none overflow-hidden rounded-md border border-border bg-white"
      style={{ width: W, height: H, margin: '0 auto' }}
      aria-hidden
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 794 }}>
        <Comp resume={previewResumeFor(templateId)} />
      </div>
    </div>
  )
})
