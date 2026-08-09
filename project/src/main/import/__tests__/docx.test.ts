/**
 * docx.test.ts —— M4a Word 抽取单测（mock mammoth 动态 import；不依赖 electron）
 * 覆盖：convertToHtml → 纯文本（块级换行/li 符号/实体解码）/ 读取失败 / mammoth 失败 → PARSE_FAILED。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'

const convertToHtml = vi.fn()
vi.mock('mammoth', () => ({
  default: { convertToHtml: (...a: unknown[]) => convertToHtml(...a) }
}))

import { extractDocxText, htmlToPlainText } from '../docx'

const TMP = path.resolve(os.tmpdir(), 'xm-import-docx')

async function writeDocx(): Promise<string> {
  await fs.promises.mkdir(TMP, { recursive: true })
  const target = path.resolve(TMP, 'sample.docx')
  await fs.promises.writeFile(target, Buffer.from([1, 2, 3]))
  return target
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('htmlToPlainText（HTML → 纯文本）', () => {
  it('块级标签转行 + li 前缀符号', () => {
    const html = '<p>第一段</p><p>第二段</p><ul><li>要点A</li><li>要点B</li></ul>'
    expect(htmlToPlainText(html)).toBe('第一段\n第二段\n• 要点A\n• 要点B')
  })

  it('实体解码 + 空行合并', () => {
    expect(htmlToPlainText('<p>a &amp; b</p>\n\n\n<p>c</p>')).toBe('a & b\nc')
  })

  it('br 转行', () => {
    expect(htmlToPlainText('行一<br>行二')).toBe('行一\n行二')
  })
})

describe('extractDocxText', () => {
  it('正常抽取（mammoth messages 空 → 无警告）', async () => {
    convertToHtml.mockResolvedValue({ value: '<p>张三</p><p>五年经验</p>', messages: [] })
    const p = await writeDocx()
    const r = await extractDocxText(p)
    expect(r.text).toBe('张三\n五年经验')
    expect(r.warnings).toEqual([])
  })

  it('mammoth 返回 messages → 警告', async () => {
    convertToHtml.mockResolvedValue({ value: '<p>x</p>', messages: ['warn'] })
    const p = await writeDocx()
    const r = await extractDocxText(p)
    expect(r.warnings.length).toBe(1)
  })

  it('读取失败 → PARSE_FAILED', async () => {
    await expect(extractDocxText(path.join(TMP, 'missing.docx'))).rejects.toMatchObject({
      code: 'PARSE_FAILED'
    })
  })

  it('mammoth 失败 → PARSE_FAILED', async () => {
    convertToHtml.mockRejectedValue(new Error('bad docx'))
    const p = await writeDocx()
    await expect(extractDocxText(p)).rejects.toMatchObject({ code: 'PARSE_FAILED' })
  })
})
