/**
 * welcome-view.test.tsx —— WelcomeView 欢迎页（补测试盲区批 T1）
 * 覆盖：标题 + 三按钮渲染；新建/打开按钮 setCurrentView 正确切视图；
 * WizardDialog 默认不开、点「使用向导」后打开。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeView } from '../WelcomeView'
import { useResumeStore } from '../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))

beforeEach(() => {
  useResumeStore.setState({
    resumeId: null,
    resume: createEmptyResume(),
    currentView: 'welcome',
    activeSection: null,
    activeFieldPath: null
  })
})

describe('WelcomeView（欢迎页）', () => {
  it('渲染品牌图 + 标题 + 三引导按钮', () => {
    render(<WelcomeView />)
    expect(screen.getByText('welcome.title')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'welcome.brandAlt' })).toBeTruthy()
    expect(screen.getByText('welcome.newResume')).toBeTruthy()
    expect(screen.getByText('welcome.openResume')).toBeTruthy()
    expect(screen.getByText('welcome.wizard')).toBeTruthy()
  })

  it('点「新建简历」→ currentView = resumes-new', () => {
    render(<WelcomeView />)
    fireEvent.click(screen.getByText('welcome.newResume'))
    expect(useResumeStore.getState().currentView).toBe('resumes-new')
  })

  it('点「打开简历」→ currentView = resumes-recent', () => {
    render(<WelcomeView />)
    fireEvent.click(screen.getByText('welcome.openResume'))
    expect(useResumeStore.getState().currentView).toBe('resumes-recent')
  })

  it('WizardDialog 默认不开；点「使用向导」后打开', () => {
    render(<WelcomeView />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByText('welcome.wizard'))
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    // 列表态标题 = wizard.title
    expect(screen.getByText('wizard.title')).toBeTruthy()
  })
})
