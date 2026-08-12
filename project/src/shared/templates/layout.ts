/**
 * shared/templates/layout.ts —— 排版逻辑值单一事实源（2026-08-10 架构收敛批 · v4 定案）
 *
 * 原则：所有影响"用户所见产物"的排版数值/公式只允许存在于本文件（逻辑值，单位 = px 或 em 系数）。
 * 预览端与 PDF 导出端【引用】本文件，各自只做引擎适配（预览 → CSSProperties；PDF → ×0.75 pt 换算），
 * 不再持有任何排版数值字面量 —— 杜绝双份拷贝漂移，自定义模板功能开放后由架构保证两端一致。
 *
 * 适配约定：
 * - px 逻辑值：预览直用；PDF 经 pt()（×0.75）换算
 * - em 系数：相对 baseFontSize 的倍数（两端同一公式：px = baseFontSize × 系数）
 * - 颜色/字体族不在本文件（分别归 theme 令牌与 shared/constants/fonts.ts）
 */
import type { Layout } from '@shared/schema/resume'

/* ── 模板排版预设（原 registry.ts PRESETS + pdf/template.tsx PRESETS 双份 → 收敛） ── */

export interface TemplatePreset {
  baseFontSize: number
  lineHeight: number
  pagePadding: number
  paragraphSpacing: number
  sectionSpacing: number
  headerSize: number
}

export type PresetKey = keyof TemplatePreset

export const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  classic: { baseFontSize: 16, lineHeight: 1.8, pagePadding: 32, paragraphSpacing: 12, sectionSpacing: 16, headerSize: 18 },
  modern: { baseFontSize: 16, lineHeight: 1.6, pagePadding: 36, paragraphSpacing: 14, sectionSpacing: 20, headerSize: 17 },
  compact: { baseFontSize: 15, lineHeight: 1.4, pagePadding: 26, paragraphSpacing: 10, sectionSpacing: 12, headerSize: 15 }
}

/** layout 覆盖链（原 preset.ts lv + pdf/template.tsx lv 双份 → 收敛）：
 *  M5 定案三层：layout 字段 > 全局模板覆盖（SettingsSchema.templates[templateId]）> 模板预设。
 *  override 为模板覆盖层数值子集（渲染层从 store settings 传入；shared 保持纯函数） */
export function lv(
  layout: Layout | undefined,
  key: PresetKey,
  preset: TemplatePreset,
  override?: Partial<Record<PresetKey, number>>
): number {
  const v = layout?.[key] ?? override?.[key]
  return typeof v === 'number' ? v : preset[key]
}

/** 日期格式化（原 primitives.fmtDate + pdf/dates.ts 双份 → 收敛）：YYYY-MM → YYYY/MM */
export function fmtDate(d: string | undefined): string {
  if (!d) return ''
  const [y, m] = d.split('-')
  return m ? `${y}/${m}` : y
}

/** 日期区间分隔符（对齐 material/简历示例1.pdf 连字符样式；2026-08-11 材料对比批） */
export const DATE_RANGE_SEP = ' - '

/* ── 字号体系 TYPE_SCALE（em 系数相对 baseFontSize；固定 px 用函数） ── */

export const TYPE_SCALE = {
  /** 姓名（px，按模板变体） */
  namePx: { classic: 30, modern: 30, compact: 24 },
  /** 职业/头衔（px，按模板变体） */
  headlinePx: { classic: 18, modern: 18, compact: 15 },
  /** 条目头（em） */
  entryHeadEm: 0.95,
  /** 条目副行（em） */
  entrySubEm: 0.85,
  /** 条目日期（em；2026-08-10 D10：对齐预览 0.95em，PDF 原 pt(13) 偏小 14%） */
  entryDateEm: 0.95,
  /** 描述段落（em） */
  descEm: 0.92,
  /** 技能条目（em） */
  skillEm: 0.92,
  /** 证书行（em） */
  certEm: 0.85,
  /** 语言行（em） */
  langEm: 0.85,
  /** profile 正文（em；对齐预览继承 base，PDF 原 0.92em 偏小） */
  profileEm: 1.0
} as const

/** em 系数 → px（预览直用 / PDF 经 pt()） */
export function emPx(base: number, em: number): number {
  return Math.round(base * em * 100) / 100
}

/* ── 节标题样式逻辑值（原预览 TITLE_STYLES + pdf sectionTitle 双份 → 收敛；px 逻辑值） ── */

export type TitleVariant = 'underline' | 'accent-bar' | 'compact'

export interface TitleStyleLogic {
  fontWeight: number
  letterSpacing: number // px
  color: 'accent' | 'muted' // accent=主题色 / muted=前景灰
  textTransform: 'uppercase' | 'none'
  /** 下划线变体（classic） */
  borderBottom?: { width: number; color: 'accent' }
  /** 左竖条变体（modern） */
  borderLeft?: { width: number; color: 'accent'; paddingLeft: number }
  paddingBottom: number // px
  marginBottom: number // px
}

/** 节标题样式（M5 定案：模板覆盖 titleStyle 优先于 variant 默认，三选一 underline/accent-bar/compact） */
export function titleStyleLogic(variant: TitleVariant, overrideTitleStyle?: 'underline' | 'accent-bar' | 'compact'): TitleStyleLogic {
  switch (overrideTitleStyle ?? variant) {
    case 'accent-bar':
      return { fontWeight: 600, letterSpacing: 0.5, color: 'muted', textTransform: 'none', borderLeft: { width: 4, color: 'accent', paddingLeft: 8 }, paddingBottom: 2, marginBottom: 10 }
    case 'compact':
      return { fontWeight: 700, letterSpacing: 0.3, color: 'muted', textTransform: 'none', paddingBottom: 2, marginBottom: 6 }
    default:
      return { fontWeight: 600, letterSpacing: 1, color: 'accent', textTransform: 'uppercase', borderBottom: { width: 2, color: 'accent' }, paddingBottom: 4, marginBottom: 10 }
  }
}

/* ── 区块间距逻辑值（原预览 SectionBlock + pdf section 双份公式 → 收敛；px） ── */

export interface SectionSpacingLogic {
  /** 区块间 margin（单边；两端同语义） */
  margin: number
  /** 区块末尾 padding（D2：gap+6px 语义，收窄末尾留白） */
  padding: number
  /** 分隔线宽（px） */
  line: number
}

export function sectionSpacingLogic(gap: number): SectionSpacingLogic {
  return { margin: gap, padding: 6, line: 1 }
}

/** 条目间距（原预览 edu 10 / work·proj 12 vs pdf pt(10) 统一 → 收敛按 section） */
export function entrySpacingLogic(sectionId: string): number {
  return sectionId === 'work' || sectionId === 'projects' ? 12 : 10
}

/* ── 头部联系信息网格（原预览 infoItems + pdf contactGrid 双份 → 收敛） ── */

export const CONTACT_GRID_LOGIC = {
  /** 标签字号档位（px；长内容降档） */
  fontSizeTiers: [16, 13, 11] as const,
  /** 阈值字符数（对应 16/13px 档边界；与预览 maxWidth 150px 触发时机对齐） */
  tierChars: [14, 24] as const,
  /** 长值截断阈值（对齐预览 ellipsis） */
  truncateLen: 24,
  /** 图标尺寸（px；2026-08-10 D8：预览 15 与 PDF 9 折中） */
  iconSize: 12,
  /** 列间距 / 行间距（px） */
  gapX: 20,
  gapY: 7,
  /** 单值最大显示宽（px，预览 ellipsis 用） */
  maxWidth: 150,
  /** 图标与文本间距（px） */
  iconGap: 6
} as const

/** 标签字号档位（px；长内容缩小，两端同规则） */
export function contactFontSize(text: string): number {
  const len = text.length
  if (len > CONTACT_GRID_LOGIC.tierChars[1]) return CONTACT_GRID_LOGIC.fontSizeTiers[2]
  if (len > CONTACT_GRID_LOGIC.tierChars[0]) return CONTACT_GRID_LOGIC.fontSizeTiers[1]
  return CONTACT_GRID_LOGIC.fontSizeTiers[0]
}

/** 长值截断 + 省略号（对齐预览 ellipsis；PDF 无 whiteSpace/截断能力） */
export function truncateContactValue(v: string): string {
  return v.length > CONTACT_GRID_LOGIC.truncateLen ? `${v.slice(0, CONTACT_GRID_LOGIC.truncateLen)}…` : v
}

/* ── 列表标记（原预览富文本 preflight 无标记 vs pdf '• ' 前缀 → 收敛统一：两端显标记+缩进，D9/D16） ── */

export const LIST_MARK_LOGIC = {
  bullet: '• ',
  ordered: (n: number): string => `${n}. `,
  /** 缩进（px；对齐预览 skills ul paddingLeft 18px） */
  indent: 18
} as const

/* ── 紧凑排版（2026-08-10 任务4：仅覆盖间距变量，不动字号/内容；允许内容溢出多页，禁 scale/截断） ── */

/** 紧凑预设系数（D4）：lineHeight −0.15（下限 1.3）、pagePadding ×0.6、paragraphSpacing ×0.6、
 *  sectionSpacing ×0.75、headerSize −1（下限 12）；baseFontSize 不变。 */
export function compactSpacing(preset: TemplatePreset): TemplatePreset {
  return {
    baseFontSize: preset.baseFontSize,
    lineHeight: Math.max(1.3, Math.round((preset.lineHeight - 0.15) * 100) / 100),
    pagePadding: Math.max(8, Math.round(preset.pagePadding * 0.6)),
    paragraphSpacing: Math.max(4, Math.round(preset.paragraphSpacing * 0.6)),
    sectionSpacing: Math.max(6, Math.round(preset.sectionSpacing * 0.75)),
    headerSize: Math.max(12, preset.headerSize - 1)
  }
}

/* ── 联系信息图标（原 InfoIcons.tsx + PdfIcon 双份 SVG → 收敛为元素数据；viewBox 24 坐标系） ── */

export interface IconEl {
  kind: 'rect' | 'circle' | 'path'
  props: Record<string, number | string>
}

export const INFO_ICON_ELEMENTS: Record<string, IconEl[]> = {
  mail: [
    { kind: 'rect', props: { x: 3, y: 5, width: 18, height: 14, rx: 2 } },
    { kind: 'path', props: { d: 'm3 7 9 6 9-6' } }
  ],
  phone: [{ kind: 'path', props: { d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' } }],
  pin: [
    { kind: 'path', props: { d: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' } },
    { kind: 'circle', props: { cx: 12, cy: 10, r: 3 } }
  ],
  globe: [
    { kind: 'circle', props: { cx: 12, cy: 12, r: 10 } },
    { kind: 'path', props: { d: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20' } }
  ],
  briefcase: [
    { kind: 'rect', props: { x: 2, y: 7, width: 20, height: 14, rx: 2 } },
    { kind: 'path', props: { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' } }
  ],
  calendar: [
    { kind: 'rect', props: { x: 3, y: 4, width: 18, height: 18, rx: 2 } },
    { kind: 'path', props: { d: 'M16 2v4M8 2v4M3 10h18' } }
  ],
  link: [
    { kind: 'path', props: { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' } },
    { kind: 'path', props: { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' } }
  ],
  user: [
    { kind: 'path', props: { d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2' } },
    { kind: 'circle', props: { cx: 12, cy: 7, r: 4 } }
  ],
  star: [{ kind: 'path', props: { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' } }],
  map: [
    { kind: 'path', props: { d: 'M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3z' } },
    { kind: 'path', props: { d: 'M9 4v13M15 7v13' } }
  ]
}
