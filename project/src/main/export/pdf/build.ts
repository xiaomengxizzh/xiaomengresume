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
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { Resume } from '@shared/schema/resume'
import type { Language } from '@shared/schema/settings'
import { registerPdfFonts } from './fonts'
import { ResumePdfDocument } from './template'

/**
 * 头像来源解析（供 PDF <Image> 使用）：
 *  - 'avatar' / '/avatar.png' 标记 → 读内置 avatar.png 转 data URL
 *  - data URL / https 外链 → 直通
 * P1 修复（2026-08-08）：@react-pdf/image 的 fetchLocalFile 用 url.parse 解析 src，
 * Windows 绝对路径 `C:\...` 的 protocol='c:' 被判定为"非 file: 远程路径"→ 走 fetchRemoteFile
 * → fetch('C:\...') 必然失败（实测 'fetch failed'）→ PDF 头像缺失。转 data URL 彻底规避。
 */
export async function resolvePdfPhotoSrc(photo: string | undefined): Promise<string | null> {
  if (typeof photo !== 'string' || photo.trim().length === 0) return null
  const v = photo.trim()
  if (v === 'avatar' || v === '/avatar.png' || v === 'avatar.png') {
    // dev 资源路径（electron-vite dev：cwd=project/）；生产打包无此资源则跳过，不阻塞导出
    const candidates = [
      path.join(process.cwd(), 'src', 'renderer', 'src', 'assets', 'avatar.png'),
      path.join(process.cwd(), 'resources', 'avatar.png')
    ]
    const file = candidates.find((p) => existsSync(p))
    if (!file) return null
    try {
      const data = await fs.readFile(file)
      return `data:image/png;base64,${data.toString('base64')}`
    } catch {
      return null
    }
  }
  return v // data URL / https 外链直通
}

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

  const photoSrc = await resolvePdfPhotoSrc(resume.basics.photo)
  const element = createElement(ResumePdfDocument, {
    resume,
    language: opts.language,
    privacyMode: opts.privacyMode,
    photoSrc
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
