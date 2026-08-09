/**
 * import-wizard.test.tsx —— M4a 三步核对向导（jsdom）
 * 覆盖：①预览 → ②字段核对（值可编辑）→ ③确认写入（新建 applyImport）；覆盖二次确认；
 * ImportHome 点击卡片调 import.run；needsVision 草稿 → VISION_REQUIRED 提示。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { createEmptyResume, type Resume } from '@shared/schema/resume'

afterEach(cleanup)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string): string => k }),
  initReactI18next: { type: '3rdParty' as const, init: (): void => {} }
}))

import { ImportWizard } from '../../components/import/ImportWizard'
import { ImportHome } from '../ImportHome'
import { useResumeStore } from '../../store/useResumeStore'

function draftResume(): Resume {
  const r = createEmptyResume()
  r.basics.name = 'AI 映射的张三'
  r.work = [{ id: crypto.randomUUID(), company: '某科技', title: '工程师', startDate: '2020-09', endDate: '2023', highlights: [] }]
  r.skills = [{ id: crypto.randomUUID(), name: 'TypeScript', level: '熟练' }]
  return r
}

function makeDraft(over: { needsVision?: true; warnings?: string[]; sourcePreview?: string } = {}) {
  return {
    format: 'pdf' as const,
    fileName: 'resume.pdf',
    sourcePreview: 'AI 映射的张三\n某科技 工程师\nTypeScript',
    resume: draftResume(),
    warnings: [],
    ...over
  }
}

beforeEach(() => {
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

describe('ImportWizard（三步核对）', () => {
  it('① 解析预览：显示源信息 + 文本预览', () => {
    render(<ImportWizard draft={makeDraft()} onCancel={vi.fn()} />)
    expect(screen.getByText(/resume\.pdf/)).toBeTruthy()
    expect(screen.getByText(/AI 映射的张三/)).toBeTruthy()
    expect(screen.getByText('import.next')).toBeTruthy()
  })

  it('① → ②：字段核对显示 AI 映射值', async () => {
    render(<ImportWizard draft={makeDraft()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('import.next'))
    const nameInput = screen.getAllByDisplayValue('AI 映射的张三')[0] as HTMLInputElement
    expect(nameInput).toBeTruthy()
  })

  it('② 编辑字段 → ③ 确认写入（新建）→ applyImport 落 store + 切编辑器', () => {
    render(<ImportWizard draft={makeDraft()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('import.next'))
    const nameInput = screen.getAllByDisplayValue('AI 映射的张三')[0] as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: '我改的名字' } })
    fireEvent.click(screen.getByText('import.next'))
    fireEvent.click(screen.getByText('import.confirmWrite'))
    const s = useResumeStore.getState()
    expect(s.resume.basics.name).toBe('我改的名字')
    expect(s.currentView).toBe('editor')
  })

  it('③ 覆盖模式：先点确认 → 二次确认提示 → 再点确认才写入', () => {
    useResumeStore.setState({ resumeId: 'existing-id', resume: createEmptyResume() })
    render(<ImportWizard draft={makeDraft()} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('import.next'))
    fireEvent.click(screen.getByText('import.next'))
    fireEvent.click(screen.getByText('import.overwriteCurrent'))
    fireEvent.click(screen.getByText('import.confirmWrite'))
    // 首次点击 → 未写入，显示二次确认警告
    expect(useResumeStore.getState().resume.basics.name).toBe('')
    expect(screen.getByText('import.overwriteWarning')).toBeTruthy()
    fireEvent.click(screen.getByText('import.overwriteConfirm'))
    expect(useResumeStore.getState().resume.basics.name).toBe('AI 映射的张三')
  })
})

describe('ImportHome（入口）', () => {
  it('点击 PDF 卡片 → 调 import.run({format:pdf}) → 进向导', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, data: makeDraft() })
    ;(window as unknown as { electronAPI: { import: { run: unknown } } }).electronAPI = {
      import: { run }
    }
    render(<ImportHome />)
    fireEvent.click(screen.getByText('import.cardPdf'))
    expect(run).toHaveBeenCalledWith({ format: 'pdf' })
    expect(await screen.findByText(/resume\.pdf/)).toBeTruthy()
  })

  it('needsVision 草稿 → VISION_REQUIRED 提示（不崩溃）', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true, data: makeDraft({ needsVision: true }) })
    ;(window as unknown as { electronAPI: { import: { run: unknown } } }).electronAPI = {
      import: { run }
    }
    render(<ImportHome />)
    fireEvent.click(screen.getByText('import.cardImage'))
    expect(await screen.findByText('import.visionRequired')).toBeTruthy()
  })

  it('错误码 → 提示 import.error.XXX', async () => {
    const run = vi.fn().mockResolvedValue({ ok: false, error: { code: 'NO_PROVIDER' } })
    ;(window as unknown as { electronAPI: { import: { run: unknown } } }).electronAPI = {
      import: { run }
    }
    render(<ImportHome />)
    fireEvent.click(screen.getByText('import.cardPdf'))
    expect(await screen.findByText('import.error.NO_PROVIDER')).toBeTruthy()
  })
})
