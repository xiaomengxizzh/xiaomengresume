/**
 * settings-templates.test.tsx —— SettingsTemplates 模板设置屏（补测试盲区批 T5，接线层）
 * makePreviewResume 工厂已有专测（preview/__tests__/make-preview-resume.test.ts），此处只测视图接线：
 * 图书态（返回/标题/默认模板区/三卡）渲染；点卡进编辑视图（TemplateSettingsEditor 滑杆面板 +
 * PaperFitShell 预览，预览数据 = 示例简历）；图书箭头循环切换；返回回图书态；
 * 默认模板按钮 → setSettings({defaultTemplateId}) → electronAPI.settings.set 接线。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsTemplates } from '../SettingsTemplates'
import { useResumeStore } from '../../store/useResumeStore'
import { defaultSettings } from '@shared/schema/settings'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k })
}))
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))

// TemplateBook / PaperFitShell 均依赖 ResizeObserver
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

const settingsSet = vi.fn()
;(window as unknown as { electronAPI: unknown }).electronAPI = {
  settings: { set: (...args: unknown[]) => settingsSet(...args) }
}

function bookCards(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[aria-label="settings.templates.openEditor"]')]
}

beforeEach(() => {
  settingsSet.mockReset()
  // setSettings 期望远端回写完整设置（merge 后）
  settingsSet.mockImplementation(async (patch: Record<string, unknown>) => ({
    ...useResumeStore.getState().settings,
    ...patch
  }))
  useResumeStore.setState({ settings: defaultSettings(), currentView: 'settings-templates' })
})

describe('SettingsTemplates（模板设置屏）', () => {
  it('图书态：返回 + 标题 + 默认模板区三按钮 + 三张模板卡', () => {
    const { container } = render(<SettingsTemplates />)
    expect(screen.getByText(/common\.back/)).toBeTruthy()
    expect(screen.getByText('settings.templates.title')).toBeTruthy()
    expect(screen.getByText('settings.templates.defaultTemplate')).toBeTruthy()
    const selects = [...container.querySelectorAll('button')]
    for (const id of ['classic', 'modern', 'compact']) {
      // 默认模板区按钮（书卡模板名只在 title 属性，不产生同名文本节点）
      expect(selects.some((b) => b.textContent === `editor.template.${id}`)).toBe(true)
    }
    expect(bookCards(container)).toHaveLength(3)
    expect(document.querySelector('.preview-paper')).toBeNull() // 图书态无整页预览壳
  })

  it('点卡进编辑视图：滑杆编辑面板 + PaperFitShell 预览（示例简历王晨）+ 返回', () => {
    const { container } = render(<SettingsTemplates />)
    // 默认 selected=classic → 左卡(prev) = compact；点任意卡都应进入其编辑视图
    fireEvent.click(bookCards(container)[0])
    // 编辑视图标题 = 该模板名
    expect(screen.getByText('editor.template.compact')).toBeTruthy()
    // TemplateSettingsEditor：6 数值滑杆
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(6)
    // R1：PaperFitShell 整页预览壳出现，内容为示例数据（makePreviewResume → 王晨）
    expect(document.querySelector('.preview-paper')).toBeTruthy()
    expect(document.querySelector('.preview-paper')?.textContent).toContain('王晨')
    // 图书态元素消失
    expect(bookCards(container)).toHaveLength(0)
    expect(screen.queryByText('settings.templates.defaultTemplate')).toBeNull()
  })

  it('图书箭头循环切换：next 后中卡变为下一模板', () => {
    const { container } = render(<SettingsTemplates />)
    fireEvent.click(screen.getByTitle('settings.templates.next'))
    // 中卡（index 1）title 跟随 selected
    const cards = bookCards(container)
    expect(cards[1].getAttribute('title')).toBe('editor.template.modern')
  })

  it('编辑视图返回按钮 → 回图书态', () => {
    const { container } = render(<SettingsTemplates />)
    fireEvent.click(bookCards(container)[0])
    expect(container.querySelectorAll('input[type="range"]').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText(/common\.back/))
    expect(screen.getByText('settings.templates.defaultTemplate')).toBeTruthy()
    expect(bookCards(container)).toHaveLength(3)
    expect(document.querySelector('.preview-paper')).toBeNull()
  })

  it('默认模板按钮 → setSettings({defaultTemplateId}) 经 settings:set 持久化并回写 store', async () => {
    const { container } = render(<SettingsTemplates />)
    const modernBtn = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'editor.template.modern'
    ) as HTMLButtonElement
    fireEvent.click(modernBtn)
    await waitFor(() =>
      expect(useResumeStore.getState().settings.defaultTemplateId).toBe('modern')
    )
    expect(settingsSet).toHaveBeenCalledWith(expect.objectContaining({ defaultTemplateId: 'modern' }))
  })
})
