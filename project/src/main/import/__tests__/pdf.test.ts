/**
 * pdf.test.ts —— M4a PDF 抽取单测（mock unpdf；不依赖 electron）
 * 覆盖：正常抽取 / 清洗（空行+乱码剔除）/ 阈值分流（<100 → needsVision）/ 解析失败 → PARSE_FAILED。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'

const getDocumentProxy = vi.fn()
const extractText = vi.fn()
vi.mock('unpdf', () => ({
  getDocumentProxy: (...a: unknown[]) => getDocumentProxy(...a),
  extractText: (...a: unknown[]) => extractText(...a)
}))

import { cleanPdfText, extractPdfText, PDF_TEXT_MIN_CHARS, visionPlaceholderDraft } from '../pdf'

const TMP = path.resolve(os.tmpdir(), 'xm-import-pdf')

async function writePdf(bytes: number[]): Promise<string> {
  await fs.promises.mkdir(TMP, { recursive: true })
  const target = path.resolve(TMP, 'sample.pdf')
  await fs.promises.writeFile(target, Buffer.from(bytes))
  return target
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('cleanPdfText（清洗）', () => {
  it('空行合并 + 正常文本保留', () => {
    const r = cleanPdfText('   \n姓名：张三\n\n\n电话：138\n')
    expect(r.text).toBe('姓名：张三\n电话：138')
    expect(r.removedLines).toBe(0)
  })

  it('乱码行（� 占比 >30%）剔除并计数', () => {
    const r = cleanPdfText('好行\n����糟糕乱码行����\n正常')
    expect(r.text).toBe('好行\n正常')
    expect(r.removedLines).toBe(1)
  })

  it('边界：乱码占比恰 30% 保留', () => {
    const r = cleanPdfText('abc�')
    expect(r.text).toBe('abc�')
    expect(r.removedLines).toBe(0)
  })
})

describe('extractPdfText（分流）', () => {
  it('文本充足（≥100 有效字符）→ needsVision=false', async () => {
    const text = ('我是简历文本。'.repeat(30))
    getDocumentProxy.mockResolvedValue({})
    extractText.mockResolvedValue({ totalPages: 1, text })
    const p = await writePdf([1, 2, 3])
    const r = await extractPdfText(p)
    expect(r.needsVision).toBe(false)
    expect(r.effectiveChars).toBeGreaterThanOrEqual(PDF_TEXT_MIN_CHARS)
    expect(r.warnings).toEqual([])
  })

  it('文本不足（<100）→ needsVision=true（扫描件占位）', async () => {
    getDocumentProxy.mockResolvedValue({})
    extractText.mockResolvedValue({ totalPages: 1, text: '只有一点文字' })
    const p = await writePdf([4, 5, 6])
    const r = await extractPdfText(p)
    expect(r.needsVision).toBe(true)
    expect(r.warnings).toContain('import.warning.scanned')
  })

  it('乱码剔除后仍不足 → needsVision + 乱码警告', async () => {
    getDocumentProxy.mockResolvedValue({})
    extractText.mockResolvedValue({ totalPages: 1, text: '������' })
    const p = await writePdf([7, 8, 9])
    const r = await extractPdfText(p)
    expect(r.needsVision).toBe(true)
    expect(r.warnings).toContain('import.warning.garbled')
  })

  it('读取失败 → PARSE_FAILED', async () => {
    await expect(extractPdfText(path.join(TMP, 'missing.pdf'))).rejects.toMatchObject({
      code: 'PARSE_FAILED'
    })
  })

  it('unpdf 解析失败（加密/损坏）→ PARSE_FAILED', async () => {
    getDocumentProxy.mockRejectedValue(new Error('password required'))
    const p = await writePdf([1, 2, 3])
    await expect(extractPdfText(p)).rejects.toMatchObject({ code: 'PARSE_FAILED' })
  })
})

describe('visionPlaceholderDraft（M4b 占位）', () => {
  it('返回 needsVision 空简历草稿（非错误）', () => {
    const d = visionPlaceholderDraft('pdf', 'scan.pdf', '预览', ['w'])
    expect(d.needsVision).toBe(true)
    expect(d.resume.basics.name).toBe('')
    expect(d.warnings).toContain('w')
  })
})
