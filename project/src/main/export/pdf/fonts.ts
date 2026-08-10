/**
 * pdf/fonts.ts —— 文字版 PDF 字体解析（2026-08-08 纯代码生成重构；2026-08-10 字体体系修复批）
 * FONT_OPTIONS（src/shared/constants/fonts.ts）是 CSS 字体栈白名单；
 * 纯代码 PDF 需要真实字体文件 → 这里把 id 映射到系统字体文件路径（跨平台探测），
 * 注册 @react-pdf/renderer 用。
 *
 * 铁律（2026-08-08 实测教训）：
 * - @react-pdf/font 的 Font.register src 只接受【字符串路径】——传 {data, format}
 *   对象会在 isDataUrl 处炸（dataUrl.indexOf is not a function）。
 * - **TTC（TrueType Collection）明确不支持**：fontkit.open 后 'fonts' in data →
 *   throw 'Font collection is not supported' → 必须回退 .ttf 单字体。
 * - 字体缺失/读取失败 → 不抛错，返回警告（Helvetica 兜底，中文会乱码但导出不崩）。
 *
 * 2026-08-10 修复（对齐最终分析计划 P0-1）：
 * - system 默认族改用【等线 Deng/Dengb】（Windows 自带 TTF，normal+bold 两文件 → 真加粗；
 *   预览端 FONT_OPTIONS.system 同步为 DengXian 优先 → 两端字形+字重一致）。
 * - 每个字体 id 注册独立 family（`zh-<id>` / `en-<id>`），支持按 section 逐区字体
 *   （getSectionFontFamily）；中西文混排经 template root `fontFamily: ['en-…','zh-…']` 数组回退。
 * - en 族（times/arial/georgia）真实消费（此前注册零引用 → 西文数字走 Helvetica/SimHei）。
 */
import { Font } from '@react-pdf/renderer'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { Layout } from '@shared/schema/resume'

/** 字体文件候选列表（.ttf 单字体；TTC 不支持） */
interface FontCandidate {
  id: string
  /** 族基名（注册族 = `${isCjk ? 'zh' : 'en'}-${id}`） */
  isCjk: boolean
  /** 常规字重文件候选（按优先级） */
  files: string[]
  /** 粗体字重文件候选（缺失时回退常规文件，@react-pdf 无 faux bold） */
  boldFiles?: string[]
}

const FONT_DIRS = [
  'C:\\Windows\\Fonts',
  '/System/Library/Fonts',
  '/System/Library/Fonts/Supplemental',
  '/usr/share/fonts/truetype',
  '/usr/share/fonts/opentype'
]

/** FONT_OPTIONS id → 系统字体文件映射（Windows 优先；.ttf 单字体在前） */
const CANDIDATES: FontCandidate[] = [
  // 2026-08-10：system 默认 = 等线（Deng/Dengb，Windows 10+ 自带 TTF，真加粗）
  { id: 'system', isCjk: true, files: ['Deng.ttf', 'simhei.ttf', 'msyh.ttf'], boldFiles: ['Dengb.ttf'] },
  { id: 'songti', isCjk: true, files: ['simsun.ttf', 'STSong.ttf'] },
  { id: 'heiti', isCjk: true, files: ['simhei.ttf', 'msyh.ttf'] },
  { id: 'yahei', isCjk: true, files: ['msyh.ttf', 'simhei.ttf'] },
  { id: 'kaiti', isCjk: true, files: ['simkai.ttf'] },
  { id: 'fangsong', isCjk: true, files: ['simfang.ttf'] },
  { id: 'times', isCjk: false, files: ['times.ttf'] },
  { id: 'arial', isCjk: false, files: ['arial.ttf'] },
  { id: 'georgia', isCjk: false, files: ['georgia.ttf'] }
]

/** 黑体兜底候选（中文 fallback；TTC 不行就用它） */
const FALLBACK_HEI = CANDIDATES.find((c) => c.id === 'heiti')!

/** 注册族名：zh-<id> / en-<id>（2026-08-10 起按 id 独立注册，支持逐区字体） */
export function familyFor(id: string): string {
  const c = CANDIDATES.find((x) => x.id === id) ?? FALLBACK_HEI
  return `${c.isCjk ? 'zh' : 'en'}-${id}`
}

/** 已注册指纹（固定：字体清单级一次性注册；同指纹跳过，_reset 清） */
const REG_FINGERPRINT = 'v2-all'
let registeredFingerprint: string | null = null

/** 只移除本项目注册的 family（zh- 前缀 / en- 前缀族），保留 @react-pdf 内置 Helvetica 等。 */
function clearPdfFamilies(): void {
  const store = Font as unknown as { fontFamilies?: Record<string, unknown> }
  if (store.fontFamilies) {
    for (const k of Object.keys(store.fontFamilies)) {
      if (k.startsWith('zh-') || k.startsWith('en-')) delete store.fontFamilies[k]
    }
  }
}

export interface FontRegistrationWarnings {
  warnings: string[]
  usedCjkFont: string
}

/** 查找第一个存在的 .ttf（跳过 .ttc —— fontkit 不支持字体集合） */
async function findTtfFile(files: string[]): Promise<string | null> {
  for (const dir of FONT_DIRS) {
    for (const file of files) {
      if (!file.toLowerCase().endsWith('.ttf')) continue // 跳过 TTC/OTF，仅单字体 TTF
      const p = path.join(dir, file)
      try {
        await fs.access(p)
        return p
      } catch {
        /* 下一个 */
      }
    }
  }
  return null
}

/**
 * 解析并注册字体（幂等）。
 * @param layout 简历排版（resumeFont / sectionFonts 决定字体族）
 * @returns 注册警告（字体缺失/回退），供 build.ts 记日志
 */
export async function registerPdfFonts(layout: Layout | undefined): Promise<FontRegistrationWarnings> {
  const warnings: string[] = []
  if (registeredFingerprint === REG_FINGERPRINT) {
    return { warnings, usedCjkFont: 'already-registered' }
  }
  clearPdfFamilies()
  registeredFingerprint = REG_FINGERPRINT

  // system 默认解析（zh-system / en-arial；兼容既有 resolveFontIds 语义）
  const cjkId = resolveFontIds(layout).cjk

  // 注册全部可用候选族（normal + bold 两文件；bold 缺失回退 normal）
  for (const c of CANDIDATES) {
    const normal = await findTtfFile(c.files)
    if (!normal) {
      if (c.id === 'system' || c.id === 'heiti') {
        // 黑体体系缺失才有告警；其余族（songti 等无 TTF）静默回退
        warnings.push(`no ${c.id} .ttf on system → fallback heiti`)
      }
      continue
    }
    const bold = c.boldFiles ? await findTtfFile(c.boldFiles) : null
    const family = familyFor(c.id)
    try {
      Font.register({
        family,
        fonts: [
          { src: normal, fontWeight: 'normal' },
          { src: bold ?? normal, fontWeight: 'bold' }
        ]
      })
    } catch (err) {
      warnings.push(`font register ${family} failed: ${String(err)}`)
    }
  }

  const used = familyFor(cjkId)
  return { warnings, usedCjkFont: used }
}

/** 从 layout 解析中文/西文字体 id（sectionFonts.basics 优先，回落 resumeFont，再回落 system） */
function resolveFontIds(layout: Layout | undefined): { cjk: string; en: string } {
  const pick = (sec?: string): string | undefined => {
    if (!layout) return undefined
    const sid = sec ? layout.sectionFonts?.[sec] : undefined
    const id = sid ?? layout.resumeFont
    return id && id !== 'system' ? id : undefined
  }
  const cjk = pick('basics') ?? pick(undefined) ?? 'system'
  // 2026-08-10：en 默认 arial（无衬线，对齐预览西文观感；原 times 衬线与预览 Segoe UI 不符）
  const en = pick('basics') ?? pick(undefined) ?? 'arial'
  return { cjk, en }
}

/**
 * 2026-08-10 新增：按 section 解析注册族名（逐区字体，对齐预览 fontFor(section)）。
 * - sectionFonts[section] 命中 → 对应 `zh-<id>`（西文族 id 视为无效中文族 → 回退 zh-system）
 * - 未命中 → 全局 cjk 解析结果
 * 注：中文内容必须落在 zh-* 族（en-* 族无中文字形）；西文数字由 template root fontFamily 数组兜底。
 */
export function getSectionFontFamily(section: string, layout: Layout | undefined): string {
  const cjkId = resolveFontIds(layout).cjk
  const sid = layout?.sectionFonts?.[section]
  const id = sid && sid !== 'system' ? sid : cjkId
  const c = CANDIDATES.find((x) => x.id === id)
  return c && c.isCjk ? familyFor(id) : familyFor(cjkId)
}

/** 测试辅助：重置注册状态 */
export function _resetFontRegistryForTest(): void {
  registeredFingerprint = null
  clearPdfFamilies()
}
