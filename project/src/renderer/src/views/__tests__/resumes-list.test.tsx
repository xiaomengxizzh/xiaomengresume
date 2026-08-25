/**
 * resumes-list.test.tsx —— P0 修复批 F4：恢复当前编辑中简历的备份后内存 store 须重置
 * 场景：恢复的简历 id === store.resumeId → loadResume 重置内存 + 撤销栈；
 * 否则回编辑器时 useAutoSave 挂载 effect 把内存旧 resume 落盘覆盖恢复结果。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { createEmptyResume, type Resume } from '@shared/schema/resume'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))

import { ResumesList } from '../ResumesList'
import { useResumeStore } from '../../store/useResumeStore'

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'
const BAK = { file: `${ID}.json.bak.1755900000000`, updatedAt: '2026-08-01T00:00:00.000Z', sizeBytes: 2048 }

function recoveredResume(name: string): Resume {
  const r = createEmptyResume()
  r.basics.name = name
  return r
}

const recoverBackupMock = vi.fn()

beforeEach(() => {
  recoverBackupMock.mockReset()
  ;(window as unknown as { confirm: unknown }).confirm = vi.fn(() => true)
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    resumes: {
      list: vi.fn().mockResolvedValue([{ id: ID, name: '当前简历', updatedAt: '2026-08-20T00:00:00.000Z' }]),
      listBackups: vi.fn().mockResolvedValue([BAK]),
      recoverBackup: recoverBackupMock
    }
  }
})

async function openHistoryAndRecover(): Promise<void> {
  render(<ResumesList />)
  // 打开版本时间线（🕘 按钮 title = resumeList.history；列表异步加载完成才出现）
  fireEvent.click(await screen.findByTitle('resumeList.history'))
  // 备份列表异步加载后点击恢复
  const btn = await screen.findByText('resumeList.recover')
  fireEvent.click(btn)
  await act(async () => {})
}

describe('ResumesList 版本恢复（P0 F4）', () => {
  it('恢复的正是当前编辑中的简历 → loadResume 重置内存 + 清撤销栈', async () => {
    recoverBackupMock.mockResolvedValue(recoveredResume('恢复后的名字'))
    useResumeStore.setState({ resumeId: ID, resume: recoveredResume('编辑中的旧名字') })
    await openHistoryAndRecover()

    expect(recoverBackupMock).toHaveBeenCalledWith(ID, BAK.file)
    const s = useResumeStore.getState()
    expect(s.resumeId).toBe(ID)
    expect(s.resume.basics.name).toBe('恢复后的名字')
    expect(s.canUndo()).toBe(false)
  })

  it('恢复的不是当前简历 → 内存 store 不动', async () => {
    recoverBackupMock.mockResolvedValue(recoveredResume('别人家的恢复'))
    useResumeStore.setState({ resumeId: 'other-id', resume: recoveredResume('当前编辑中') })
    await openHistoryAndRecover()

    expect(useResumeStore.getState().resume.basics.name).toBe('当前编辑中')
  })
})
