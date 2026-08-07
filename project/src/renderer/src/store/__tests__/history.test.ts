import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHistoryManager } from '../history'
import { useResumeStore } from '../useResumeStore'
import { createEmptyResume, type Resume } from '@shared/schema/resume'

describe('createHistoryManager（F3 历史栈纯逻辑）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('入栈 + 撤销 + 重做', () => {
    const h = createHistoryManager<string>({ debounceMs: 0 })
    h.record('a')
    h.record('b')
    expect(h.canUndo()).toBe(true)
    expect(h.undo('c')).toBe('b') // 撤销：回退到 b
    expect(h.canRedo()).toBe(true)
    expect(h.redo('c')).toBe('c') // 重做：返回被撤销时的 current
    expect(h.canRedo()).toBe(false)
  })

  it('500ms 防抖合并：窗口内多次 record 只记一步', () => {
    vi.useFakeTimers()
    const h = createHistoryManager<string>()
    h.record('a') // t0
    vi.advanceTimersByTime(100)
    h.record('b') // 窗口内 → 合并丢弃
    vi.advanceTimersByTime(100)
    h.record('c') // 窗口内 → 合并丢弃
    expect(h.undoDepth).toBe(1)
    // 窗口结束（500ms 后）再提交 → 新一步
    vi.advanceTimersByTime(400)
    h.record('d')
    expect(h.undoDepth).toBe(2)
    // 撤销两步：d → 回 a（b/c 被合并掉）
    expect(h.undo('e')).toBe('d')
    expect(h.undo('e')).toBe('a')
    expect(h.canUndo()).toBe(false)
  })

  it('上限 50 步，超出丢弃最旧', () => {
    const h = createHistoryManager<string>({ limit: 50, debounceMs: 0 })
    for (let i = 0; i < 60; i++) h.record(`s${i}`)
    expect(h.undoDepth).toBe(50)
    expect(h.undo('cur')).toBe('s59')
    // 最旧的 s0..s9 已被丢弃
    expect(h.canUndo()).toBe(true)
  })

  it('撤销后新提交清空 redo', () => {
    const h = createHistoryManager<string>({ debounceMs: 0 })
    h.record('a')
    h.record('b')
    h.undo('c') // → b
    expect(h.redoDepth).toBe(1)
    h.record('x') // 新提交
    expect(h.redoDepth).toBe(0)
  })

  it('空栈 undo/redo 返回 undefined', () => {
    const h = createHistoryManager<string>()
    expect(h.undo('cur')).toBeUndefined()
    expect(h.redo('cur')).toBeUndefined()
  })

  it('clear 清空全部', () => {
    const h = createHistoryManager<string>({ debounceMs: 0 })
    h.record('a')
    h.undo('b')
    h.clear()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('撤销可还原 layout（快照覆盖排版参数）', () => {
    vi.useFakeTimers()
    const h = createHistoryManager<{ layout?: { themeColor?: string } }>({ debounceMs: 500 })
    const stateA = { layout: { themeColor: '#475569' } }
    h.record(stateA)
    vi.advanceTimersByTime(600)
    const stateB = { layout: { themeColor: '#1F6FEB' } }
    h.record(stateB)
    vi.advanceTimersByTime(600)
    const stateC = { layout: { themeColor: '#000000' } }
    h.record(stateC)
    // 当前状态 D（第四次变更后），undo 逐步还原 C → B → A
    const stateD = { layout: { themeColor: '#00FF00' } }
    const back1 = h.undo(stateD)
    expect(back1?.layout?.themeColor).toBe('#000000')
    const back2 = h.undo(back1 ?? stateD)
    expect(back2?.layout?.themeColor).toBe('#1F6FEB')
    const back3 = h.undo(back2 ?? stateD)
    expect(back3?.layout?.themeColor).toBe('#475569')
  })
})

describe('useResumeStore（F2 store 集成 · 轻测）', () => {
  beforeEach(() => {
    useResumeStore.setState({ resume: createEmptyResume(), activeSection: 'basics', activeFieldPath: null, historyTick: 0 })
  })

  it('setField 写入 + undo 还原', () => {
    const s = useResumeStore.getState()
    s.setField('basics.name', '宋哈娜')
    expect(useResumeStore.getState().resume.basics.name).toBe('宋哈娜')
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().resume.basics.name).toBe('')
    useResumeStore.getState().redo()
    expect(useResumeStore.getState().resume.basics.name).toBe('宋哈娜')
  })

  it('layout 变更可撤销（快照覆盖模板/主题色）', () => {
    const s = useResumeStore.getState()
    s.setField('layout.themeColor', '#475569')
    useResumeStore.getState().undo()
    const r: Resume = useResumeStore.getState().resume
    expect(r.layout?.themeColor).toBeUndefined()
  })

  it('append/remove 条目', () => {
    const s = useResumeStore.getState()
    s.appendItem('education', undefined)
    expect(useResumeStore.getState().resume.education).toHaveLength(1)
    useResumeStore.getState().removeItem('education', 0)
    expect(useResumeStore.getState().resume.education).toHaveLength(0)
  })

  it('newResume 清空历史', () => {
    const s = useResumeStore.getState()
    s.setField('basics.name', 'x')
    s.newResume()
    expect(useResumeStore.getState().canUndo()).toBe(false)
  })
})
