/**
 * wizard-dialog.test.tsx —— 使用向导弹窗（B2 批，jsdom + RTL）
 * 覆盖：open=false 不渲染 / 列表态渲染全部 7 题标题 / 进步骤面板与返回 /
 * 「前往」直达（setCurrentView 正参 + onClose）/ 关闭重开回列表态。
 * i18n：沿用项目既有做法——mock react-i18next，t 原样返回 key。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))

import { WizardDialog } from '../WizardDialog'
import { WIZARD_TOPICS } from '../wizard-topics'
import { useResumeStore } from '../../../store/useResumeStore'

beforeEach(() => {
  useResumeStore.setState({ currentView: 'welcome' })
})

function renderDialog(onClose = vi.fn()): ReturnType<typeof vi.fn> {
  render(<WizardDialog open={true} onClose={onClose} />)
  return onClose
}

describe('WizardDialog', () => {
  it('open=false 不渲染任何容器', () => {
    const { container } = render(<WizardDialog open={false} onClose={vi.fn()} />)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('open=true 列表态：渲染全部 7 题标题（各一次）', () => {
    renderDialog()
    for (const tp of WIZARD_TOPICS) {
      expect(screen.getByText(`wizard.topics.${tp.id}.title`)).toBeTruthy()
    }
    expect(screen.getAllByText(/^wizard\.topics\..+\.title$/)).toHaveLength(WIZARD_TOPICS.length)
    // 分类小标题存在
    expect(screen.getByText('wizard.category.gettingStarted')).toBeTruthy()
  })

  it('点击某题 → 进入步骤面板（步骤文案/hint/返回按钮出现，其余题目消失）', () => {
    renderDialog()
    fireEvent.click(screen.getByText('wizard.topics.new-resume.title'))
    expect(screen.getByText('wizard.topics.new-resume.step1')).toBeTruthy()
    expect(screen.getByText('wizard.topics.new-resume.step2')).toBeTruthy()
    expect(screen.getByText('wizard.topics.new-resume.hint')).toBeTruthy()
    expect(screen.getByText('common.back')).toBeTruthy()
    expect(screen.queryByText('wizard.topics.template-color.title')).toBeNull()
  })

  it('点「前往」→ setCurrentView(正确 view) 被调且 onClose 被调', () => {
    const onClose = renderDialog()
    fireEvent.click(screen.getByText('wizard.topics.new-resume.title'))
    const spy = vi.spyOn(useResumeStore.getState(), 'setCurrentView')
    fireEvent.click(screen.getByText(/wizard\.go/))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('resumes-new')
    expect(useResumeStore.getState().currentView).toBe('resumes-new')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('返回按钮 → 回到问题列表态（7 题标题重新可见）', () => {
    renderDialog()
    fireEvent.click(screen.getByText('wizard.topics.import-resume.title'))
    expect(screen.getByText('common.back')).toBeTruthy()
    fireEvent.click(screen.getByText('common.back'))
    for (const tp of WIZARD_TOPICS) {
      expect(screen.getByText(`wizard.topics.${tp.id}.title`)).toBeTruthy()
    }
  })

  it('关闭重开 → 重置回问题列表态（不残留上次所选面板）', () => {
    const onClose = vi.fn()
    const { rerender } = render(<WizardDialog open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('wizard.topics.data-storage.title'))
    expect(screen.getByText('wizard.topics.data-storage.step1')).toBeTruthy()
    rerender(<WizardDialog open={false} onClose={onClose} />)
    rerender(<WizardDialog open={true} onClose={onClose} />)
    expect(screen.getByText('wizard.topics.new-resume.title')).toBeTruthy()
    expect(screen.queryByText('wizard.topics.data-storage.step1')).toBeNull()
  })

  it('多「前往」步骤的题（import-resume）两个直达按钮分别指向正确视图', () => {
    renderDialog()
    fireEvent.click(screen.getByText('wizard.topics.import-resume.title'))
    const goButtons = screen.getAllByRole('button', { name: /wizard\.go/ })
    expect(goButtons).toHaveLength(2)
    const spy = vi.spyOn(useResumeStore.getState(), 'setCurrentView')
    fireEvent.click(goButtons[0])
    expect(spy).toHaveBeenCalledWith('resumes-new')
    spy.mockRestore()
  })
})
