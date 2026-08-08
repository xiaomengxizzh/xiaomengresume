/**
 * pdf/build.ts —— 文字版 PDF 生成编排（2026-08-08 纯代码生成重构）
 *
 * buildTextPdf(resume, opts)：
 *   1. 注册系统字体（fonts.ts，幂等）
 *   2. <ResumePdfDocument> 经 @react-pdf/renderer renderToBuffer → 矢量 PDF Buffer
 *   3. pages==='first' → pdf-lib 裁第一页（D13 替代方案；裁剪失败回退全量）
 * 零 GPU/零隐藏窗口/零 loadURL —— 任何环境可跑（用户拍板的产品底线）。
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { PDFDocument } from 'pdf-lib'
import type { Resume } from '@shared/schema/resume'
import type { Language } from '@shared/schema/settings'
import { registerPdfFonts } from './fonts'
import { ResumePdfDocument } from './template'

export interface BuildTextPdfOptions {
  language: Language
  privacyMode: boolean
  /** 'all' 全部（默认）；'first' 仅第一页（pdf-lib 裁剪） */
  pages?: 'all' | 'first'
}

export interface BuildTextPdfResult {
  buffer: Buffer
  /** 字体注册警告（缺失/回退；不阻塞导出） */
  warnings: string[]
  /** 实际页数（pdf-lib 解析；first 裁剪后为 1） */
  pageCount: number
}

/**
 * 裁剪 PDF 至第一页（pdf-lib；v2.1 修：保留原 Info dict，否则 Title/Producer/Creator 丢失 → 用户看到 "creator: pdf-lib"）
 * @param srcBuffer 原 PDF buffer（含完整 Info）
 */
async function cropFirstPage(srcBuffer: Buffer): Promise<Buffer | null> {
  try {
    const src = await PDFDocument.load(srcBuffer)
    const dst = await PDFDocument.create()
    // 保留原 Info（Title/Producer/Creator/CreationDate/ModDate）—— pdf-lib.create() 默认空 Info
    // 注：pdf-lib d.ts 把 getInfoDict/updateInfoDict 标 private 但运行时公共；用类型允许的 setter 逐项复制
    const safe = (v: string | undefined): string => v ?? ''
    dst.setTitle(safe(src.getTitle()))
    dst.setProducer(safe(src.getProducer()))
    dst.setCreator(safe(src.getCreator()))
    dst.setAuthor(safe(src.getAuthor()))
    dst.setSubject(safe(src.getSubject()))
    const srcKeywords = src.getKeywords()
    if (srcKeywords) dst.setKeywords(Array.isArray(srcKeywords) ? srcKeywords : [srcKeywords])
    const srcCreated = src.getCreationDate()
    if (srcCreated) dst.setCreationDate(srcCreated)
    const srcModified = src.getModificationDate()
    if (srcModified) dst.setModificationDate(srcModified)
    const [page] = await dst.copyPages(src, [0])
    dst.addPage(page)
    const out = await dst.save()
    return Buffer.from(out)
  } catch {
    return null
  }
}

/**
 * 生成文字版 PDF（矢量、文字可选）。
 * @throws 字体注册失败等致命错误（由 run.ts catch 统一转为 ExportRunResult.error）
 */
export async function buildTextPdf(resume: Resume, opts: BuildTextPdfOptions): Promise<BuildTextPdfResult> {
  const { warnings } = await registerPdfFonts(resume.layout)

  const element = createElement(ResumePdfDocument, {
    resume,
    language: opts.language,
    privacyMode: opts.privacyMode
  })
  const buffer = await renderToBuffer(element)

  let final = buffer
  let pageCount = 1
  if (opts.pages === 'first') {
    const cropped = await cropFirstPage(buffer)
    if (cropped) final = cropped
    else warnings.push('crop first page failed, fallback to full pdf')
  } else {
    try {
      const doc = await PDFDocument.load(buffer)
      pageCount = doc.getPageCount()
    } catch {
      /* 页数解析失败不影响产出 */
    }
  }

  return { buffer: final, warnings, pageCount }
}
