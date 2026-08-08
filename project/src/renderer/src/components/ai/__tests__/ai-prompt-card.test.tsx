/**
 * ai-prompt-card.test.tsx —— AI 提示词卡状态机（M3）：只读灰 → 编辑 → 保存 / 取消 / 还原
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k })
}))

import { AiPromptCard } from '../AiPromptCard'

describe('AiPromptCard（提示词状态机）', () => {
  it('未自定义（value=null）：只读展示提示 + 无还原按钮', () => {
    render(<AiPromptCard title="Grammar" value={null} onSave={vi.fn()} onReset={vi.fn()} />)
    expect(screen.getByText('ai.prompts.hint')).toBeTruthy()
    expect(screen.queryByText('ai.prompts.reset')).toBeNull()
  })

  it('编辑 → 保存 → onSave 被调（写 store）', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AiPromptCard title="Grammar" value="旧提示词" onSave={onSave} onReset={vi.fn()} />)
    fireEvent.click(screen.getByText('ai.prompts.edit'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '新提示词' } })
    fireEvent.click(screen.getByText('ai.prompts.save'))
    expect(onSave).toHaveBeenCalledWith('新提示词')
  })

  it('有自定义值时显示还原按钮，点击触发 onReset', () => {
    const onReset = vi.fn().mockResolvedValue(undefined)
    render(<AiPromptCard title="Grammar" value="自定义" onSave={vi.fn()} onReset={onReset} />)
    fireEvent.click(screen.getByText('ai.prompts.reset'))
    expect(onReset).toHaveBeenCalled()
  })
})
