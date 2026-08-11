// @vitest-environment jsdom
// 岗位目录卡布局（2026-08-11）：对齐简历卡「主信息左 + 元信息右」两端分布（resume-list-item）
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import '../../i18n'
import { JobsManager } from '../JobsManager'
import type { JobSummary } from '@shared/ipc-channels'

afterEach(() => cleanup())

const job: JobSummary = { id: 'j1', name: '前端工程师', appliedAt: '2026-07', status: 'applying' }

function mockElectronApi(): void {
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    jobs: {
      list: vi.fn().mockResolvedValue([job]),
      save: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({ ...job, requirements: '', createdAt: '', updatedAt: '' }),
      delete: vi.fn().mockResolvedValue(undefined)
    },
    resumes: {
      list: vi.fn().mockResolvedValue([]),
      open: vi.fn(),
      save: vi.fn()
    }
  }
}

describe('岗位目录卡布局（对齐简历卡两端分布）', () => {
  it('岗位卡：左主信息（名称）+ 右元信息（时间/状态徽章）+ 操作按钮', async () => {
    mockElectronApi()
    const { container } = render(<JobsManager />)
    await waitFor(() => expect(container.querySelector('.resume-list-item')).not.toBeNull())

    const card = container.querySelector('.resume-list-item') as HTMLElement
    // 左主信息：名称
    const name = card.querySelector('.resume-list-name')
    expect(name?.textContent).toBe('前端工程师')
    // 右元信息：投递时间 + 状态徽章
    const text = card.textContent ?? ''
    expect(text).toContain('2026-07')
    expect(text).toContain('在投')
    // 布局顺序：名称块 → 时间/状态 meta → 操作按钮（两端分布：主信息左、元信息右）
    const children = [...card.children].filter((c) => c.tagName !== 'INPUT')
    expect(children[0]?.querySelector('.resume-list-name')).toBeTruthy()
    expect(children[children.length - 1]?.querySelector('button')).toBeTruthy()
  })
})
