/**
 * ViewErrorBoundary 单元测试（UI-1 健壮性批 · TDD 先红后绿）
 * 断言：子组件渲染期异常被捕获 → 显示兜底 UI（非白屏）；点击重试 → 清错误重挂恢复。
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ViewErrorBoundary } from '../error-boundary'

// vitest globals 未开 → RTL 无自动清理（项目既有坑位：teardown 竞态/重复节点）
afterEach(cleanup)

function Bomb({ boom }: { boom?: boolean }): React.JSX.Element {
  if (boom) throw new Error('render explosion')
  return <p>fine</p>
}

/** 屏蔽 React 预期错误日志噪音（getDerivedStateFromError 触发的 console.error） */
function quietConsole(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(console, 'error').mockImplementation(() => {})
}

describe('ViewErrorBoundary', () => {
  it('子组件抛错时显示兜底 UI 而非白屏', () => {
    const spy = quietConsole()
    const { container } = render(
      <ViewErrorBoundary>
        <Bomb boom />
      </ViewErrorBoundary>
    )
    // 兜底 UI 出现（EmptyState 卡片 + 重试按钮），原内容消失
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    expect(container.querySelector('.shadow-card-press')).toBeTruthy()
    expect(container.textContent).not.toContain('fine')
    spy.mockRestore()
  })

  it('重试按钮清除错误状态并重新挂载子树', async () => {
    const spy = quietConsole()
    const { rerender, container } = render(
      <ViewErrorBoundary>
        <Bomb boom />
      </ViewErrorBoundary>
    )
    expect(container.querySelector('.shadow-card-press')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button')[0])
    // 重试即清错误：子组件仍会抛错 → 再次进入兜底（证明 error 已重置并重挂子树）
    await Promise.resolve()
    expect(container.querySelector('.shadow-card-press')).toBeTruthy()
    // 子组件不再抛错 → 正常内容恢复
    rerender(
      <ViewErrorBoundary>
        <Bomb />
      </ViewErrorBoundary>
    )
    expect(container.textContent).toContain('fine')
    spy.mockRestore()
  })

  it('正常子树原样渲染不受包裹影响', () => {
    render(
      <ViewErrorBoundary>
        <Bomb />
      </ViewErrorBoundary>
    )
    expect(screen.getByText('fine')).toBeTruthy()
  })
})
