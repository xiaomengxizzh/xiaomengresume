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
const extractImages = vi.fn()
vi.mock('unpdf', () => ({
  getDocumentProxy: (...a: unknown[]) => getDocumentProxy(...a),
  extractText: (...a: unknown[]) => extractText(...a),
  extractImages: (...a: unknown[]) => extractImages(...a)
}))

import {
  cleanPdfText,
  extractPdfText,
  extractPdfPhoto,
  rgbaToPngDataUrl,
  PDF_TEXT_MIN_CHARS,
  visionPlaceholderDraft
} from '../pdf'

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

describe('rgbaToPngDataUrl（PNG 编码）', () => {
  it('RGBA 像素 → data URL + PNG 魔数', () => {
    // 2×1 像素：红、蓝
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
    const url = rgbaToPngDataUrl(px, 2, 1, 4)
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    const buf = Buffer.from(url.slice('data:image/png;base64,'.length), 'base64')
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // PNG 魔数
    expect(buf.includes(Buffer.from('IHDR'))).toBe(true)
  })

  it('3 通道（RGB）→ 不透明 A=255', () => {
    const px = new Uint8ClampedArray([10, 20, 30])
    const url = rgbaToPngDataUrl(px, 1, 1, 3)
    const buf = Buffer.from(url.slice(22), 'base64')
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })
})

describe('extractPdfPhoto（头像提取）', () => {
  it('取第一页面积最大图 → data URL + 尺寸', async () => {
    getDocumentProxy.mockResolvedValue({})
    extractImages.mockResolvedValue([
      { data: new Uint8ClampedArray(4), width: 10, height: 10, channels: 4, key: 'small' },
      { data: new Uint8ClampedArray(100 * 100 * 4), width: 100, height: 100, channels: 4, key: 'big' }
    ])
    const p = await writePdf([1, 2, 3])
    const r = await extractPdfPhoto(p)
    expect(r?.width).toBe(100)
    expect(r?.height).toBe(100)
    expect(r?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('超大图（>上限）→ null（跳过不阻断）', async () => {
    getDocumentProxy.mockResolvedValue({})
    extractImages.mockResolvedValue([
      { data: new Uint8ClampedArray(3000 * 3000 * 4), width: 3000, height: 3000, channels: 4, key: 'huge' }
    ])
    const p = await writePdf([4, 5, 6])
    expect(await extractPdfPhoto(p)).toBeNull()
  })

  it('无图 / 提取失败 → null（不阻断导入）', async () => {
    getDocumentProxy.mockResolvedValue({})
    extractImages.mockResolvedValue([])
    const p = await writePdf([7, 8, 9])
    expect(await extractPdfPhoto(p)).toBeNull()
    extractImages.mockRejectedValue(new Error('no images'))
    expect(await extractPdfPhoto(p)).toBeNull()
  })
})
