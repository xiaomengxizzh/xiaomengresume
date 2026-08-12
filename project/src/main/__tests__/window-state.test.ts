/**
 * window-state.test.ts —— M5 D4 窗口状态记忆纯函数（parse/校验/多屏可见性）
 * getWindowState/trackWindowState 依赖 electron（screen/win 事件），不单测（真机验证）。
 */
import { describe, it, expect } from 'vitest'
import { parseWindowState, ensureVisible } from '../files/window-state'

describe('parseWindowState', () => {
  it('合法状态解析通过', () => {
    const s = parseWindowState('{"x":100,"y":80,"width":1280,"height":800,"isMaximized":true}')
    expect(s).toEqual({ x: 100, y: 80, width: 1280, height: 800, isMaximized: true })
  })

  it('缺 width/height → 回落 null', () => {
    expect(parseWindowState('{"x":10,"y":10}')).toBeNull()
  })

  it('损坏 JSON → null', () => {
    expect(parseWindowState('not-json')).toBeNull()
  })

  it('极端脏值（宽 <400 / 高 <300）→ null', () => {
    expect(parseWindowState('{"width":100,"height":100}')).toBeNull()
  })

  it('isMaximized 非 true 视为 false', () => {
    const s = parseWindowState('{"width":1200,"height":700}')
    expect(s?.isMaximized).toBe(false)
  })
})

describe('ensureVisible（多屏拔出兜底）', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }]

  it('状态在屏内 → 保留位置', () => {
    const s = { x: 100, y: 100, width: 1280, height: 800 }
    expect(ensureVisible(s, displays)).toEqual(s)
  })

  it('状态完全在屏外（外接屏拔出）→ 回落仅尺寸（位置交给系统默认）', () => {
    const s = { x: 3000, y: 2000, width: 1280, height: 800 } // 1920×1080 屏外
    const r = ensureVisible(s, displays)
    expect(r).toEqual({ width: 1280, height: 800 })
    expect(r.x).toBeUndefined()
  })

  it('无 x/y（首启）→ 原样返回', () => {
    const s = { width: 1280, height: 800 }
    expect(ensureVisible(s, displays)).toEqual(s)
  })
})
