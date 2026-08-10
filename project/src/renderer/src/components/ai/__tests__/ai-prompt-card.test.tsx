/**
 * ai-prompt-card.test.tsx —— AI 提示词卡（2026-08-09 重构：点击卡片展开/收起，默认提示词作灰色 placeholder）
 * 交互：默认提示词可见但不可直接编辑（placeholder）；点击卡片展开编辑；编辑界面右下角「重置/保存」。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k })
}))

import { AiPromptCard } from '../AiPromptCard'

const DEFAULT_TEXT = '你是资深中文简历校对。'

describe('AiPromptCard（2026-08-09 重构）', () => {
  it('折叠态：显示默认提示词（placeholder 文本），无编辑/还原按钮', () => {
    render(<AiPromptCard title="Grammar" value={null} defaultText={DEFAULT_TEXT} onSave={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByText(DEFAULT_TEXT)).toBeTruthy()
    expect(screen.queryByText('ai.prompts.edit')).toBeNull()
    expect(screen.queryByText('ai.prompts.reset')).toBeNull()
  })

  it('点击卡片展开 → textarea placeholder 为默认提示词（可见不可直接编辑），保存调 onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AiPromptCard title="Grammar" value="旧提示词" defaultText={DEFAULT_TEXT} onSave={onSave} onReset={vi.fn()} />)
    // 点击卡片头部展开
    fireEvent.click(screen.getByText('Grammar'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.placeholder).toBe(DEFAULT_TEXT) // 默认提示词 = placeholder
    fireEvent.change(textarea, { target: { value: '新提示词' } })
    fireEvent.click(screen.getByText('ai.prompts.save'))
    expect(onSave).toHaveBeenCalledWith('新提示词')
  })

  it('编辑界面右下角「重置」恢复预置默认（调 onReset 清自定义）', () => {
    const onReset = vi.fn().mockResolvedValue(undefined)
    render(<AiPromptCard title="Grammar" value="自定义" defaultText={DEFAULT_TEXT} onSave={vi.fn()} onReset={onReset} />)
    fireEvent.click(screen.getByText('Grammar')) // 展开
    fireEvent.click(screen.getByText('ai.prompts.reset'))
    expect(onReset).toHaveBeenCalled()
  })
})
