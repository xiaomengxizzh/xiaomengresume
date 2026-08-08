/**
 * pdf/fonts.ts —— 文字版 PDF 字体解析（2026-08-08 纯代码生成重构）
 * FONT_OPTIONS（src/shared/constants/fonts.ts）是 CSS 字体栈白名单；
 * 纯代码 PDF 需要真实字体文件 → 这里把 id 映射到系统字体文件路径（跨平台探测），
 * 注册 @react-pdf/renderer 用。
 *
 * 铁律（2026-08-08 实测教训）：
 * - @react-pdf/font 的 Font.register src 只接受【字符串路径】——传 {data, format}
 *   对象会在 isDataUrl 处炸（dataUrl.indexOf is not a function）。
 * - **TTC（TrueType Collection）明确不支持**：fontkit.open 后 'fonts' in data →
 *   throw 'Font collection is not supported' → 必须回退 .ttf 单字体（simhei.ttf 覆盖中文+粗体）。
 * - 字体缺失/读取失败 → 不抛错，返回警告（Helvetica 兜底，中文会乱码但导出不崩）。
 */
import { Font } from '@react-pdf/renderer'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { Layout } from '@shared/schema/resume'

/** 字体文件候选列表：优先 .ttf（TTC 不支持），.ttc 兜底不启用（探测用） */
interface FontCandidate {
  id: string
  /** 注册族名（中文=zh，西文=en；组件按需取） */
  family: string
  /** 系统字体文件名候选（按优先级；.ttf 在前，.ttc 仅作回退探测） */
  files: string[]
  /** 是否用于中文文本（fallback 到 simhei） */
  isCjk: boolean
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
  { id: 'system', family: 'zh', files: ['simhei.ttf', 'msyh.ttf', 'PingFang.ttc', 'NotoSansCJK-Regular.ttc'], isCjk: true },
  { id: 'songti', family: 'zh', files: ['simsun.ttf', 'STSong.ttf', 'NotoSerifCJK-Regular.ttc'], isCjk: true },
  { id: 'heiti', family: 'zh', files: ['simhei.ttf', 'msyh.ttf', 'STHeiti.ttf', 'NotoSansCJK-Regular.ttc'], isCjk: true },
  { id: 'yahei', family: 'zh', files: ['msyh.ttf', 'simhei.ttf', 'PingFang.ttc'], isCjk: true },
  { id: 'kaiti', family: 'zh', files: ['simkai.ttf', 'Kaiti.ttc', 'NotoSansCJK-Regular.ttc'], isCjk: true },
  { id: 'fangsong', family: 'zh', files: ['simfang.ttf', 'STFangsong.ttf', 'NotoSerifCJK-Regular.ttc'], isCjk: true },
  { id: 'times', family: 'en', files: ['times.ttf', 'LiberationSerif-Regular.ttf'], isCjk: false },
  { id: 'arial', family: 'en', files: ['arial.ttf', 'LiberationSans-Regular.ttf'], isCjk: false },
  { id: 'georgia', family: 'en', files: ['georgia.ttf'], isCjk: false }
]

/** 黑体兜底候选（中文+粗体；TTC 不行就用它） */
const FALLBACK_HEI = CANDIDATES.find((c) => c.id === 'heiti')!

/** 已注册标记（@react-pdf/renderer Font 全局单例，避免重复注册） */
let registered = false

export interface FontRegistrationWarnings {
  warnings: string[]
  usedCjkFont: string
}

/** 查找第一个存在的 .ttf（跳过 .ttc —— fontkit 不支持字体集合） */
async function findTtfFile(candidate: FontCandidate): Promise<string | null> {
  for (const dir of FONT_DIRS) {
    for (const file of candidate.files) {
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

/** 字体文件是否存在（任意扩展名；仅用于诊断 warning 文案） */
async function findAnyFontFile(candidate: FontCandidate): Promise<string | null> {
  for (const dir of FONT_DIRS) {
    for (const file of candidate.files) {
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
  if (registered) return { warnings, usedCjkFont: 'already-registered' }

  const resolved = resolveFontIds(layout)
  const cjkCandidate = CANDIDATES.find((c) => c.id === resolved.cjk) ?? FALLBACK_HEI
  const enCandidate = CANDIDATES.find((c) => c.id === resolved.en) ?? CANDIDATES.find((c) => c.id === 'times')!

  // 中文族：优先目标字体 .ttf，找不到回退黑体（simhei.ttf 覆盖中文+粗体）
  const cjkFile = (await findTtfFile(cjkCandidate)) ?? (await findTtfFile(FALLBACK_HEI))
  const enFile = (await findTtfFile(enCandidate)) ?? (await findTtfFile(CANDIDATES.find((c) => c.id === 'times')!))

  if (cjkFile) {
    try {
      Font.register({ family: 'zh', fonts: [{ src: cjkFile, fontWeight: 'normal' }, { src: cjkFile, fontWeight: 'bold' }] })
    } catch (err) {
      warnings.push(`cjk font register failed: ${String(err)}`)
    }
  } else {
    // TTC 存在但无 .ttf 可用的诊断（如只有 msyh.ttc 的环境）
    const ttc = await findAnyFontFile(cjkCandidate)
    warnings.push(ttc ? `only TTC font available (${path.basename(ttc)}), fontkit unsupported → cjk fallback Helvetica` : 'no cjk font found on system')
  }

  if (enFile) {
    try {
      Font.register({ family: 'en', fonts: [{ src: enFile, fontWeight: 'normal' }, { src: enFile, fontWeight: 'bold' }] })
    } catch {
      /* 西文缺省不阻塞 */
    }
  }

  registered = true
  return { warnings, usedCjkFont: cjkFile ? path.basename(cjkFile) : 'none' }
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
  const en = pick('basics') ?? pick(undefined) ?? 'times'
  return { cjk, en }
}

/** 测试辅助：重置注册状态 */
export function _resetFontRegistryForTest(): void {
  registered = false
}
