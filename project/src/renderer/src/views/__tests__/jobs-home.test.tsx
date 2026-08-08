/**
 * jobs-home.test.tsx —— 岗位目录管理屏（M3 F19 UI）：列表渲染 / 新建保存 / 删除确认
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))
vi.mock('@tiptap/react', () => ({
  useEditor: (): null => null,
  EditorContent: (): null => null
}))

import '../../i18n'
import { JobsHome } from '../JobsHome'

function mockElectronApi() {
  const api = {
    jobs: {
      list: vi.fn().mockResolvedValue([{ id: 'j1', name: '前端工程师', appliedAt: '2026-01' }]),
      get: vi.fn().mockResolvedValue({ id: 'j1', name: '前端工程师', appliedAt: '2026-01', requirements: 'React', createdAt: '', updatedAt: '' }),
      save: vi.fn().mockImplementation(async (job: unknown) => job),
      delete: vi.fn().mockResolvedValue(true)
    },
    resumes: {
      list: vi.fn().mockResolvedValue([{ id: 'r1', name: '张三', boundJobIds: ['j1'] }]),
      open: vi.fn().mockResolvedValue({ schemaVersion: 1, basics: { name: '张三' }, summary: { content: { type: 'doc', content: [] } } })
    }
  }
  ;(window as unknown as { electronAPI: unknown }).electronAPI = api
  return api
}

describe('JobsHome（F19 岗位目录）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('渲染岗位列表 + 绑定简历反查', async () => {
    const api = mockElectronApi()
    render(<JobsHome />)
    expect(await screen.findByText('前端工程师')).toBeTruthy()
    expect(api.jobs.list).toHaveBeenCalled()
    expect(screen.getByText('张三')).toBeTruthy()
  })

  it('新建岗位 → 填写名称 → 保存调 jobs.save', async () => {
    const api = mockElectronApi()
    render(<JobsHome />)
    fireEvent.click(screen.getByText('+ job.newJob'))
    const nameInput = screen.getByPlaceholderText('job.name') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: '后端工程师' } })
    fireEvent.click(screen.getByText('common.save'))
    expect(api.jobs.save).toHaveBeenCalledWith(expect.objectContaining({ name: '后端工程师' }))
  })

  it('删除岗位（confirm 确认）→ jobs.delete 被调', async () => {
    const api = mockElectronApi()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<JobsHome />)
    await screen.findByText('前端工程师')
    fireEvent.click(screen.getByText('job.deleteJob'))
    expect(api.jobs.delete).toHaveBeenCalledWith('j1')
  })
})
