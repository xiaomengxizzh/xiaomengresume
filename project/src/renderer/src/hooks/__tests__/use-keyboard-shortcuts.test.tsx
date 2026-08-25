/**
 * use-keyboard-shortcuts.test.tsx —— P1 修复批 F7：Ctrl+Z 全局拦截限域
 * 现状：任意视图按 Ctrl+Z 都 preventDefault + store.undo()（AI 屏输入框原生撤销被吞、
 * 隐形改简历）。断言：仅 currentView === 'editor' 时拦截走统一撤销栈，其余视图放行原生。
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { createEmptyResume, type Resume } from '@shared/schema/resume'

afterEach(cleanup)

import { useKeyboardShortcuts } from '../useKeyboardShortcuts'
import { useResumeStore } from '../../store/useResumeStore'

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'

function resumeNamed(name: string): Resume {
  const r = createEmptyResume()
  r.basics.name = name
  return r
}

function pressCtrlZ(): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true })
  window.dispatchEvent(ev)
  return ev
}

beforeEach(() => {
  useResumeStore.getState().loadResume(ID, resumeNamed('v0'))
  useResumeStore.getState().setCurrentView('editor')
})

describe('useKeyboardShortcuts Ctrl+Z 限域（P1 F7）', () => {
  it('editor 视图：Ctrl+Z preventDefault + store.undo（统一撤销栈语义保持）', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => {
      useResumeStore.getState().setField('basics.name', 'v1')
    })
    const ev = pressCtrlZ()
    expect(ev.defaultPrevented).toBe(true)
    expect(useResumeStore.getState().resume.basics.name).toBe('v0')
  })

  it('非 editor 视图（welcome）：Ctrl+Z 放行原生，不改简历', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => {
      useResumeStore.getState().setField('basics.name', 'v1')
      useResumeStore.getState().setCurrentView('welcome')
    })
    const ev = pressCtrlZ()
    expect(ev.defaultPrevented).toBe(false)
    expect(useResumeStore.getState().resume.basics.name).toBe('v1')
  })
})
