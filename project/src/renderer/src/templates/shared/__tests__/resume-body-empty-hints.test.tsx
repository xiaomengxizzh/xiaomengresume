// @vitest-environment jsdom
// B6 空态预览占位（2026-08-11 Batch3）：emptyHints 仅编辑预览显示虚线占位，导出/默认不渲染（守「模板=打印」）
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

Element.prototype.scrollIntoView = (() => {}) as never

afterEach(() => cleanup())

function setResume(name: string): void {
  const r = createEmptyResume()
  r.basics.name = name
  useResumeStore.setState({ resume: r, resumeId: 'x' })
}

const dashedCount = (container: HTMLElement): number =>
  [...container.querySelectorAll('div')].filter((d) => (d as HTMLElement).style.border.includes('dashed')).length

describe('B6 空态预览占位（emptyHints）', () => {
  it('空简历 + emptyHints → 姓名/职业两条虚线占位框', () => {
    setResume('')
    const { container } = render(<ResumeBody variant="classic" emptyHints />)
    expect(dashedCount(container)).toBeGreaterThanOrEqual(2)
  })
  it('空简历默认（无 emptyHints = 导出/导入场景）→ 无占位', () => {
    setResume('')
    const { container } = render(<ResumeBody variant="classic" />)
    expect(dashedCount(container)).toBe(0)
  })
  it('姓名+职业均有 → 无占位（emptyHints 不污染非空态）', () => {
    const r = createEmptyResume()
    r.basics.name = '王晨'
    r.basics.headline = '前端工程师'
    useResumeStore.setState({ resume: r, resumeId: 'x' })
    const { container } = render(<ResumeBody variant="classic" emptyHints />)
    expect(dashedCount(container)).toBe(0)
  })
  it('有姓名但职业空 → 仅职业占位（≤1 条虚线）', () => {
    setResume('王晨')
    const { container } = render(<ResumeBody variant="classic" emptyHints />)
    expect(dashedCount(container)).toBeLessThanOrEqual(1)
  })
})
