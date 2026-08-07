/**
 * richtext-html.test.ts —— P0-3 sanitize 单测（2026-08-08）
 * 覆盖：文本转义 / href 协议白名单 / HTML 字符串降级转义 / JSON 白名单节点渲染。
 */
import { describe, it, expect } from 'vitest'
import { escapeHtml, sanitizeHref, richTextToHtml } from '../richtext-html'
import type { RichText } from '@shared/schema/resume'

/** 测试夹具：字面量对象断言为 RichText（type: "doc" 字面量收紧） */
function asDoc(doc: unknown): RichText {
  return doc as unknown as RichText
}

describe('escapeHtml', () => {
  it('转义 & < > " \'', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)"> & '`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;'
    )
  })
})

describe('sanitizeHref', () => {
  it('放行 http/https/mailto', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com')
    expect(sanitizeHref('http://a.b/c')).toBe('http://a.b/c')
    expect(sanitizeHref('mailto:a@b.com')).toBe('mailto:a@b.com')
  })
  it('拒绝 javascript: 协议（大小写/空白变体）', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('#')
    expect(sanitizeHref('JaVaScRiPt:alert(1)')).toBe('#')
    expect(sanitizeHref('  javascript:alert(1)  ')).toBe('#')
  })
  it('拒绝 data: 协议与空值', () => {
    expect(sanitizeHref('data:text/html,<script>1</script>')).toBe('#')
    expect(sanitizeHref(undefined)).toBe('#')
    expect(sanitizeHref(123)).toBe('#')
  })
  it('非字符串/非法 URL 回落 #', () => {
    expect(sanitizeHref(null)).toBe('#')
    expect(sanitizeHref('http://')).toBe('#')
  })
})

describe('richTextToHtml', () => {
  it('undefined / 空对象 → 空串', () => {
    expect(richTextToHtml(undefined)).toBe('')
  })
  it('JSON 路径：白名单节点渲染，文本转义', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }
      ]
    }
    expect(richTextToHtml(asDoc(doc))).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })
  it('JSON 路径：bold/italic/strike/link marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' ' },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://ok.com' } }] }
          ]
        }
      ]
    }
    expect(richTextToHtml(asDoc(doc))).toBe('<p><strong>bold</strong> <a href="https://ok.com">link</a></p>')
  })
  it('JSON 路径：link href 注入被回落 #', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }]
        }
      ]
    }
    expect(richTextToHtml(asDoc(doc))).toBe('<p><a href="#">x</a></p>')
  })
  it('HTML 字符串降级路径：整体转义按纯文本输出，不解析标签', () => {
    expect(richTextToHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    )
  })
  it('白名单外节点类型丢弃', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { src: 'x.png' } },
        { type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }
      ]
    }
    expect(richTextToHtml(asDoc(doc))).toBe('<p>ok</p>')
  })
})
