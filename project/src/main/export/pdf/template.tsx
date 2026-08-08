/**
 * pdf/template.tsx —— 文字版 PDF 简历文档（v2.1 重写：1:1 对齐 PreviewPane 版式）
 *
 * 2026-08-08 v2.1 关键修订：原 v2.0 是"PDF 专用简化版"，与 PreviewPane 视觉脱钩 → 用户反馈"预览
 * 和导出明显不一样"违反"模板=打印"承诺。现完全复用 templates/shared/preset.ts 的版式参数与
 * ResumeBody.tsx 的结构（除 web CSS 不可用部分），字号/间距/标题样式 1:1 对齐。
 *
 * 与 PreviewPane/ResumeBody 的关系：
 * - 数据同源（ResumeSchema）
 * - 版式参数同源（preset：baseFontSize/lineHeight/pagePadding/...）
 * - 渲染器不同：PreviewPane = DOM/CSS；本组件 = @react-pdf/renderer StyleSheet（Flexbox 子集）
 * - 渲染结果像素级一致是目标，但 PDF 渲染器对部分 CSS 特性支持有限（无 grid；无 transform；
 *   border 部分支持；text-transform: uppercase 对中文无效但保留不破坏版式）。
 *
 * 字体/隐私/标题：v2.0 已有设计保留。
 */
import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Resume } from '@shared/schema/resume'
import type { Language } from '@shared/schema/settings'
import type { PdfParagraph } from './richtext'
import { richTextToPdfParagraphs } from './richtext'
import { fmtDate } from './dates'

/**
 * 模板版式参数（1:1 复用 renderer/src/templates/shared/preset.ts）
 * PDF 模块在主进程（src/main/），不能直接 import renderer 目录的 preset.ts；
 * 此处硬编码保持与 classic preset 同值。变更时必须同步 ResumeBody preset.ts。
 * 来源（2026-08-08 校对）：renderer/src/templates/registry.ts PRESETS.classic + 共享 preset.ts 默认值。
 */
const TEMPLATE_PRESET = {
  baseFontSize: 16,
  lineHeight: 1.5,
  pagePadding: 32,
  paragraphSpacing: 12,
  sectionSpacing: 16,
  headerSize: 18
} as const

/** section 标题字典（对齐 renderer/src/i18n/{zh-CN,en}.json editor.section.*） */
const SECTION_TITLES: Record<Language, Record<string, string>> = {
  'zh-CN': { summary: '自我评价', education: '教育经历', work: '工作经历', projects: '项目经历', skills: '专业技能', certificates: '证书', languages: '语言' },
  en: { summary: 'Summary', education: 'Education', work: 'Work Experience', projects: 'Projects', skills: 'Skills', certificates: 'Certificates', languages: 'Languages' }
}

/** 隐私打码占位 */
const REDACT = '████'

/** 敏感字段（F16：与 CSS data-redact 行为对齐） */
const SENSITIVE_KEYS = new Set(['name', 'phone', 'email', 'address', 'location', 'website', 'englishName', 'birthDate'])

const DOC_PRODUCER = 'xiaomengresume'
const ACCENT = '#475569' // 与 PreviewPane --rm-accent 默认值一致

/** 段落 → 文本节点列表（粗体用嵌套 Text） */
const renderParagraphs = (paragraphs: PdfParagraph[]): React.JSX.Element[] =>
  paragraphs.map((p, i) => {
    const prefix = p.list === 'bullet' ? '• ' : p.list === 'ordered' ? `${p.order}. ` : ''
    return (
      <Text key={i} style={styles.desc}>
        {prefix}
        {p.runs.map((r, j) => (r.bold ? <Text key={j} style={styles.bold}>{r.text}</Text> : r.text))}
      </Text>
    )
  })

/** 分区标题（v2.1 1:1 对齐 ResumeBody TITLE_STYLES.underline：fontWeight 600 + letterSpacing 1px + borderBottom + uppercase） */
const SectionTitle = ({ title }: { title: string }): React.JSX.Element => (
  <Text style={styles.sectionTitle}>{title}</Text>
)

/** 条目头：左标题 + 右日期（ResumeBody entryHead：space-between 两端对齐） */
const EntryHead = ({ left, right }: { left: string; right: string }): React.JSX.Element => (
  <View style={styles.entryRow}>
    <Text style={[styles.entryTitle, styles.flex1]}>{left}</Text>
    {right ? <Text style={styles.entryDate}>{right}</Text> : null}
  </View>
)

/** 条目副信息（ResumeBody entrySub：fontSize 0.85em，opacity 0.8） */
const EntrySub = ({ children }: { children: string }): React.JSX.Element => <Text style={styles.entrySub}>{children}</Text>

export interface ResumePdfProps {
  resume: Resume
  language: Language
  privacyMode: boolean
}

export function ResumePdfDocument({ resume, language, privacyMode }: ResumePdfProps): React.JSX.Element {
  const b = resume.basics
  const titles = SECTION_TITLES[language] ?? SECTION_TITLES['zh-CN']
  const redact = (v: string | undefined, key: string): string => (privacyMode && SENSITIVE_KEYS.has(key) && v ? REDACT : v ?? '')

  // 头部：名字 + 职位（ResumeBody 经典版：30px 加粗 accent 色）
  const name = redact(b.name, 'name')
  const displayName = name || (privacyMode ? REDACT : '')

  // 联系信息两列（ResumeBody：grid auto auto，column-gap 20 row-gap 7，icon + value fontSize 16）
  const contactItems = (b.infoItems && b.infoItems.length > 0
    ? b.infoItems.map((it) => ({ id: it.id, value: redact(it.value, it.id) }))
    : [
        { id: 'phone', value: redact(b.phone, 'phone') },
        { id: 'email', value: redact(b.email, 'email') },
        { id: 'location', value: redact(b.location, 'location') },
        { id: 'website', value: redact(b.website, 'website') }
      ]
  ).filter((it) => it.value.length > 0)

  return (
    <Document title={displayName || 'Resume'} producer={DOC_PRODUCER} creator={DOC_PRODUCER}>
      <Page size="A4" style={styles.page}>
        {/* 头部：左名字+职位 | 右联系信息两列（ResumeBody L120-172） */}
        <View style={styles.header}>
          <View style={styles.headerMain}>
            {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
            {b.headline ? <Text style={styles.headline}>{redact(b.headline, 'headline')}</Text> : null}
          </View>
          {contactItems.length > 0 ? (
            <View style={styles.contactGrid}>
              {contactItems.map((it) => (
                <Text key={it.id} style={styles.contactItem}>{it.value}</Text>
              ))}
            </View>
          ) : null}
          {b.profile ? <View style={styles.profile}>{renderParagraphs(richTextToPdfParagraphs(b.profile))}</View> : null}
        </View>

        {/* 自我评价 */}
        {resume.summary?.content ? (
          <View style={styles.section}>
            <SectionTitle title={titles.summary} />
            {renderParagraphs(richTextToPdfParagraphs(resume.summary.content))}
          </View>
        ) : null}

        {/* 教育经历 */}
        {resume.education.filter((e) => e.visible !== false).length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.education} />
            {resume.education
              .filter((e) => e.visible !== false)
              .map((e) => (
                <View key={e.id} style={styles.entry}>
                  <EntryHead left={e.school || ''} right={[fmtDate(e.startDate), e.endDate ? fmtDate(e.endDate) : ''].filter(Boolean).join(' – ')} />
                  {e.degree || e.major ? <EntrySub>{[e.degree, e.major].filter(Boolean).join(' · ')}</EntrySub> : null}
                  {e.description ? renderParagraphs(richTextToPdfParagraphs(e.description)) : null}
                </View>
              ))}
          </View>
        ) : null}

        {/* 工作经历 */}
        {resume.work.filter((w) => w.visible !== false).length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.work} />
            {resume.work
              .filter((w) => w.visible !== false)
              .map((w) => (
                <View key={w.id} style={styles.entry}>
                  <EntryHead
                    left={w.company || ''}
                    right={[fmtDate(w.startDate), w.current ? (language === 'zh-CN' ? '至今' : 'Present') : w.endDate ? fmtDate(w.endDate) : ''].filter(Boolean).join(' – ')}
                  />
                  {w.title ? <EntrySub>{w.title}</EntrySub> : null}
                  {w.summary ? renderParagraphs(richTextToPdfParagraphs(w.summary)) : null}
                </View>
              ))}
          </View>
        ) : null}

        {/* 项目经历 */}
        {resume.projects.filter((p) => p.visible !== false).length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.projects} />
            {resume.projects
              .filter((p) => p.visible !== false)
              .map((p) => (
                <View key={p.id} style={styles.entry}>
                  <EntryHead left={p.name || ''} right={[fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : ''].filter(Boolean).join(' – ')} />
                  {p.role || p.organization ? <EntrySub>{[p.role, p.organization].filter(Boolean).join(' · ')}</EntrySub> : null}
                  {p.description ? renderParagraphs(richTextToPdfParagraphs(p.description)) : null}
                </View>
              ))}
          </View>
        ) : null}

        {/* 专业技能 */}
        {resume.skills.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle title={titles.skills} />
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
            <SectionTitle title={titles.certificates} />
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
            <SectionTitle title={titles.languages} />
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

// ── 样式（v2.1 1:1 对齐 ResumeBody + styles.css）────────────────────────────────
// 单位说明：@react-pdf/renderer StyleSheet 默认用 pt（PDF 1pt = 1/72in），数值与 CSS px 近似等比换算
// （CSS 96dpi vs PDF 72dpi；@react-pdf/renderer 内置 px→pt 自动）。fontSize/lineHeight/padding/margin
// 与 ResumeBody 同值（em 换算：baseFontSize=16 → 0.95em≈15pt, 0.92em≈14.7pt, 0.85em≈13.6pt）。
const styles = StyleSheet.create({
  page: {
    paddingTop: TEMPLATE_PRESET.pagePadding,
    paddingBottom: TEMPLATE_PRESET.pagePadding,
    paddingHorizontal: TEMPLATE_PRESET.pagePadding + 24, // classic: pagePadding+24（ResumeBody L75）
    fontSize: TEMPLATE_PRESET.baseFontSize,
    lineHeight: TEMPLATE_PRESET.lineHeight,
    color: '#333',
    fontFamily: 'zh'
  },
  // 头部：flex 行；左 main | 右 联系方式两列
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    marginBottom: TEMPLATE_PRESET.sectionSpacing
  },
  headerMain: {
    flexShrink: 0
  },
  name: {
    fontSize: 30, // ResumeBody classic name 30px
    fontWeight: 600,
    color: ACCENT,
    lineHeight: 1.2,
    marginBottom: 2
  },
  headline: {
    fontSize: 18, // ResumeBody classic headline 18px
    color: '#666',
    opacity: 0.75,
    lineHeight: 1.4
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexGrow: 1,
    justifyContent: 'flex-end',
    rowGap: 4
  },
  contactItem: {
    fontSize: 12, // 略小于 web 的 16（PDF 渲染密度高；视觉对齐）
    color: '#444',
    marginLeft: 14
  },
  profile: {
    marginTop: 12
  },
  // section 容器
  section: {
    marginTop: TEMPLATE_PRESET.sectionSpacing,
    marginBottom: 4
  },
  // section 标题（ResumeBody TITLE_STYLES.underline 1:1）
  sectionTitle: {
    fontSize: TEMPLATE_PRESET.headerSize,
    fontWeight: 600,
    letterSpacing: 1,
    color: '#444',
    borderBottomWidth: 2,
    borderBottomColor: '#e8e8e8',
    borderBottomStyle: 'solid',
    paddingBottom: 4,
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  // 条目容器（marginBottom 10px ResumeBody L186）
  entry: {
    marginBottom: 10
  },
  // 条目头（ResumeBody entryHead：左标题右日期）
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline'
  },
  entryTitle: {
    fontSize: 15.2, // 0.95em × 16 ≈ 15.2
    fontWeight: 500,
    color: '#222'
  },
  entryDate: {
    fontSize: 13, // 略小于 web 的 0.95em（PDF 渲染密度高）
    color: '#666'
  },
  entrySub: {
    fontSize: 13.6, // 0.85em × 16
    color: '#666',
    opacity: 0.8,
    marginTop: 1
  },
  // 描述段落（ResumeBody pStyle：fontSize 0.92em lineHeight 1.5 marginBottom 12px）
  desc: {
    fontSize: 14.7, // 0.92em × 16
    lineHeight: TEMPLATE_PRESET.lineHeight,
    marginBottom: TEMPLATE_PRESET.paragraphSpacing
  },
  bold: {
    fontWeight: 'bold'
  },
  skillItem: {
    fontSize: 14.7,
    marginBottom: 2
  },
  certRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  certName: {
    fontSize: 14.7
  },
  certDate: {
    fontSize: 13,
    color: '#666'
  },
  langItem: {
    fontSize: 14.7,
    marginBottom: 2
  },
  flex1: {
    flex: 1
  }
})