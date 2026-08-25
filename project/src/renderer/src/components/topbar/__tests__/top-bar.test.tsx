/**
 * top-bar.test.tsx —— TopBar 编辑器顶栏（补测试盲区批 T3，含 TemplateBar 接线）
 * 覆盖：简历名称输入写 resume.title；模板 select 写 layout.templateId；字体 select 写
 * layout.resumeFont；隐私开关 togglePrivacyMode（aria-pressed 同步）；导出按钮回调；
 * 主题色板：点圆点开面板 → 选预设色写 layout.themeColor → 点外关闭。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from '../TopBar'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'
import { THEME_COLOR_PRESETS } from '@shared/constants/theme-colors'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k })
}))

beforeEach(() => {
  useResumeStore.setState({
    resumeId: 't3-id',
    resume: createEmptyResume(),
    currentView: 'editor',
    privacyMode: false,
    activeSection: null,
    activeFieldPath: null
  })
})

describe('TopBar（编辑器顶栏）', () => {
  it('渲染名称输入 / 模板与字体下拉 / 隐私开关 / 导出按钮', () => {
    render(<TopBar onExport={vi.fn()} />)
    expect(screen.getByPlaceholderText('editor.resumeNamePlaceholder')).toBeTruthy()
    const selects = document.querySelectorAll<HTMLSelectElement>('select')
    expect(selects).toHaveLength(2) // 模板 + 字体
    // 模板下拉三选项（F4 三套）
    expect([...selects[0].options].map((o) => o.value)).toEqual(['classic', 'modern', 'compact'])
    expect(selects[0].value).toBe('classic') // 无 layout 时回落默认模板
    expect(document.querySelector('button[aria-pressed]')).toBeTruthy()
    expect(screen.getByText('export.title')).toBeTruthy()
  })

  it('名称输入 → setField(title)', () => {
    render(<TopBar />)
    fireEvent.change(screen.getByPlaceholderText('editor.resumeNamePlaceholder'), {
      target: { value: '我的简历' }
    })
    expect(useResumeStore.getState().resume.title).toBe('我的简历')
  })

  it('模板 select 切换 → 写 layout.templateId；字体 select → layout.resumeFont', () => {
    render(<TopBar />)
    const selects = document.querySelectorAll<HTMLSelectElement>('select')
    fireEvent.change(selects[0], { target: { value: 'modern' } })
    expect(useResumeStore.getState().resume.layout?.templateId).toBe('modern')
    fireEvent.change(selects[1], { target: { value: 'songti' } })
    expect(useResumeStore.getState().resume.layout?.resumeFont).toBe('songti')
  })

  it('隐私开关：togglePrivacyMode + aria-pressed 同步', () => {
    render(<TopBar />)
    const btn = document.querySelector('button[aria-pressed]') as HTMLButtonElement
    expect(btn.getAttribute('aria-pressed')).toBe('false')
    expect(useResumeStore.getState().privacyMode).toBe(false)
    fireEvent.click(btn)
    expect(useResumeStore.getState().privacyMode).toBe(true)
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn)
    expect(useResumeStore.getState().privacyMode).toBe(false)
  })

  it('导出按钮点击 → onExport 回调被调', () => {
    const onExport = vi.fn()
    render(<TopBar onExport={onExport} />)
    fireEvent.click(screen.getByText('export.title'))
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('主题色板：点圆点开面板 → 选预设色写 layout.themeColor；点外关闭', () => {
    render(<TopBar />)
    // 面板默认不开
    expect(screen.queryByRole('dialog')).toBeNull()
    const swatch = document.querySelector('.theme-swatch') as HTMLButtonElement
    fireEvent.click(swatch)
    const panel = screen.getByRole('dialog', { name: 'editor.themeColor' })
    // 10 预设色圆点全在面板中
    const dots = [...panel.querySelectorAll<HTMLButtonElement>('.theme-swatch')]
    expect(dots).toHaveLength(THEME_COLOR_PRESETS.length)
    // 选第一个预设色 → 写入 per-resume layout.themeColor（面板保持开）
    fireEvent.click(dots[0])
    expect(useResumeStore.getState().resume.layout?.themeColor).toBe(THEME_COLOR_PRESETS[0].value)
    // 点外（mousedown 到 body）→ 面板关闭
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
