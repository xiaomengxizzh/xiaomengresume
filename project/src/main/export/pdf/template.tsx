/**
 * pdf/template.tsx —— 文字版 PDF 简历文档（v2.1 重写：1:1 对齐 PreviewPane 版式）
 *
 * 2026-08-08 v2.1 关键修订：原 v2.0 是"PDF 专用简化版"，与 PreviewPane 视觉脱钩 → 用户反馈"预览
 * 和导出明显不一样"违反"模板=打印"承诺。现完全复用 templates/shared/preset.ts 的版式参数与
 * ResumeBody.tsx 的结构（除 web CSS 不可用部分），字号/间距/标题样式 1:1 对齐。
 *
 * 2026-08-08 v2.2 修复（P1）：
 *  - 版式按 resume.layout.templateId 选三套预设（classic/modern/compact），layout 覆盖链同渲染端 lv()
 *  - 主题色：ACCENT = layout.themeColor（原硬编码 #475569）
 *  - 头像：<Image> 渲染 basics.photo（data URL / https 外链直通；'avatar' 标记探测 dev 资源，缺失跳过）
 *  - 标题样式按模板变体（underline / accent-bar / compact）
 *  - px→pt 换算：@react-pdf 无单位数值按 pt 处理，原直写 px 值致导出比预览大 33%
 *
 * 与 PreviewPane/ResumeBody 的关系：
 * - 数据同源（ResumeSchema）
 * - 版式参数同源（preset：baseFontSize/lineHeight/pagePadding/...）
 * - 渲染器不同：PreviewPane = DOM/CSS；本组件 = @react-pdf/renderer StyleSheet（Flexbox 子集）
 * - 渲染结果像素级一致是目标，但 PDF 渲染器对部分 CSS 特性支持有限（无 grid；无 transform；
 *   border 部分支持；text-transform: uppercase 对中文无效但保留不破坏版式）。
 */
import React from 'react'
import { Document, Page, StyleSheet, Text, View, Image, Svg, Path, Circle, Rect } from '@react-pdf/renderer'
import type { Resume } from '@shared/schema/resume'
import type { Language } from '@shared/schema/settings'
import type { Style } from '@react-pdf/types'
import type { PdfParagraph } from './richtext'
import { richTextToPdfParagraphs } from './richtext'
import { fmtDate } from './dates'
import { getSectionFontFamily } from './fonts'
// 2026-08-10 架构收敛批：排版逻辑值单一事实源（与预览端同源引用）
import { TEMPLATE_PRESETS, lv, titleStyleLogic, sectionSpacingLogic, entrySpacingLogic, TYPE_SCALE, emPx, CONTACT_GRID_LOGIC, contactFontSize, truncateContactValue, LIST_MARK_LOGIC, INFO_ICON_ELEMENTS, type TemplatePreset } from '@shared/templates/layout'


// 2026-08-10：模板预设单一事实源 = shared TEMPLATE_PRESETS（不再本地拷贝）
const PRESETS: Record<string, TemplatePreset> = TEMPLATE_PRESETS as Record<string, TemplatePreset>

// lv() 收敛自 shared/templates/layout.ts
/** px → pt（PDF 1pt = 1/72in；CSS 96dpi 下 1px = 0.75pt。
 *  2026-08-08 修复 P1：@react-pdf 无单位数值按 pt 处理，原直写 px 值致导出比预览大 33%。） */
const pt = (px: number): number => px * 0.75

/** 标题样式变体（对齐 renderer ResumeBody.tsx TITLE_STYLES） */
type TitleVariant = 'underline' | 'accent-bar' | 'compact'
const variantOf = (templateId: string | undefined): TitleVariant =>
  templateId === 'modern' ? 'accent-bar' : templateId === 'compact' ? 'compact' : 'underline'

/** section 标题字典（对齐 renderer/src/i18n/{zh-CN,en}.json editor.section.*） */
const SECTION_TITLES: Record<Language, Record<string, string>> = {
  'zh-CN': { summary: '自我评价', education: '教育经历', work: '工作经历', projects: '项目经历', skills: '专业技能', certificates: '证书', languages: '语言' },
  en: { summary: 'Summary', education: 'Education', work: 'Work Experience', projects: 'Projects', skills: 'Skills', certificates: 'Certificates', languages: 'Languages' }
}

/** 隐私打码占位 */
const REDACT = '████'

const DOC_PRODUCER = 'xiaomengresume'
const DEFAULT_ACCENT = '#475569' // 与 PreviewPane --rm-accent 默认值一致

/** 隐私打码（F16）：与预览端 CSS 对齐——按「显示位置」而非字段名。
 *  预览端 data-redact='on' 下 name/headline/全部 infoItems/contactItems 无条件 blur，
 *  infoItems 的 UI id（emp/birth/mail/loc/web…）与规范字段名不匹配，
 *  原按 key 白名单判定导致邮箱/地址/网址漏打码（P0）。此处统一按位置打码。 */
const redactValue = (v: string | undefined, privacyMode: boolean): string =>
  privacyMode && v ? REDACT : v ?? ''

// ── 样式构造（v2.2 动态化：preset/主题色/标题变体驱动）───────────────────────
// 所有长度经 pt() 换算；lineHeight 为相对倍数不换算。
// 与 ResumeBody 同值（em 换算：baseFontSize=16 → 0.95em≈15.2px, 0.92em≈14.7px, 0.85em≈13.6px）。
function makeStyles(preset: TemplatePreset, accent: string, variant: TitleVariant) {
  const { baseFontSize, lineHeight, pagePadding, paragraphSpacing, sectionSpacing, headerSize } = preset
  // 2026-08-10：样式变体 → 模板 id 反向映射（TYPE_SCALE.namePx/headlinePx 按模板 id 索引）
  const tplId = variant === 'underline' ? 'classic' : variant === 'accent-bar' ? 'modern' : 'compact'
  const sectionTitleBase: Style = {
    fontSize: pt(headerSize),
    fontWeight: 600,
    color: '#444'
  }
  // 2026-08-10：节标题逻辑值 = shared titleStyleLogic（letterSpacing/border/padding 统一 pt 换算，消除裸值 +33%）
  const tl = titleStyleLogic(variant)
  const sectionTitle: Style = {
    ...sectionTitleBase,
    fontWeight: tl.fontWeight,
    letterSpacing: pt(tl.letterSpacing),
    color: tl.color === 'accent' ? accent : '#333',
    textTransform: tl.textTransform,
    paddingBottom: pt(tl.paddingBottom),
    marginBottom: pt(tl.marginBottom),
    ...(tl.borderBottom ? { borderBottomWidth: pt(tl.borderBottom.width), borderBottomColor: accent, borderBottomStyle: 'solid' as const } : {}),
    ...(tl.borderLeft ? { borderLeftWidth: pt(tl.borderLeft.width), borderLeftColor: accent, borderLeftStyle: 'solid' as const, paddingLeft: pt(tl.borderLeft.paddingLeft) } : {})
  }

  return StyleSheet.create({
    page: {
      paddingTop: pt(pagePadding),
      paddingBottom: pt(pagePadding),
      // 2026-08-10 P1-7：modern 横向 padding 对齐预览（classic +24，modern/compact +20）
      paddingHorizontal: pt(pagePadding + (variant === 'underline' ? 24 : 20)),
      fontSize: pt(baseFontSize),
      lineHeight,
      color: '#333',
      // 2026-08-10 P0-1：中西文混排——西文/数字优先 en-arial，中文回退 zh-system（等线）
      fontFamily: ['en-arial', 'zh-system']
    },
    // 头部：flex 行；左头像+名字 | 右联系方式
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: pt(24),
      marginBottom: pt(sectionSpacing)
    },
    headerMain: {
      flexShrink: 0
    },
    photo: {
      objectFit: 'cover',
      flexShrink: 0
      // 2026-08-10 P0-2：删除 marginRight（与 header gap 叠加致照片→姓名间距 48pt vs 预览 24px）
    },
    name: {
      // 2026-08-10：姓名字号 = TYPE_SCALE（按模板 id 索引；variant 样式变体 → 模板 id 反向映射）
      fontSize: pt(TYPE_SCALE.namePx[tplId]),
      fontWeight: 700,
      color: '#111827',
      lineHeight: 1.2,
      marginBottom: pt(2)
    },
    headline: {
      fontSize: pt(TYPE_SCALE.headlinePx[tplId]),
      color: '#666',
      opacity: 0.75,
      lineHeight: 1.4
    },
    contactGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      // 2026-08-10：与姓名块加缓冲间距（视觉复核：图标与姓名末字过近；header gap 已生效仍补 8pt）
      marginLeft: pt(8),
      // 2026-08-10 修复：列宽对齐预览 grid auto auto——contactItem 定宽 48% 保证两列严格对齐
      // （原 44% 相对 auto 宽父级百分比，Yoga 解析不定致列漂移）；maxWidth 防长值挤压 identity 块
      maxWidth: '58%',
      // R5：紧跟姓名右侧（不再 flexGrow 推到行尾），与预览端去掉 marginLeft:auto 对齐
      justifyContent: 'flex-start',
      rowGap: pt(CONTACT_GRID_LOGIC.gapY),
      columnGap: pt(CONTACT_GRID_LOGIC.gapX)
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '48%' // 2026-08-10：两列等宽对齐（原 44% 不定）
    },
    contactText: {
      fontSize: pt(CONTACT_GRID_LOGIC.fontSizeTiers[0]), // 基准 = 首档（每项按长度降档覆盖）
      color: '#444',
      marginLeft: pt(5)
    },
    profile: {
      marginTop: pt(12)
    },
    profileText: {
      fontSize: pt(baseFontSize), // F6：对齐预览 profile 继承 base
      lineHeight,
      marginBottom: pt(paragraphSpacing)
    },
    // section 容器（2026-08-10 收敛：间距逻辑 = shared sectionSpacingLogic(gap)——
    // margin=gap + padding=6px + 线=1px，与预览 SectionBlock 同函数，消除末尾留白过大与两端不一致）
    section: {
      marginBottom: pt(sectionSpacingLogic(sectionSpacing).margin),
      borderBottomWidth: pt(sectionSpacingLogic(sectionSpacing).line),
      borderBottomColor: '#e8e8e8',
      paddingBottom: pt(sectionSpacingLogic(sectionSpacing).padding)
    },
    sectionTitle: sectionTitle,
    // 条目容器（F2：间距 = shared entrySpacingLogic；默认 edu 10px，work/projects 由 renderer 覆盖 12px）
    entry: {
      marginBottom: pt(entrySpacingLogic('education'))
    },
    // 条目头（ResumeBody entryHead：左标题右日期）
    entryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    },
    entryTitle: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.entryHeadEm)),
      fontWeight: 700,
      color: '#222'
    },
    entryDate: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.entryDateEm)), // D10：对齐预览 0.95em
      color: '#666'
    },
    entrySub: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.entrySubEm)),
      color: '#666',
      opacity: 0.8,
      marginTop: pt(1)
    },
    // 描述段落（TYPE_SCALE.descEm；profile 用 profileText 继承 base）
    desc: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.descEm)),
      lineHeight,
      marginBottom: pt(paragraphSpacing)
    },
    skillItem: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.skillEm)),
      // F7：缩进对齐预览 skills ul（LIST_MARK_LOGIC.indent）
      marginLeft: pt(LIST_MARK_LOGIC.indent),
      marginBottom: pt(2)
    },
    certRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: pt(4)
    },
    certName: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.certEm))
    },
    certDate: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.certEm)),
      color: '#666'
    },
    langItem: {
      fontSize: pt(emPx(baseFontSize, TYPE_SCALE.langEm)),
      marginBottom: pt(2)
    },
    flex1: {
      flex: 1
    }
  })
}

type PdfStyles = ReturnType<typeof makeStyles>

/** 段落 → 文本节点列表（bold/italic/strike/link 用嵌套 Text 内联样式；P2：补 italic/strike/link）
 *  textStyle：段落容器样式覆盖（profile 用 base 字号，其余默认 styles.desc） */
const renderParagraphs = (paragraphs: PdfParagraph[], styles: PdfStyles, accent: string, textStyle?: Style): React.JSX.Element[] =>
  paragraphs.map((p, i) => {
    const prefix = p.list === 'bullet' ? LIST_MARK_LOGIC.bullet : p.list === 'ordered' ? LIST_MARK_LOGIC.ordered(p.order ?? 1) : ''
    return (
      <Text key={i} style={textStyle ?? styles.desc}>
        {prefix}
        {p.runs.map((r, j) => {
          const extra: Style = {}
          if (r.bold) extra.fontWeight = 'bold'
          if (r.italic) extra.fontStyle = 'italic'
          if (r.strike) extra.textDecoration = 'line-through'
          if (r.link) {
            // 2026-08-10 P1-4：链接色随主题色（原硬编码 #475569，⑰ 只修了图标漏了链接）
            extra.color = accent
            extra.textDecoration = 'underline'
          }
          const needNest = Object.keys(extra).length > 0
          return needNest ? (
            <Text key={j} style={extra}>{r.text}</Text>
          ) : (
            r.text
          )
        })}
      </Text>
    )
  })

/** 分区标题（v2.2：样式按模板变体，accent-bar 用主题色左条） */
const SectionTitle = ({ title, styles }: { title: string; styles: PdfStyles }): React.JSX.Element => (
  <Text style={styles.sectionTitle}>{title}</Text>
)

/** 条目头：左标题 + 右日期（ResumeBody entryHead：space-between 两端对齐） */
const EntryHead = ({ left, right, styles }: { left: string; right: string; styles: PdfStyles }): React.JSX.Element => (
  <View style={styles.entryRow}>
    <Text style={[styles.entryTitle, styles.flex1]}>{left}</Text>
    {right ? <Text style={styles.entryDate}>{right}</Text> : null}
  </View>
)

/** 条目副信息（ResumeBody entrySub：fontSize 0.85em，opacity 0.8） */
const EntrySub = ({ children, styles }: { children: string; styles: PdfStyles }): React.JSX.Element => (
  <Text style={styles.entrySub}>{children}</Text>
)

/** 联系信息线性图标（2026-08-10 架构收敛批：SVG 元素数据单一事实源 = shared INFO_ICON_ELEMENTS，
 * 与预览 InfoIcons 同源引用——杜绝双份 path 漂移；尺寸 = CONTACT_GRID_LOGIC.iconSize（D8 折中 12px）。） */
const PdfIcon = ({ id, color }: { id: string; color: string }): React.JSX.Element | null => {
  const els = INFO_ICON_ELEMENTS[id]
  if (!els || els.length === 0) return null
  const stroke = { stroke: color, strokeWidth: 1.6, fill: 'none' }
  const size = pt(CONTACT_GRID_LOGIC.iconSize)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {els.map((el, i) => {
        if (el.kind === 'rect') {
          const p = el.props as { x: number; y: number; width: number; height: number; rx?: number }
          return <Rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} {...stroke} />
        }
        if (el.kind === 'circle') {
          const p = el.props as { cx: number; cy: number; r: number }
          return <Circle key={i} cx={p.cx} cy={p.cy} r={p.r} {...stroke} />
        }
        return <Path key={i} d={el.props.d as string} {...stroke} />
      })}
    </Svg>
  )
}

export interface ResumePdfProps {
  resume: Resume
  language: Language
  privacyMode: boolean
  /** 头像 data URL / https 外链（build.ts 已把 'avatar' 标记解析为 data URL，见 build.ts resolvePdfPhotoSrc） */
  photoSrc?: string | null
}

/**
 * R5：标签内容过长缩小字体（pt 值，与预览端 ResumeBody infoFontSize 同规则：
 * ≤14 字符 16px=12pt → ≤24 字符 13px=9.75pt → 更长 11px=8.25pt）。
 * 2026-08-10 P0-3：返回值即 pt（调用处不再套 pt()——原双重换算致字号缩小 25-35%）。
 */
/**
 * 2026-08-10 修复：标签字号档位/长值截断单一事实源 = shared CONTACT_GRID_LOGIC。
 * contactFontSize 返回 px 逻辑值 → ×0.75 换算为 pt（此前误用 emPx 导致 px 值当 pt → 放大 33%）。
 */
function infoFontSizePt(text: string): number {
  return contactFontSize(text) * 0.75
}

function truncateValue(v: string): string {
  return truncateContactValue(v)
}

export function ResumePdfDocument({ resume, language, privacyMode, photoSrc }: ResumePdfProps): React.JSX.Element {
  const b = resume.basics
  const titles = SECTION_TITLES[language] ?? SECTION_TITLES['zh-CN']
  const redact = (v: string | undefined): string => redactValue(v, privacyMode)

  // R6：基本信息三透明模块排序（编辑区 basicsOrder 驱动头部三块排列；缺省经典顺序，与预览端一致）
  const basicsOrder = (resume.layout?.basicsOrder?.length ? resume.layout.basicsOrder : ['photo', 'identity', 'tags']) as Array<'photo' | 'identity' | 'tags'>

  // P1 修复：从 layout 取模板预设/主题色/标题变体（原硬编码 classic + #475569）
  const layout = resume.layout
  const templateId = layout?.templateId
  const preset = PRESETS[templateId ?? 'classic'] ?? PRESETS.classic
  // layout 覆盖链（同渲染端 preset.ts lv()）：layout > 模板预设
  const effective: TemplatePreset = {
    baseFontSize: lv(layout, 'baseFontSize', preset),
    lineHeight: lv(layout, 'lineHeight', preset),
    pagePadding: lv(layout, 'pagePadding', preset),
    paragraphSpacing: lv(layout, 'paragraphSpacing', preset),
    sectionSpacing: lv(layout, 'sectionSpacing', preset),
    headerSize: lv(layout, 'headerSize', preset)
  }
  const accent = layout?.themeColor ?? DEFAULT_ACCENT
  const variant: TitleVariant = variantOf(templateId)
  const styles = makeStyles(effective, accent, variant)

  // 头部：名字 + 职位（ResumeBody：30px 加粗 accent 色）
  const name = redact(b.name)
  const displayName = name || (privacyMode ? REDACT : '')

  // 头像（ResumeBody：photoWidth/photoHeight，缺省 110×110 —— 2026-08-10 P1-2 对齐预览 CLASSIC_PHOTO；
  // px → pt 换算）
  // 2026-08-09 T2：渲染尺寸兜底 clamp（导入已等比缩放至基准宽 110；上限 180px → 135pt / 240px → 180pt）
  const photoW = Math.min(((b.photoWidth ?? 110) * 0.75) || 0, 135)
  const photoH = Math.min(((b.photoHeight ?? 110) * 0.75) || 0, 180)

  // 联系信息两列（对齐预览 ResumeBody infoItems 区 + material/简历示例1.pdf 参考：
  // 右侧 3 行 × 2 列 = [离职,生日] / [邮箱,电话] / [地址,网址]）
  // P1 修复：fallback 字段集与顺序对齐预览（原只有 phone/email/location/website 4 项且顺序错乱，
  // 缺 employmentStatus/birthDate → 导出比预览少字段）；去重基于原始值（红码后全是 ████
  // 对打码值去重会误删占位条目）。customFields 不进头部区（预览 infoItems 区亦不含，防两处不一致）。
  // v2.3 修复：infoItems 分支保留 icon 字段（预览端 InfoIcon 用 it.icon；原丢 icon 致 PDF 图标缺失）。
  const FIELD_ICON: Record<string, string> = { emp: 'briefcase', birth: 'calendar', mail: 'mail', phone: 'phone', loc: 'pin', web: 'globe' }
  // 2026-08-09 T2：标签（customFields，含 icon）并入联系信息——PDF 导出同步显示；均空回退旧字段 6 项
  let contactItemsRaw = [
    ...(b.infoItems ?? []).map((it) => ({ id: it.id, icon: it.icon ?? FIELD_ICON[it.id] ?? '', value: it.value })),
    ...(b.customFields ?? [])
      .filter((cf) => cf.value)
      .map((cf) => ({ id: cf.id, icon: cf.icon || 'pin', value: cf.value }))
  ]
  if (contactItemsRaw.length === 0) {
    contactItemsRaw = [
      { id: 'emp', icon: FIELD_ICON.emp, value: b.employmentStatus ?? '' },
      { id: 'birth', icon: FIELD_ICON.birth, value: b.birthDate ?? '' },
      { id: 'mail', icon: FIELD_ICON.mail, value: b.email ?? '' },
      { id: 'phone', icon: FIELD_ICON.phone, value: b.phone ?? '' },
      { id: 'loc', icon: FIELD_ICON.loc, value: b.location ?? '' },
      { id: 'web', icon: FIELD_ICON.web, value: b.website ?? '' }
    ]
  }
  const contactItems = contactItemsRaw
    .filter((it) => it.value && it.value.trim().length > 0)
    .filter((it, i, arr) => arr.findIndex((x) => x.value === it.value) === i)
    .map((it) => ({ id: it.id, icon: it.icon, value: truncateValue(redact(it.value)) }))
    .filter((it) => it.value.length > 0)

        const DEFAULT_SECTION_ORDER = ['education', 'work', 'projects', 'skills', 'certificates', 'languages']
        const orderedIds = resume.layout?.sectionOrder?.length
          ? resume.layout.sectionOrder.filter((id) => id !== 'basics' && id !== 'summary')
          : DEFAULT_SECTION_ORDER
        const renderCustom = (id: string): React.JSX.Element | null => {
          const cs = resume.customSections?.find((c) => c.id === id)
          if (!cs) return null
          return (
            <View style={[styles.section, { fontFamily: getSectionFontFamily(id, layout) }]}>
              <SectionTitle title={cs.title || ''} styles={styles} />
              {cs.content ? renderParagraphs(richTextToPdfParagraphs(cs.content), styles, accent) : null}
            </View>
          )
        }
        const sectionRenderers: Record<string, () => React.JSX.Element> = {
          education: () => (
            <>
          {resume.education.filter((e) => e.visible !== false).length > 0 ? (
            <View style={[styles.section, { fontFamily: getSectionFontFamily('education', layout) }]}>
              <SectionTitle title={titles.education} styles={styles} />
              {resume.education
                .filter((e) => e.visible !== false)
                .map((e) => (
                  <View key={e.id} style={styles.entry} wrap={false}>
                    <EntryHead left={e.school || ''} right={[fmtDate(e.startDate), e.endDate ? fmtDate(e.endDate) : ''].filter(Boolean).join(' – ')} styles={styles} />
                    {e.degree || e.major ? <EntrySub styles={styles}>{[e.degree, e.major].filter(Boolean).join(' · ')}</EntrySub> : null}
                    {e.description ? renderParagraphs(richTextToPdfParagraphs(e.description), styles, accent) : null}
                  </View>
                ))}
            </View>
          ) : null}

          </>
          ),
          work: () => (
            <>
          {resume.work.filter((w) => w.visible !== false).length > 0 ? (
            <View style={[styles.section, { fontFamily: getSectionFontFamily('work', layout) }]}>
              <SectionTitle title={titles.work} styles={styles} />
              {resume.work
                .filter((w) => w.visible !== false)
                .map((w) => (
                  <View key={w.id} style={[styles.entry, { marginBottom: pt(entrySpacingLogic('work')) }]} wrap={false}>
                    <EntryHead
                      left={w.company || ''}
                      right={[fmtDate(w.startDate), w.current ? (language === 'zh-CN' ? '至今' : 'Present') : w.endDate ? fmtDate(w.endDate) : ''].filter(Boolean).join(' – ')}
                      styles={styles}
                    />
                    {w.title ? <EntrySub styles={styles}>{w.title}</EntrySub> : null}
                    {w.summary ? renderParagraphs(richTextToPdfParagraphs(w.summary), styles, accent) : null}
                  </View>
                ))}
            </View>
          ) : null}

          </>
          ),
          projects: () => (
            <>
          {resume.projects.filter((p) => p.visible !== false).length > 0 ? (
            <View style={[styles.section, { fontFamily: getSectionFontFamily('projects', layout) }]}>
              <SectionTitle title={titles.projects} styles={styles} />
              {resume.projects
                .filter((p) => p.visible !== false)
                .map((p) => (
                  <View key={p.id} style={[styles.entry, { marginBottom: pt(entrySpacingLogic('projects')) }]} wrap={false}>
                    <EntryHead left={p.name || ''} right={[fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : ''].filter(Boolean).join(' – ')} styles={styles} />
                    {p.role || p.organization ? <EntrySub styles={styles}>{[p.role, p.organization].filter(Boolean).join(' · ')}</EntrySub> : null}
                    {p.description ? renderParagraphs(richTextToPdfParagraphs(p.description), styles, accent) : null}
                  </View>
                ))}
            </View>
          ) : null}

          </>
          ),
          skills: () => (
            <>
          {resume.skills.length > 0 ? (
            <View style={[styles.section, { fontFamily: getSectionFontFamily('skills', layout) }]}>
              <SectionTitle title={titles.skills} styles={styles} />
              {resume.skills.map((s) => (
                <Text key={s.id} style={styles.skillItem}>
                  {LIST_MARK_LOGIC.bullet}{s.name}
                  {s.level ? `（${s.level}）` : ''}
                  {s.category ? ` · ${s.category}` : ''}
                </Text>
              ))}
            </View>
          ) : null}

          </>
          ),
          certificates: () => (
            <>
          {resume.certificates.length > 0 ? (
            <View style={[styles.section, { fontFamily: getSectionFontFamily('certificates', layout) }]}>
              <SectionTitle title={titles.certificates} styles={styles} />
              {resume.certificates.map((c) => (
                <View key={c.id} style={styles.certRow}>
                  <Text style={[styles.certName, styles.flex1]}>{c.name}</Text>
                  <Text style={styles.certDate}>{[c.issuer, fmtDate(c.date)].filter(Boolean).join(' · ')}</Text>
                </View>
              ))}
            </View>
          ) : null}

          </>
          ),
          languages: () => (
            <>
          {resume.languages.length > 0 ? (
            <View style={[styles.section, { fontFamily: getSectionFontFamily('languages', layout) }]}>
              <SectionTitle title={titles.languages} styles={styles} />
              {resume.languages.map((l) => (
                <Text key={l.id} style={styles.langItem}>
                  {l.name}
                  {l.proficiency ? `（${l.proficiency}）` : ''}
                </Text>
              ))}
            </View>
          ) : null}
          </>
          )
        }
  return (
    <Document title={displayName || 'Resume'} producer={DOC_PRODUCER} creator={DOC_PRODUCER}>
      <Page size="A4" style={styles.page}>
        {/* 头部：左头像+名字+职位 | 右联系信息两列（ResumeBody L120-172） */}
        {/* 2026-08-10 P1-5：隐私模式渲染剪影占位（与预览 blur 显示一致；@react-pdf 无滤镜能力） */}
        {/* R6：头部三块（图片/姓名与职业/标签信息）按 basicsOrder 顺序渲染，与预览端一致 */}
        <View style={styles.header}>
          {basicsOrder.map((bid) => {
            if (bid === 'photo') {
              return photoSrc && !privacyMode ? (
                <Image key={bid} src={photoSrc} style={[styles.photo, { width: photoW, height: photoH }]} />
              ) : (
                /* 2026-08-09 T2：无照片时人形剪影占位（与预览 .photo-placeholder 一致，守「模板=打印」） */
                <View key={bid} style={[styles.photo, { width: photoW, height: photoH, backgroundColor: '#eceef2', borderWidth: 1, borderColor: '#d8dbe1', borderRadius: 3, alignItems: 'center', justifyContent: 'center' }]}>
                  <View style={{ width: photoW * 0.34, height: photoW * 0.34, borderRadius: photoW * 0.17, backgroundColor: '#c6cad2' }} />
                  <View style={{ width: photoW * 0.58, height: photoW * 0.3, borderTopLeftRadius: photoW * 0.29, borderTopRightRadius: photoW * 0.29, backgroundColor: '#c6cad2', marginTop: 2 }} />
                </View>
              )
            }
            if (bid === 'identity') {
              return (
                <View key={bid} style={styles.headerMain}>
                  {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
                  {b.headline ? <Text style={styles.headline}>{redact(b.headline)}</Text> : null}
                </View>
              )
            }
            return contactItems.length > 0 ? (
              <View key={bid} style={styles.contactGrid}>
                {contactItems.map((it) => (
                  <View key={it.id} style={styles.contactItem}>
                    <PdfIcon id={it.icon} color={accent} />
                    {/* R5：标签内容过长时缩小字体（P0-3：infoFontSizePt 返回值即 pt，不再套 pt()） */}
                    <Text style={[styles.contactText, { fontSize: infoFontSizePt(it.value) }]}>{it.value}</Text>
                  </View>
                ))}
              </View>
            ) : null
          })}
        </View>
        {b.profile ? <View style={styles.profile}>{renderParagraphs(richTextToPdfParagraphs(b.profile), styles, accent, styles.profileText)}</View> : null}

        {/* 自我评价（2026-08-10 P1-8：空内容隐藏整节——原空 doc 对象恒 truthy 渲染空标题+大块留白；预览端同步） */}
        {(() => {
          const paras = resume.summary?.content ? richTextToPdfParagraphs(resume.summary.content) : []
          return paras.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle title={titles.summary} styles={styles} />
              {renderParagraphs(paras, styles, accent)}
            </View>
          ) : null
        })()}

        {orderedIds.map((id) => sectionRenderers[id]?.() ?? renderCustom(id))}
      </Page>
    </Document>
  )
}
