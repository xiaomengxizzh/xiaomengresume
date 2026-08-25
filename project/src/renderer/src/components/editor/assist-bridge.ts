/**
 * assist-bridge —— M3 F7/F8 编辑器 AI 辅助桥（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 * 字段编辑器注册表（TiptapField onEditorReady 登记）+ 润色白名单 + 面板打开回调桥。
 */
import type { Editor } from '@tiptap/react'

/** TiptapField onEditorReady 登记（润色/语法取实例读选区/替换） */
const fieldEditorRegistry = new Map<string, Editor>()

export function registerFieldEditor(path: string, editor: Editor | null): void {
  if (editor) fieldEditorRegistry.set(path, editor)
  else fieldEditorRegistry.delete(path)
}

/** 取未销毁的已登记编辑器（原 EditorPane 两处内联 `raw && !raw.isDestroyed ? raw : null` 收拢） */
export function getFieldEditor(path: string): Editor | null {
  const raw = fieldEditorRegistry.get(path)
  return raw && !raw.isDestroyed ? raw : null
}

/** 润色/语法白名单 section → 首选字段（F7 白名单；basics 数据型字段不出入口） */
export const POLISH_FIELDS: Record<string, string> = {
  summary: 'summary.content',
  education: 'education[0].description',
  work: 'work[0].summary',
  projects: 'projects[0].description'
}

type AssistKind = 'polish' | 'grammar'

/** 由主组件注入的 AI 辅助面板打开函数（Form 内 SectionCard 按钮经 requestAssist 回调） */
let openAssist: ((kind: AssistKind, field: string) => void) | null = null

/** EditorPane 主组件 effect 注入/卸载清空（原对模块级变量的赋值收拢到声明模块） */
export function setOpenAssist(fn: ((kind: AssistKind, field: string) => void) | null): void {
  openAssist = fn
}

/** Form 内按钮统一入口（未注入时 no-op，与原 `openAssist?.(...)` 等价） */
export function requestAssist(kind: AssistKind, field: string): void {
  openAssist?.(kind, field)
}
