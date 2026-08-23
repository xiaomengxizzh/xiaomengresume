// @vitest-environment jsdom
/** R4（2026-08-23）：主题色覆盖链 = per-resume layout.themeColor > 模板覆盖层 templates[id].themeColor > 默认 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'
import { DEFAULT_THEME_COLOR } from '@shared/constants/theme-colors'

Element.prototype.scrollIntoView = (() => {}) as never
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))

// vitest globals 未开，RTL 无自动 cleanup——防 React 19 并发调度在 jsdom teardown 后执行
afterEach(() => cleanup())

function setup(layoutThemeColor: string | undefined, templateThemeColor: string | undefined): HTMLElement {
  const r = createEmptyResume()
  r.basics.name = '测试'
  if (layoutThemeColor) r.layout = { ...(r.layout ?? {}), themeColor: layoutThemeColor }
  useResumeStore.setState({
    resume: r,
    resumeId: 'x',
    settings: { ...useResumeStore.getState().settings, templates: templateThemeColor ? { classic: { themeColor: templateThemeColor } } : {} }
  })
  return render(<ResumeBody variant="classic" />).container
}

const accent = (container: HTMLElement): string => (container.firstElementChild as HTMLElement).style.getPropertyValue('--rm-accent')

describe('R4 主题色三层覆盖链（--rm-accent）', () => {
  it('无 layout.themeColor + 模板覆盖层有 themeColor → 用覆盖层色（核心 bug：原实现漏接此层）', () => {
    expect(accent(setup(undefined, '#2563EB'))).toBe('#2563EB')
  })

  it('layout.themeColor 存在 → per-resume 优先于模板覆盖层', () => {
    expect(accent(setup('#D97706', '#2563EB'))).toBe('#D97706')
  })

  it('两者都无 → 回落 DEFAULT_THEME_COLOR', () => {
    expect(accent(setup(undefined, undefined))).toBe(DEFAULT_THEME_COLOR)
  })
})
