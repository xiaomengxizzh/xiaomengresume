/**
 * template-book.test.tsx —— 图书式模板选择器交互回归（2026-08-12 界面调整批）
 * 断言：三卡取模循环（左=前一模板 / 中=当前 / 右=后一模板）、左右箭头切换触发 onSelect、
 * 点击卡触发 onOpen、中间大两侧小的尺寸态。
 * 环境：jsdom（模板卡真实渲染需 scrollIntoView/ResizeObserver 兼容）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '../../i18n'
import { TemplateBook } from '../template-book'
import type { TemplateId } from '../../templates/registry'

Element.prototype.scrollIntoView = (() => {}) as never
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// vitest globals 未开，RTL 无自动 cleanup（同 resume-body-photo 范式）
afterEach(() => cleanup())

const TEMPLATES: TemplateId[] = ['classic', 'modern', 'compact']

function setup(selected: TemplateId): { onSelect: ReturnType<typeof vi.fn>; onOpen: ReturnType<typeof vi.fn> } {
  const onSelect = vi.fn()
  const onOpen = vi.fn()
  render(<TemplateBook templates={TEMPLATES} selected={selected} onSelect={onSelect} onOpen={onOpen} />)
  return { onSelect, onOpen }
}

describe('TemplateBook 图书式选择器', () => {
  it('三卡取模循环：左=前一模板 / 中=当前 / 右=后一模板（classic 时左=compact 右=modern）', () => {
    setup('classic')
    // 按钮序（DOM 顺序）：左箭头 / 左卡 / 中卡 / 右卡 / 右箭头
    const btns = screen.getAllByRole('button')
    expect(btns).toHaveLength(5)
    // title = 模板名（真实 i18n zh-CN）
    expect(btns[1].title).toBe('紧凑单栏') // prev(classic) = compact
    expect(btns[2].title).toBe('经典单栏') // selected = classic
    expect(btns[3].title).toBe('现代单栏') // next(classic) = modern
  })

  it('首尾相接：selected=compact 时 左=modern 右=classic（循环不越界）', () => {
    setup('compact')
    const btns = screen.getAllByRole('button')
    expect(btns[1].title).toBe('现代单栏')
    expect(btns[3].title).toBe('经典单栏')
  })

  it('点左箭头 → onSelect(前一模板)；点右箭头 → onSelect(后一模板)', () => {
    const { onSelect } = setup('modern')
    const btns = screen.getAllByRole('button')
    fireEvent.click(btns[0]) // 左箭头 → prev(modern) = classic
    expect(onSelect).toHaveBeenCalledWith('classic')
    fireEvent.click(btns[4]) // 右箭头 → next(modern) = compact
    expect(onSelect).toHaveBeenCalledWith('compact')
  })

  it('点击任意卡（中/左/右）→ onOpen 该模板 id', () => {
    const { onOpen } = setup('classic')
    const btns = screen.getAllByRole('button')
    fireEvent.click(btns[2]) // 中卡 classic
    expect(onOpen).toHaveBeenCalledWith('classic')
    fireEvent.click(btns[1]) // 左卡 compact
    expect(onOpen).toHaveBeenCalledWith('compact')
    fireEvent.click(btns[3]) // 右卡 modern
    expect(onOpen).toHaveBeenCalledWith('modern')
  })

  it('中间卡完整大 / 两侧卡露边小（scale 差异：中 0.4 两侧 0.22 → 宽 318 vs 175 被裁为 105）', () => {
    const { container } = render(
      <TemplateBook templates={TEMPLATES} selected="classic" onSelect={vi.fn()} onOpen={vi.fn()} />
    )
    const cards = container.querySelectorAll('[aria-hidden="true"]')
    // TemplatePreviewCard 根节点 aria-hidden + 固定 width 样式（794×scale）
    const widths = Array.from(cards).map((el) => (el as HTMLElement).style.width)
    expect(widths).toContain('318px') // 中间：794×0.4
    expect(widths).toContain('175px') // 两侧：794×0.22
    // 两侧露边容器宽 105（overflow 裁切）
    const sideContainers = container.querySelectorAll('[style*="width: 105px"]')
    expect(sideContainers).toHaveLength(2)
  })
})
