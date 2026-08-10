/**
 * templates/registry.ts —— 模板注册表（F4）
 * 2026-08-08 D11：组件签名修订为 store 驱动（无 props，统一从 useResumeStore 取数）。
 * 与《项目功能.md》F4 规格示例差异：规格写 `ComponentType<{ data: ResumeSchema }>`，
 * 终审 D11 拍板改为 store 驱动（避免 350 行组件 props 化 + 导出 SSR 桥接；导出走同源应用路线 D10）。
 */
import type { ComponentType } from 'react'
import type { TemplatePreset } from './shared/preset'
import { TEMPLATE_PRESETS } from '@shared/templates/layout'
import type { Resume } from '@shared/schema/resume'
import { ClassicTemplate } from './classic/ClassicTemplate'
import { ModernTemplate } from './modern/ModernTemplate'
import { CompactTemplate } from './compact/CompactTemplate'
import { ClassicThumb } from './classic/thumb'
import { ModernThumb } from './modern/thumb'
import { CompactThumb } from './compact/thumb'

export type TemplateId = 'classic' | 'modern' | 'compact'

/** 三套模板的排版预设（2026-08-10 收敛：值单一事实源 = shared/templates/layout.ts TEMPLATE_PRESETS） */
export const PRESETS: Record<TemplateId, TemplatePreset> = TEMPLATE_PRESETS as Record<TemplateId, TemplatePreset>

export interface TemplateMeta {
  id: TemplateId
  nameKey: string // i18n key，禁硬编码中文
  component: ComponentType<{ resume?: Resume }> // store 驱动（D11）；resume 可选（导入向导草稿预览）
  thumbnail: ComponentType // CSS 缩略图组件（thumb.tsx）
  preset: TemplatePreset // 排版预设（layout 覆盖链的缺省值）
}

export const templateRegistry: Record<TemplateId, TemplateMeta> = {
  classic: { id: 'classic', nameKey: 'editor.template.classic', component: ClassicTemplate, thumbnail: ClassicThumb, preset: PRESETS.classic },
  modern: { id: 'modern', nameKey: 'editor.template.modern', component: ModernTemplate, thumbnail: ModernThumb, preset: PRESETS.modern },
  compact: { id: 'compact', nameKey: 'editor.template.compact', component: CompactTemplate, thumbnail: CompactThumb, preset: PRESETS.compact }
}

export const defaultTemplateId: TemplateId = 'classic'

/** 按 id 取模板；非法/未知 id 回落默认（防御 TemplateBar 遗留脏值） */
export function getTemplate(id: string | undefined): TemplateMeta {
  if (id === undefined || id === '') return templateRegistry[defaultTemplateId]
  return templateRegistry[id as TemplateId] ?? templateRegistry[defaultTemplateId]
}
