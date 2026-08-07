/**
 * richtext-html —— RichText（Tiptap JSON / 降级 HTML）→ 安全 HTML 渲染器
 * 2026-08-08 P0-3 修复：原实现内联于 ClassicTemplate，文本与 href 不转义，
 * HTML 字符串直通 dangerouslySetInnerHTML（外部导入简历可注入脚本）。
 * 现抽为纯函数模块：白名单节点渲染 + 文本实体转义 + href 协议白名单。
 */

import type { RichText } from '@shared/schema/resume'

/** HTML 实体转义（文本节点与 href 属性值；防注入 <script>/事件属性） */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** href 白名单协议过滤：仅 http/https/mailto 放行，其余（javascript: 等）回落 '#' */
export function sanitizeHref(href: unknown): string {
  const raw = typeof href === 'string' ? href : ''
  const trimmed = raw.trim()
  if (trimmed.length === 0) return '#'
  try {
    const u = new URL(trimmed, 'https://x.local') // 相对链接补全再取协议
    if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return escapeHtml(trimmed)
  } catch {
    /* 非法 URL → 回落 */
  }
  return '#'
}

interface RichTextNode {
  type?: string
  text?: string
  content?: unknown[]
  marks?: unknown[]
  attrs?: Record<string, unknown>
}

interface RichTextMark {
  type: string
  attrs?: Record<string, unknown>
}

function marksToHtml(text: string, marks: unknown[]): string {
  let out = escapeHtml(text)
  for (const m of marks) {
    const mark = m as RichTextMark
    if (mark.type === 'bold') out = `<strong>${out}</strong>`
    if (mark.type === 'italic') out = `<em>${out}</em>`
    if (mark.type === 'strike') out = `<s>${out}</s>`
    if (mark.type === 'link') out = `<a href="${sanitizeHref(mark.attrs?.href)}">${out}</a>`
  }
  return out
}

function nodeToHtml(node: unknown): string {
  const n = node as RichTextNode
  switch (n.type) {
    case 'paragraph':
      return `<p>${nodesToHtml(n.content ?? [])}</p>`
    case 'bulletList':
      return `<ul>${nodesToHtml(n.content ?? [])}</ul>`
    case 'orderedList':
      return `<ol>${nodesToHtml(n.content ?? [])}</ol>`
    case 'listItem':
      return `<li>${nodesToHtml(n.content ?? [])}</li>`
    case 'text':
      return marksToHtml(n.text ?? '', n.marks ?? [])
    case 'hardBreak':
      return '<br/>'
    default:
      return '' // 白名单外的节点类型丢弃，不输出
  }
}

function nodesToHtml(nodes: unknown[]): string {
  return nodes.map(nodeToHtml).join('')
}

/** RichText → 安全 HTML：JSON 走白名单节点渲染；HTML 字符串转义后按纯文本展示（不解析其标签） */
export function richTextToHtml(rt: RichText | undefined): string {
  if (!rt) return ''
  if (typeof rt === 'string') return escapeHtml(rt)
  return nodesToHtml(rt.content ?? [])
}
