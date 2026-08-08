/**
 * useResumeStore —— F2 混合范式共享状态（M1）
 * 依据：《项目功能.md》F2。state：resume + activeSection + activeFieldPath；
 * actions：setField（提交级，走 F3 历史栈）/ setActiveSection / setActiveFieldPath /
 * loadResume / newResume / undo / redo。
 *
 * 编辑态 DOM ≠ 打印态 DOM：本 store 是唯一事实源，EditorPane/PreviewPane 共同消费。
 */
import { create } from 'zustand'
import type { Resume } from '@shared/schema/resume'
import { createEmptyResume } from '@shared/schema/resume'
import { setByPath, type FieldPath } from '@shared/paths'
import { createHistoryManager } from './history'

/** 模块级历史栈单例（F3；Tiptap 内部 undo 隔离，Ctrl+Z 聚焦时交回 Tiptap） */
const history = createHistoryManager<Resume>()

interface ResumeState {
  /** 当前简历 id（= <storageFolderPath>/<id>.json 文件名；ResumeSchema 顶层无 id） */
  resumeId: string | null
  resume: Resume
  /** 当前编辑 section（左侧导航/折叠状态） */
  activeSection: string
  /** 当前活动字段路径（预览反查定位用） */
  activeFieldPath: FieldPath | null
  /** 历史栈版本号（工具栏 undo/redo 可用性响应式） */
  historyTick: number
  /** 侧边栏完全收起标志（true = 宽 0；false = 展开 220px；2026-08-07 改为硬性完全收起） */
  sidebarCollapsed: boolean
  /** 当前右侧视图路由（2026-08-07 导航中枢雏形：'resumes-home' | 'editor' | 其他子视图） */
  currentView: string
  /** F16 隐私打码模式（2026-08-08 M2；只改渲染层，不触碰 Zod 数据模型） */
  privacyMode: boolean

  /** 提交级字段写入（失焦/回车/按钮触发；进 F3 撤销栈） */
  setField(path: FieldPath, value: unknown): void
  /** 数组条目级操作：追加空条目 / 复制 / 删除 / 切换 visible */
  appendItem(section: string, item: unknown): void
  duplicateItem(section: string, index: number): void
  removeItem(section: string, index: number): void
  toggleItemVisible(section: string, index: number): void
  setActiveSection(section: string): void
  setActiveFieldPath(path: FieldPath | null): void
  toggleSidebar(): void
  setCurrentView(view: string): void
  /** F16 隐私打码：切换隐私模式（不触碰 Zod 数据模型，只影响模板渲染层） */
  togglePrivacyMode(): void
  /** 打开简历：设置 id + 数据（不切视图，纯数据加载） */
  loadResume(resumeId: string, resume: Resume): void
  /**
   * 打开简历并进入编辑器（统一入口 · 2026-08-07 二次评估采纳）
   * 原子完成 loadResume + setCurrentView('editor')，避免各调用点漏切视图
   * （历史 bug：Ctrl+Shift+O 打开示例后视图停在原处，数据已换用户却看不见）。
   * 命名避开主进程 openResume() 避免混淆。
   */
  loadResumeIntoEditor(resumeId: string, resume: Resume): void
  /** 新建空白简历（生成新 uuid，自动保存即落盘 <id>.json） */
  newResume(): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
}

function cloneResume(r: Resume): Resume {
  return structuredClone(r)
}

/** 数组型 section 的追加工厂（带 uuid id） */
function createListItem(section: string): unknown {
  switch (section) {
    case 'education':
      return { id: crypto.randomUUID(), school: '', degree: '', major: '', startDate: '', endDate: '', location: '', gpa: '', description: undefined, visible: true }
    case 'work':
      return { id: crypto.randomUUID(), company: '', title: '', location: '', startDate: '', endDate: '', current: false, summary: undefined, highlights: [], visible: true }
    case 'projects':
      return { id: crypto.randomUUID(), name: '', role: '', organization: '', startDate: '', endDate: '', url: '', description: undefined, highlights: [], visible: true }
    case 'skills':
      return { id: crypto.randomUUID(), name: '', category: '', level: undefined }
    case 'certificates':
      return { id: crypto.randomUUID(), name: '', issuer: '', date: '', url: '' }
    case 'languages':
      return { id: crypto.randomUUID(), name: '', proficiency: undefined }
    default:
      throw new Error(`unknown list section: ${section}`)
  }
}

const LIST_SECTIONS = ['education', 'work', 'projects', 'skills', 'certificates', 'languages'] as const

export const useResumeStore = create<ResumeState>()((set, get) => ({
  resumeId: null,
  resume: createEmptyResume(),
  activeSection: 'basics',
  activeFieldPath: null,
  historyTick: 0,
  sidebarCollapsed: false,
  currentView: 'resumes-home',
  privacyMode: false,

  setField: (path, value) => {
    const next = cloneResume(get().resume)
    history.record(get().resume)
    // layout 首次写入前初始化（createEmptyResume 省略 layout = 回落模板预设）
    if (path.startsWith('layout.') && next.layout === undefined) {
      next.layout = {}
    }
    setByPath(next, path, value)
    set({ resume: next, activeFieldPath: path, historyTick: get().historyTick + 1 })
  },

  appendItem: (section, item) => {
    if (!LIST_SECTIONS.includes(section as (typeof LIST_SECTIONS)[number])) return
    const next = cloneResume(get().resume)
    history.record(get().resume)
    const arr = next[section as keyof Resume]
    if (Array.isArray(arr)) {
      ;(arr as unknown[]).push(item ?? createListItem(section))
    }
    set({ resume: next, historyTick: get().historyTick + 1 })
  },

  duplicateItem: (section, index) => {
    const next = cloneResume(get().resume)
    const arr = next[section as keyof Resume]
    if (!Array.isArray(arr) || index >= arr.length) return
    history.record(get().resume)
    const item = structuredClone((arr as unknown[])[index]) as { id: string }
    item.id = crypto.randomUUID()
    ;(arr as unknown[]).splice(index + 1, 0, item)
    set({ resume: next, historyTick: get().historyTick + 1 })
  },

  removeItem: (section, index) => {
    const next = cloneResume(get().resume)
    const arr = next[section as keyof Resume]
    if (!Array.isArray(arr) || index >= arr.length) return
    history.record(get().resume)
    ;(arr as unknown[]).splice(index, 1)
    set({ resume: next, historyTick: get().historyTick + 1 })
  },

  toggleItemVisible: (section, index) => {
    const next = cloneResume(get().resume)
    const arr = next[section as keyof Resume]
    if (!Array.isArray(arr) || index >= arr.length) return
    const item = (arr as unknown[])[index] as { visible?: boolean }
    history.record(get().resume)
    item.visible = !(item.visible ?? true)
    set({ resume: next, historyTick: get().historyTick + 1 })
  },

  setActiveSection: (section) => set({ activeSection: section }),
  setActiveFieldPath: (path) => set({ activeFieldPath: path }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setCurrentView: (view) => set({ currentView: view }),
  togglePrivacyMode: () => set((s) => ({ privacyMode: !s.privacyMode })),

  loadResume: (resumeId, resume) => {
    history.clear()
    set({
      resumeId,
      resume: structuredClone(resume),
      activeSection: 'basics',
      activeFieldPath: null,
      historyTick: get().historyTick + 1
    })
  },

  loadResumeIntoEditor: (resumeId, resume) => {
    useResumeStore.getState().loadResume(resumeId, resume)
    useResumeStore.getState().setCurrentView('editor')
  },

  newResume: () => {
    history.clear()
    set({
      resumeId: crypto.randomUUID(),
      resume: createEmptyResume(),
      activeSection: 'basics',
      activeFieldPath: null,
      historyTick: get().historyTick + 1
    })
  },

  undo: () => {
    const prev = history.undo(get().resume)
    if (prev !== undefined) {
      set({ resume: prev, historyTick: get().historyTick + 1 })
    }
  },

  redo: () => {
    const next = history.redo(get().resume)
    if (next !== undefined) {
      set({ resume: next, historyTick: get().historyTick + 1 })
    }
  },

  canUndo: () => history.canUndo(),
  canRedo: () => history.canRedo()
}))
