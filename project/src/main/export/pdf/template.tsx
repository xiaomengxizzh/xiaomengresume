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
import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer'
import type { Resume, Layout } from '@shared/schema/resume'
import type { Language } from '@shared/schema/settings'
import type { Style } from '@react-pdf/types'
import type { PdfParagraph } from './richtext'
import { richTextToPdfParagraphs } from './richtext'
import { fmtDate } from './dates'

/** 排版预设键（与 renderer/src/templates/shared/preset.ts PresetKey 对齐） */
type PresetKey = 'baseFontSize' | 'lineHeight' | 'pagePadding' | 'paragraphSpacing' | 'sectionSpacing' | 'headerSize'
interface TemplatePreset {
  baseFontSize: number
  lineHeight: number
  pagePadding: number
  paragraphSpacing: number
  sectionSpacing: number
  headerSize: number
}

/** 三套模板预设（1:1 复制 renderer/src/templates/registry.ts PRESETS，变更须同步） */
const PRESETS: Record<string, TemplatePreset> = {
  classic: { baseFontSize: 16, lineHeight: 1.5, pagePadding: 32, paragraphSpacing: 12, sectionSpacing: 16, headerSize: 18 },
  modern: { baseFontSize: 16, lineHeight: 1.6, pagePadding: 36, paragraphSpacing: 14, sectionSpacing: 20, headerSize: 17 },
  compact: { baseFontSize: 15, lineHeight: 1.4, pagePadding: 26, paragraphSpacing: 10, sectionSpacing: 12, headerSize: 15 }
}

/** layout 覆盖链取值（同 renderer preset.ts lv()：layout > 模板预设） */
function lv(layout: Layout | undefined, key: PresetKey, preset: TemplatePreset): number {
  const v = layout?.[key]
  return typeof v === 'number' ? v : preset[key]
}

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
  const sectionTitleBase: Style = {
    fontSize: pt(headerSize),
    fontWeight: 600,
    color: '#444'
  }
  const sectionTitle: Style =
    variant === 'accent-bar'
      ? { ...sectionTitleBase, letterSpacing: 0.5, color: '#333', borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: 'solid', paddingLeft: 6, paddingBottom: 1.5, marginBottom: pt(10), textTransform: 'none' }
      : variant === 'compact'
        ? { ...sectionTitleBase, fontWeight: 700, letterSpacing: 0.3, color: '#333', paddingBottom: 1.5, marginBottom: pt(6), textTransform: 'none' }
        : { ...sectionTitleBase, letterSpacing: 1, borderBottomWidth: 2, borderBottomColor: '#e8e8e8', borderBottomStyle: 'solid', paddingBottom: pt(4), marginBottom: pt(10), textTransform: 'uppercase' }

  return StyleSheet.create({
    page: {
      paddingTop: pt(pagePadding),
      paddingBottom: pt(pagePadding),
      paddingHorizontal: pt(pagePadding + (variant === 'compact' ? 20 : 24)),
      fontSize: pt(baseFontSize),
      lineHeight,
      color: '#333',
      fontFamily: 'zh'
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
      borderRadius: 3,
      objectFit: 'cover',
      flexShrink: 0,
      marginRight: pt(24)
    },
    name: {
      fontSize: pt(30), // ResumeBody classic name 30px
      fontWeight: 600,
      color: accent,
      lineHeight: 1.2,
      marginBottom: pt(2)
    },
    headline: {
      fontSize: pt(18), // ResumeBody classic headline 18px
      color: '#666',
      opacity: 0.75,
      lineHeight: 1.4
    },
    contactGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      flexGrow: 1,
      justifyContent: 'flex-end',
      rowGap: pt(7),
      columnGap: pt(20)
    },
    contactItem: {
      fontSize: pt(12), // 略小于 web 的 16（PDF 渲染密度高；视觉对齐）
      color: '#444',
      width: '44%' // P1 修复：2 列规整换行（对齐预览端 grid auto auto 两列）
    },
    profile: {
      marginTop: pt(12)
    },
    // section 容器
    section: {
      marginTop: pt(sectionSpacing),
      marginBottom: pt(4)
    },
    sectionTitle: sectionTitle,
    // 条目容器（marginBottom 10px ResumeBody L186）
    entry: {
      marginBottom: pt(10)
    },
    // 条目头（ResumeBody entryHead：左标题右日期）
    entryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline'
    },
    entryTitle: {
      fontSize: pt(15.2), // 0.95em × 16 ≈ 15.2
      fontWeight: 500,
      color: '#222'
    },
    entryDate: {
      fontSize: pt(13), // 略小于 web 的 0.95em（PDF 渲染密度高）
      color: '#666'
    },
    entrySub: {
      fontSize: pt(13.6), // 0.85em × 16
      color: '#666',
      opacity: 0.8,
      marginTop: pt(1)
    },
    // 描述段落（ResumeBody pStyle：fontSize 0.92em lineHeight 1.5 marginBottom 12px）
    desc: {
      fontSize: pt(14.7), // 0.92em × 16
      lineHeight,
      marginBottom: pt(paragraphSpacing)
    },
    skillItem: {
      fontSize: pt(14.7),
      marginBottom: pt(2)
    },
    certRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: pt(4)
    },
    certName: {
      fontSize: pt(14.7)
    },
    certDate: {
      fontSize: pt(13),
      color: '#666'
    },
    langItem: {
      fontSize: pt(14.7),
      marginBottom: pt(2)
    },
    flex1: {
      flex: 1
    }
  })
}

type PdfStyles = ReturnType<typeof makeStyles>

/** 段落 → 文本节点列表（bold/italic/strike/link 用嵌套 Text 内联样式；P2：补 italic/strike/link） */
const renderParagraphs = (paragraphs: PdfParagraph[], styles: PdfStyles): React.JSX.Element[] =>
  paragraphs.map((p, i) => {
    const prefix = p.list === 'bullet' ? '• ' : p.list === 'ordered' ? `${p.order}. ` : ''
    return (
      <Text key={i} style={styles.desc}>
        {prefix}
        {p.runs.map((r, j) => {
          const extra: Style = {}
          if (r.bold) extra.fontWeight = 'bold'
          if (r.italic) extra.fontStyle = 'italic'
          if (r.strike) extra.textDecoration = 'line-through'
          if (r.link) {
            extra.color = '#475569'
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

export interface ResumePdfProps {
  resume: Resume
  language: Language
  privacyMode: boolean
  /** 头像 data URL / https 外链（build.ts 已把 'avatar' 标记解析为 data URL，见 build.ts resolvePdfPhotoSrc） */
  photoSrc?: string | null
}

export function ResumePdfDocument({ resume, language, privacyMode, photoSrc }: ResumePdfProps): React.JSX.Element {
  const b = resume.basics
  const titles = SECTION_TITLES[language] ?? SECTION_TITLES['zh-CN']
  const redact = (v: string | undefined): string => redactValue(v, privacyMode)

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

  // 头像（ResumeBody：photoWidth/photoHeight，缺省 90×120；px → pt 换算）
  const photoW = ((b.photoWidth ?? 90) * 0.75) || 0
  const photoH = ((b.photoHeight ?? 120) * 0.75) || 0

  // 联系信息两列（对齐预览 ResumeBody infoItems 区 + material/简历示例1.pdf 参考：
  // 右侧 3 行 × 2 列 = [离职,生日] / [邮箱,电话] / [地址,网址]）
  // P1 修复：fallback 字段集与顺序对齐预览（原只有 phone/email/location/website 4 项且顺序错乱，
  // 缺 employmentStatus/birthDate → 导出比预览少字段）；去重基于原始值（红码后全是 ████
  // 对打码值去重会误删占位条目）。customFields 不进头部区（预览 infoItems 区亦不含，防两处不一致）。
  const contactItems = (
    b.infoItems && b.infoItems.length > 0
      ? b.infoItems.map((it) => ({ id: it.id, value: it.value }))
      : [
          { id: 'emp', value: b.employmentStatus },
          { id: 'birth', value: b.birthDate },
          { id: 'mail', value: b.email },
          { id: 'phone', value: b.phone },
          { id: 'loc', value: b.location },
          { id: 'web', value: b.website }
        ]
  )
    .filter((it) => it.value && it.value.trim().length > 0)
    .filter((it, i, arr) => arr.findIndex((x) => x.value === it.value) === i)
    .map((it) => ({ id: it.id, value: redact(it.value) }))
    .filter((it) => it.value.length > 0)

  return (
    <Document title={displayName || 'Resume'} producer={DOC_PRODUCER} creator={DOC_PRODUCER}>
      <Page size="A4" style={styles.page}>
        {/* 头部：左头像+名字+职位 | 右联系信息两列（ResumeBody L120-172） */}
        <View style={styles.header}>
          {photoSrc ? <Image src={photoSrc} style={[styles.photo, { width: photoW, height: photoH }]} /> : null}
          <View style={styles.headerMain}>
            {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
            {b.headline ? <Text style={styles.headline}>{redact(b.headline)}</Text> : null}
          </View>
          {contactItems.length > 0 ? (
            <View style={styles.contactGrid}>
              {contactItems.map((it) => (
                <Text key={it.id} style={styles.contactItem}>{it.value}</Text>
              ))}
            </View>
          ) : null}
        </View>
        {b.profile ? <View style={styles.profile}>{renderParagraphs(richTextToPdfParagraphs(b.profile), styles)}</View> : null}

        {/* 自我评价 */}
        {resume.summary?.content ? (
          <View style={styles.section}>
            <SectionTitle title={titles.summary} styles={styles} />
            {renderParagraphs(richTextToPdfParagraphs(resume.summary.content), styles)}
          </View>
        ) : null}

        {/* 教育经历 */}
        {resume.education.filter((e) => e.visible !== false).length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.education} styles={styles} />
            {resume.education
              .filter((e) => e.visible !== false)
              .map((e) => (
                <View key={e.id} style={styles.entry}>
                  <EntryHead left={e.school || ''} right={[fmtDate(e.startDate), e.endDate ? fmtDate(e.endDate) : ''].filter(Boolean).join(' – ')} styles={styles} />
                  {e.degree || e.major ? <EntrySub styles={styles}>{[e.degree, e.major].filter(Boolean).join(' · ')}</EntrySub> : null}
                  {e.description ? renderParagraphs(richTextToPdfParagraphs(e.description), styles) : null}
                </View>
              ))}
          </View>
        ) : null}

        {/* 工作经历 */}
        {resume.work.filter((w) => w.visible !== false).length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.work} styles={styles} />
            {resume.work
              .filter((w) => w.visible !== false)
              .map((w) => (
                <View key={w.id} style={styles.entry}>
                  <EntryHead
                    left={w.company || ''}
                    right={[fmtDate(w.startDate), w.current ? (language === 'zh-CN' ? '至今' : 'Present') : w.endDate ? fmtDate(w.endDate) : ''].filter(Boolean).join(' – ')}
                    styles={styles}
                  />
                  {w.title ? <EntrySub styles={styles}>{w.title}</EntrySub> : null}
                  {w.summary ? renderParagraphs(richTextToPdfParagraphs(w.summary), styles) : null}
                </View>
              ))}
          </View>
        ) : null}

        {/* 项目经历 */}
        {resume.projects.filter((p) => p.visible !== false).length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.projects} styles={styles} />
            {resume.projects
              .filter((p) => p.visible !== false)
              .map((p) => (
                <View key={p.id} style={styles.entry}>
                  <EntryHead left={p.name || ''} right={[fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : ''].filter(Boolean).join(' – ')} styles={styles} />
                  {p.role || p.organization ? <EntrySub styles={styles}>{[p.role, p.organization].filter(Boolean).join(' · ')}</EntrySub> : null}
                  {p.description ? renderParagraphs(richTextToPdfParagraphs(p.description), styles) : null}
                </View>
              ))}
          </View>
        ) : null}

        {/* 专业技能 */}
        {resume.skills.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.skills} styles={styles} />
            {resume.skills.map((s) => (
              <Text key={s.id} style={styles.skillItem}>
                • {s.name}
                {s.level ? `（${s.level}）` : ''}
                {s.category ? ` · ${s.category}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        {/* 证书 */}
        {resume.certificates.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.certificates} styles={styles} />
            {resume.certificates.map((c) => (
              <View key={c.id} style={styles.certRow}>
                <Text style={[styles.certName, styles.flex1]}>{c.name}</Text>
                <Text style={styles.certDate}>{[c.issuer, fmtDate(c.date)].filter(Boolean).join(' · ')}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* 语言 */}
        {resume.languages.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.languages} styles={styles} />
            {resume.languages.map((l) => (
              <Text key={l.id} style={styles.langItem}>
                {l.name}
                {l.proficiency ? `（${l.proficiency}）` : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}
