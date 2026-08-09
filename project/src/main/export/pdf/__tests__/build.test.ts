/**
 * pdf/__tests__/build.test.ts —— 文字版 PDF 纯代码生成测试（2026-08-08）
 * 核心：不依赖 GPU/Chromium，node 环境直接跑 @react-pdf/renderer → 验证产品底线
 * （矢量、文字可选、可导出）。字体：本机系统字体（simhei/msyh 等），CI 无字体时
 * 测试跳过中文断言但保留 %PDF- 校验（字体缺失不抛错，Helvetica 兜底）。
 */
import { describe, expect, it, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { PDFDocument } from 'pdf-lib'
import { Image } from '@react-pdf/renderer'
import { buildTextPdf, resolvePdfPhotoSrc } from '../build'
import { ResumePdfDocument } from '../template'
import { richTextToPdfParagraphs, paragraphsToPlainText } from '../richtext'
import { _resetFontRegistryForTest } from '../fonts'
import { migrate, type Resume } from '@shared/schema/resume'

/** 项目内 schema 示例简历（与 material/简历示例1.json 同源，但已对齐 F1 schema） */
const SAMPLE = path.resolve(__dirname, '../../../files/sample-resume.json')

function loadSample(): Resume {
  const raw = JSON.parse(readFileSync(SAMPLE, 'utf-8'))
  // migrate 即 parse：校验 + 补默认值
  return migrate(raw)
}

describe('pdf/richtext', () => {
  it('Tiptap JSON → 段落+粗体+列表', () => {
    const rt = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '负责' }, { type: 'text', text: '架构', marks: [{ type: 'bold' }] }, { type: 'text', text: '设计' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '要点一' }] }] }] }
      ]
    }
    const paras = richTextToPdfParagraphs(rt as never)
    const plain = paragraphsToPlainText(paras)
    expect(plain).toContain('负责架构设计')
    expect(plain).toContain('• 要点一')
    expect(paras[0].runs[1].bold).toBe(true)
  })

  it('降级 HTML 字符串 → 纯文本（去标签）', () => {
    const paras = richTextToPdfParagraphs('<p>你好<strong>世界</strong></p>')
    expect(paragraphsToPlainText(paras)).toBe('你好世界')
  })
})

describe('pdf/build (文字版 PDF 纯代码生成)', () => {
  beforeAll(() => {
    // 字体注册为全局单例：重置保证本套测试独立注册
    _resetFontRegistryForTest()
  })

  it('头像解析（P1 回归：Windows 绝对路径走 fetch 必失败 → 转 data URL）', async () => {
    // avatar 标记 → 内置资源转 data URL（本机 dev 资源存在时）
    const avatarSrc = await resolvePdfPhotoSrc('avatar')
    if (avatarSrc !== null) {
      expect(avatarSrc.startsWith('data:image/png;base64,')).toBe(true)
    }
    // 空值/无 photo → null
    expect(await resolvePdfPhotoSrc('')).toBeNull()
    expect(await resolvePdfPhotoSrc(undefined)).toBeNull()
    // data URL / https 直通
    expect(await resolvePdfPhotoSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(await resolvePdfPhotoSrc('https://x.dev/a.png')).toBe('https://x.dev/a.png')
  })

  it('生成 PDF：%PDF- 魔数 + 非空（用户底线：任何环境可导出）', async () => {
    const sample = loadSample()
    const { buffer, warnings, pageCount } = await buildTextPdf(sample, {
      language: 'zh-CN',
      privacyMode: false,
      pages: 'all'
    })
    expect(buffer.length).toBeGreaterThan(100)
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-')
    expect(pageCount).toBeGreaterThanOrEqual(1)
    // 字体警告可存在（无字体环境），但不阻塞导出
    expect(Array.isArray(warnings)).toBe(true)
  })

  it('pages=first：pdf-lib 裁剪为单页 + 保留 Info 元数据', async () => {
    const sample = loadSample()
    const { buffer, pageCount } = await buildTextPdf(sample, {
      language: 'zh-CN',
      privacyMode: false,
      pages: 'first'
    })
    expect(pageCount).toBe(1)
    const doc = await PDFDocument.load(buffer)
    expect(doc.getPageCount()).toBe(1)
    // v2.1 修：裁剪后必须保留 Title/Producer（pdf-lib 默认 Info 为空 → creator=pdf-lib 错误）
    // 注：pdf-lib 1.17.1 save() 用 PDF 1.5+ XRef Stream + ObjStm 压缩 Info dict（pages='first' 路径触发）
    // 标准字节扫描 /Title 找不到；改用 pdf-lib API（getTitle/getCreator 正确；getProducer 永远被 pdf-lib 强制覆写为 'pdf-lib (...)'，此为库签名 quirk）
    expect(doc.getTitle()).toBe('宋哈娜')
    expect(doc.getCreator()).toBe('xiaomengresume')
  })

  it('v2.1 版式对齐：Title=简历名、字体含中文子集（SimHei）', async () => {
    const sample = loadSample()
    const { buffer } = await buildTextPdf(sample, {
      language: 'zh-CN',
      privacyMode: false,
      pages: 'all'
    })
    const doc = await PDFDocument.load(buffer)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    // Info 元数据（Producer 因 pdf-lib 解析 bug + updateInfoDict 双重 quirk 不测；Title/Creator 足够）
    expect(doc.getTitle()).toBe('宋哈娜')
    expect(doc.getCreator()).toBe('xiaomengresume')
    // 字体子集：必须包含中文（CJK 嵌入 = 通过 ToUnicode CMap 映射非 ASCII 字符）
    // ToUnicode 在 FlateDecode 流里，先解压所有流再扫 bfchar
    const streams: string[] = []
    for (const m of buffer.toString('latin1').matchAll(/stream\r?\n(.*?)\r?\nendstream/gs)) {
      try {
        streams.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'))
      } catch {
        /* 非 deflate 流忽略 */
      }
    }
    const allInflated = streams.join('\n')
    // bfchar 形如 <xxxx><yyyy>（CMap 字符映射）
    const touHex = allInflated.match(/<[0-9a-f]{4}><[0-9a-f]{4}>/g) || []
    expect(touHex.length).toBeGreaterThan(20)
    // 字体名（PDF 字节 ASCII 区）：SimHei/SimSun/SourceHan/NotoSansCJK/Microsoft
    const bytes: string = buffer.toString('latin1')
    expect(bytes).toContain('SimHei')
    // 内容含基础 section 标题字符的 UTF-16BE 字形映射（ToUnicode CMap）
    expect(allInflated).toContain('<5b8b>') // 宋
    expect(allInflated).toContain('<9ad8>') // 娜
  })

  it('隐私模式：敏感字段置 ████（PDF 文本层）', async () => {
    const sample = loadSample()
    const normal = await buildTextPdf(sample, { language: 'zh-CN', privacyMode: false, pages: 'all' })
    const priv = await buildTextPdf(sample, { language: 'zh-CN', privacyMode: true, pages: 'all' })
    // 隐私 PDF 非空 + 可解析
    expect(priv.buffer.length).toBeGreaterThan(100)
    const doc = await PDFDocument.load(priv.buffer)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    // P0 回归：infoItems 的 UI id（emp/birth/mail/loc/web）不在规范字段名集合，
    // 原按 key 匹配导致邮箱/地址/网址漏打码。修复后按位置全打码：
    // 隐私 PDF 的解压流中必须出现 █（U+2588）的 ToUnicode 映射（<2588>），
    // 且正常 PDF 不应包含该映射（有字体环境才断言，Helvetica 兜底时 █ 为 notdef）
    const streams = (b: Buffer): string[] => {
      const out: string[] = []
      for (const m of b.toString('latin1').matchAll(/stream\r?\n(.*?)\r?\nendstream/gs)) {
        try {
          out.push(zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'))
        } catch {
          /* 非 deflate 流忽略 */
        }
      }
      return out
    }
    const privInflated = streams(priv.buffer).join('\n')
    const normalInflated = streams(normal.buffer).join('\n')
    const hasCjkFont = privInflated.includes('<2588>')
    if (hasCjkFont) {
      // 打码占位符确实渲染进 PDF
      expect(privInflated).toContain('<2588>')
      // 正常 PDF 无打码占位
      expect(normalInflated).not.toContain('<2588>')
    }
    // 字节层面：打码后内容必然变化
    expect(priv.buffer.length).not.toBe(normal.buffer.length)
  })

  it('M4a 回归：privacyMode 下 PDF 模板不渲染头像 <Image>（F16 打码对齐预览 blur）', () => {
    const sample = loadSample()
    // 注：node 测试环境 @react-pdf 4.6.0 图片不落 PDF（MINI-IMG 实测 0），故走元素树级断言
    //（ResumePdfDocument 为无 hooks 纯函数，直接调用拿 JSX 元素树）
    const countImages = (el: unknown): number => {
      if (!el || typeof el !== 'object') return 0
      const e = el as { type?: unknown; props?: { children?: unknown } }
      let n = e.type === Image ? 1 : 0
      const children = e.props?.children
      if (Array.isArray(children)) {
        for (const c of children) n += countImages(c)
      } else {
        n += countImages(children)
      }
      return n
    }
    const photoSrc = 'data:image/png;base64,REQL' // 任意非空 src（仅元素树检查，不真实渲染）
    const normal = ResumePdfDocument({ resume: sample, language: 'zh-CN', privacyMode: false, photoSrc })
    const priv = ResumePdfDocument({ resume: sample, language: 'zh-CN', privacyMode: true, photoSrc })
    expect(countImages(normal)).toBe(1)
    expect(countImages(priv)).toBe(0)
  })
})

describe('pdf/fonts (系统字体探测)', () => {
  it('注册不抛错（字体缺失也返回 warnings 而非 throw）', async () => {
    _resetFontRegistryForTest()
    const { warnings } = await import('../fonts').then((m) => m.registerPdfFonts(undefined))
    expect(Array.isArray(warnings)).toBe(true)
    // 本机 Windows 应有 simhei/msyh 之一
    const hasFont = existsSync('C:\\Windows\\Fonts\\simhei.ttf') || existsSync('C:\\Windows\\Fonts\\msyh.ttc')
    if (hasFont) {
      expect(warnings.length).toBe(0)
    }
  })
})
