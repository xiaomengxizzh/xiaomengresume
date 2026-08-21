/**
 * 迭代优化批 P0-4/P0-1/P1-13 store 层回归（TDD 先红后绿）
 * - setAllItemsVisible / removeItems / moveItem：批量与重排操作，单条历史记录（一次撤销）
 * - patchSettingsLocal：模板实时预览用——仅本地合并，绝不触发 settings:set 持久化
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyResume } from '@shared/schema/resume'
import { useResumeStore } from '../useResumeStore'

type WorkItem = { id: string; company: string; visible?: boolean }

// electronAPI mock：patchSettingsLocal 断言不触发持久化（set 返回 resolved Promise 供 .then 链）
const setSpy = vi.fn(async (): Promise<unknown> => ({}))
;(globalThis as unknown as { window?: unknown }).window ??= {}
;(window as unknown as { electronAPI: unknown }).electronAPI = { settings: { set: setSpy } }

function seedWork(n: number): void {
  const r = createEmptyResume()
  r.work = Array.from({ length: n }, (_, i) => ({
    id: `w${i}`,
    company: `c${i}`,
    title: '',
    location: '',
    startDate: '',
    endDate: '',
    current: false,
    summary: undefined,
    highlights: [],
    visible: true
  })) as never
  useResumeStore.getState().loadResume('t-id', r)
}

function workItems(): WorkItem[] {
  return useResumeStore.getState().resume.work as unknown as WorkItem[]
}

beforeEach(() => {
  setSpy.mockClear()
  seedWork(3)
})

describe('P0-4 setAllItemsVisible（批量显隐 · 单历史步）', () => {
  it('全部隐藏后一次 undo 全部恢复', () => {
    const s = useResumeStore.getState()
    s.setAllItemsVisible('work', false)
    expect(workItems().every((w) => w.visible === false)).toBe(true)

    useResumeStore.getState().undo()
    expect(workItems().every((w) => w.visible !== false)).toBe(true)
  })

  it('空数组与非列表 section 安全返回（不入栈）', () => {
    seedWork(0)
    const before = useResumeStore.getState().historyTick
    useResumeStore.getState().setAllItemsVisible('work', false)
    useResumeStore.getState().setAllItemsVisible('basics', false)
    expect(useResumeStore.getState().historyTick).toBe(before)
  })
})

describe('P0-4 removeItems（批量删除 · 单历史步）', () => {
  it('按索引集合删除，保留其余相对顺序，一次 undo 恢复', () => {
    useResumeStore.getState().removeItems('work', [0, 2])
    expect(workItems().map((w) => w.id)).toEqual(['w1'])

    useResumeStore.getState().undo()
    expect(workItems().map((w) => w.id)).toEqual(['w0', 'w1', 'w2'])
  })

  it('乱序/越界索引安全：全部越界则不动', () => {
    useResumeStore.getState().removeItems('work', [9, -1])
    expect(workItems()).toHaveLength(3)
    useResumeStore.getState().removeItems('work', [2, 0])
    expect(workItems().map((w) => w.id)).toEqual(['w1'])
  })
})

describe('P0-1 moveItem（条目重排 · 单历史步）', () => {
  it('from→to 重排，一次 undo 恢复', () => {
    useResumeStore.getState().moveItem('work', 0, 2)
    expect(workItems().map((w) => w.id)).toEqual(['w1', 'w2', 'w0'])

    useResumeStore.getState().undo()
    expect(workItems().map((w) => w.id)).toEqual(['w0', 'w1', 'w2'])
  })

  it('目标越界 clamp 到边界；相同位置不动', () => {
    useResumeStore.getState().moveItem('work', 0, 99)
    expect(workItems().map((w) => w.id)).toEqual(['w1', 'w2', 'w0'])
    const tick = useResumeStore.getState().historyTick
    useResumeStore.getState().moveItem('work', 1, 1)
    expect(useResumeStore.getState().historyTick).toBe(tick)
  })
})

describe('P1-13 patchSettingsLocal（模板实时预览 · 仅本地）', () => {
  it('settings 本地生效且不调用 settings:set 持久化', () => {
    useResumeStore.getState().patchSettingsLocal({
      templates: { classic: { baseFontSize: 15 } }
    })
    expect(useResumeStore.getState().settings.templates?.classic?.baseFontSize).toBe(15)
    expect(setSpy).not.toHaveBeenCalled()
  })

  it('随后 setSettings 正常持久化（对照）', () => {
    useResumeStore.getState().setSettings({ templates: { classic: { lineHeight: 2 } } })
    expect(setSpy).toHaveBeenCalled()
  })
})
