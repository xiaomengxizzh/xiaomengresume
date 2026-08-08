// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import '../../../i18n'
import { ResumeBody } from '../ResumeBody'
import { useResumeStore } from '../../../store/useResumeStore'
import { createEmptyResume } from '@shared/schema/resume'

Element.prototype.scrollIntoView = (() => {}) as never
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }))

function setPhoto(photo: string): void {
  const r = createEmptyResume()
  r.basics.name = '测试'
  r.basics.photo = photo
  if (photo) { r.basics.photoWidth = 90; r.basics.photoHeight = 120 }
  useResumeStore.setState({ resume: r, resumeId: 'x' })
}

describe('预览头像渲染（photo 值矩阵）', () => {
  it("photo=''（新建空白默认）→ 无 img", () => {
    setPhoto('')
    const { container } = render(<ResumeBody variant="classic" />)
    expect(container.querySelector('img')).toBeNull()
  })
  it("photo='avatar'（内置标记）→ img 存在且 src 非空", () => {
    setPhoto('avatar')
    const { container } = render(<ResumeBody variant="classic" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src') || '').not.toBe('')
  })
  it('photo=data URL → img src 为 data URL', () => {
    setPhoto('data:image/png;base64,iVBORw0KGgo=')
    const { container } = render(<ResumeBody variant="classic" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img!.getAttribute('src')).toMatch(/^data:image\/png;base64,/)
  })
})
