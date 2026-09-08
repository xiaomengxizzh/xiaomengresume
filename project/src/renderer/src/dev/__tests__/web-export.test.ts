/**
 * web-export 测试 —— 打印窗口 URL 组装（web 端 PDF 导出的关键参数契约）。
 */
import { describe, expect, it } from 'vitest'
import { buildPrintWindowUrl } from '../web-export'

const BASE = 'http://10.17.217.221:4173/web.html'

describe('buildPrintWindowUrl', () => {
  it('基础参数：export/resumeId/language/autoprint 必带', () => {
    const url = new URL(buildPrintWindowUrl({ resumeId: 'abc', language: 'zh-CN' }, BASE))
    expect(url.pathname.endsWith('/web.html')).toBe(true)
    expect(url.searchParams.get('export')).toBe('1')
    expect(url.searchParams.get('resumeId')).toBe('abc')
    expect(url.searchParams.get('language')).toBe('zh-CN')
    expect(url.searchParams.get('autoprint')).toBe('1')
  })

  it('隐私打码与仅第一页按需携带', () => {
    const on = new URL(buildPrintWindowUrl({ resumeId: 'a', language: 'en', privacyMode: true, pages: 'first' }, BASE))
    expect(on.searchParams.get('privacyMode')).toBe('1')
    expect(on.searchParams.get('pages')).toBe('first')
    const off = new URL(buildPrintWindowUrl({ resumeId: 'a', language: 'en' }, BASE))
    expect(off.searchParams.get('privacyMode')).toBeNull()
    expect(off.searchParams.get('pages')).toBeNull()
  })

  it('base 相对解析：从根路径打开同样落到 web.html', () => {
    const url = new URL(buildPrintWindowUrl({ resumeId: 'a', language: 'zh-CN' }, 'http://10.17.217.221:4173/'))
    expect(url.pathname.endsWith('/web.html')).toBe(true)
  })
})
