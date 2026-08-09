/**
 * applyImport.test.ts —— M4a 导入写入语义（#5 拍板：一次撤销可回滚导入）
 * 覆盖：新建（resumeId=null → 新 uuid + 切 editor）/ 覆盖（保留 id 整体替换）/ undo 一次回滚导入前。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createEmptyResume, type Resume } from '@shared/schema/resume'
import { useResumeStore } from '../useResumeStore'

function sampleResume(name: string): Resume {
  const r = createEmptyResume()
  r.basics.name = name
  r.work = [{ id: crypto.randomUUID(), company: `${name} 公司`, title: '工程师', startDate: '2020', endDate: '2023', highlights: [] }]
  return r
}

beforeEach(() => {
  // 重置 store 到初始态
  useResumeStore.setState({
    resumeId: null,
    resume: createEmptyResume(),
    currentView: 'resumes-home',
    activeSection: 'basics',
    activeFieldPath: null,
    lastEditedPath: null,
    historyTick: 0
  })
})

describe('applyImport（导入写入语义）', () => {
  it('新建模式（resumeId=null）：新 uuid + 替换简历 + 切编辑器', () => {
    const st = useResumeStore.getState()
    st.applyImport(sampleResume('导入的张三'))
    const s = useResumeStore.getState()
    expect(s.resumeId).toBeTruthy()
    expect(s.resume.basics.name).toBe('导入的张三')
    expect(s.currentView).toBe('editor')
  })

  it('覆盖模式（resumeId 有值）：保留 id + 整体替换', () => {
    const st = useResumeStore.getState()
    st.loadResume('existing-id', sampleResume('原简历'))
    st.applyImport(sampleResume('导入覆盖'))
    const s = useResumeStore.getState()
    expect(s.resumeId).toBe('existing-id')
    expect(s.resume.basics.name).toBe('导入覆盖')
  })

  it('导入后 undo 一次 → 回滚到导入前（覆盖模式）', () => {
    const st = useResumeStore.getState()
    st.loadResume('existing-id', sampleResume('原简历'))
    st.applyImport(sampleResume('导入覆盖'))
    useResumeStore.getState().undo()
    const s = useResumeStore.getState()
    expect(s.resume.basics.name).toBe('原简历')
    expect(s.resumeId).toBe('existing-id')
  })

  it('导入后 undo 一次 → 回空简历（新建模式）', () => {
    useResumeStore.getState().applyImport(sampleResume('导入的张三'))
    useResumeStore.getState().undo()
    expect(useResumeStore.getState().resume.basics.name).toBe('')
  })

  it('redo 恢复导入内容', () => {
    useResumeStore.getState().applyImport(sampleResume('导入的张三'))
    useResumeStore.getState().undo()
    useResumeStore.getState().redo()
    expect(useResumeStore.getState().resume.basics.name).toBe('导入的张三')
  })
})
