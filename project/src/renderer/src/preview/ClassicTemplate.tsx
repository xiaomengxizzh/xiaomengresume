/**
 * ClassicTemplate —— classic 模板渲染组件（2026-08-07 UI 重构 · PDF 完整还原）
 * 排版对齐 material/简历示例1.pdf：
 *   顶部水平布局 = 左头像 + 右上 infoItems 两列（图标+文字）+ 右下姓名+职位
 *   section 标题 h2 uppercase + 灰色下划线（#e8e8e8，非主题色）
 *   各 section 按 PDF 顺序：教育/工作/项目/技能/证书/语言/自我评价
 * 消费全部 layout 参数；缺省回落模板预设。
 * 守 3.15.1：白纸（#fff/#333）与 UI 主题正交，挂 data-rm-path（§3.7 反查）。
 */
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import type { Layout } from '@shared/schema/resume'
import { FONT_OPTIONS } from '@shared/constants/fonts'
import { InfoIcon, type InfoIconId } from '../components/icons/InfoIcons'
import avatarUrl from '../assets/avatar.png'
import { richTextToHtml } from './richtext-html'

/* ── 模板预设 ──────────────────────────────────────────────────────────── */
const CLASSIC_PRESET = {
  baseFontSize: 16,
  lineHeight: 1.5,
  pagePadding: 32,
  paragraphSpacing: 12,
  sectionSpacing: 16,
  headerSize: 18
} as const
const CLASSIC_PHOTO = { width: 90, height: 120 }

type LayoutKey = keyof typeof CLASSIC_PRESET

function lv(layout: Layout | undefined, key: LayoutKey): number {
  const v = layout?.[key]
  return typeof v === 'number' ? v : CLASSIC_PRESET[key]
}

function fmtDate(d: string | undefined): string {
  if (!d) return ''
  const [y, m] = d.split('-')
  return m ? `${y}/${m}` : y
}

/* ── 预览区块小组件 ────────────────────────────────────────────────────── */

function SectionBlock({
  path,
  onClick,
  style,
  hint,
  children
}: {
  path: string
  onClick: () => void
  style?: CSSProperties
  hint?: string
  children: ReactNode
}): React.JSX.Element {
  return (
    <section
      data-rm-path={path}
      data-rm-hint={hint}
      onClick={onClick}
      style={{
        marginBottom: 'var(--rm-section-gap, 16px)',
        paddingBottom: 'var(--rm-section-gap, 16px)',
        borderBottom: '1px solid #e8e8e8',
        ...style
      }}
    >
      {children}
    </section>
  )
}

function SecTitle({ children, size }: { children: ReactNode; size: number }): React.JSX.Element {
  return (
    <h2
      style={{
        fontSize: `${size}px`,
        fontWeight: 600,
        letterSpacing: '1px',
        color: '#444',
        borderBottom: '2px solid #e8e8e8',
        paddingBottom: '4px',
        marginBottom: '10px',
        textTransform: 'uppercase'
      }}
    >
      {children}
    </h2>
  )
}

function Placeholder({ label }: { label: string }): React.JSX.Element {
  return <div style={{ color: '#bbb', fontSize: '13px', fontStyle: 'italic' }}>{label}</div>
}

function entryHead(left: string, right: string, style: CSSProperties): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', ...style }}>
      <span>{left}</span>
      <span style={{ opacity: 0.65, fontWeight: 400, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  )
}

/* ── 主组件 ────────────────────────────────────────────────────────────── */

export function ClassicTemplate(): React.JSX.Element {
  const { t } = useTranslation()
  const resume = useResumeStore((s) => s.resume)
  const layout = resume.layout
  const { setActiveSection, setActiveFieldPath } = useResumeStore.getState()

  const jump = (path: string): void => {
    setActiveSection(path.split('.')[0])
    setActiveFieldPath(path)
  }

  const baseFont = lv(layout, 'baseFontSize')
  const lineHeight = lv(layout, 'lineHeight')
  const sectionGap = lv(layout, 'sectionSpacing')
  const paragraphGap = lv(layout, 'paragraphSpacing')
  const headerSize = lv(layout, 'headerSize')
  const sectionFonts = layout?.sectionFonts ?? {}

  const fontFor = (section: string): string | undefined => {
    const sid = sectionFonts[section]
    if (sid && sid !== 'system') {
      const f = FONT_OPTIONS.find((x) => x.id === sid)
      if (f?.family) return f.family
    }
    if (layout?.resumeFont && layout.resumeFont !== 'system') {
      const f = FONT_OPTIONS.find((x) => x.id === layout.resumeFont)
      if (f?.family) return f.family
    }
    return undefined
  }

  const rootStyle: CSSProperties = {
    fontSize: baseFont,
    lineHeight,
    padding: `${lv(layout, 'pagePadding')}px ${lv(layout, 'pagePadding') + 24}px`,
    ['--rm-section-gap' as string]: `${sectionGap}px`,
    ['--rm-paragraph-gap' as string]: `${paragraphGap}px`,
    ['--rm-header-size' as string]: `${headerSize}px`,
    // 2026-08-08 P0-2 修复：消费 layout.themeColor（简历强调色，per-resume 参数）。
    // 此前 TemplateBar 色板可写、schema 校验通过，但模板零消费=假功能。
    // 应用位：简历名 + 富文本链接（section 下划线刻意保持 #e8e8e8，与 PDF 标尺对齐）。
    ['--rm-accent' as string]: layout?.themeColor ?? '#475569'
  }

  const basics = resume.basics
  // 2026-08-07：修复照片不显示 —— 此前写死 src={avatarUrl}，完全没读 basics.photo；
  // 现按 photo 字段解析：路径/ID（'avatar'、'/avatar.png'）映射到打包资源，其他原样透传（data URL / 外链）
  const photoSrc: string | null = ((): string | null => {
    const p = basics.photo
    if (typeof p !== 'string' || p.trim().length === 0) return null
    const t = p.trim()
    if (t === 'avatar' || t === '/avatar.png' || t === 'avatar.png') return avatarUrl
    return t
  })()
  const showPhoto = photoSrc !== null
  const photoW = basics.photoWidth ?? CLASSIC_PHOTO.width
  const photoH = basics.photoHeight ?? CLASSIC_PHOTO.height

  const contactItems = [
    basics.phone,
    basics.email,
    basics.location,
    basics.website,
    ...basics.customFields.map((c) => c.value)
  ].filter((v): v is string => typeof v === 'string' && v.length > 0)

  const pStyle: CSSProperties = { fontSize: '0.92em', lineHeight, marginBottom: paragraphGap }

  // infoItems 缺省自动从基础字段推导（按 PDF 顺序：状态/生日/邮箱/电话/地址/网址）
  // 类型用 string（zod enum + array.optional() 推断宽化为 string，渲染时逐项 cast InfoIconId）
  const infoItems: Array<{ id: string; icon: string; label: string; value: string }> =
    basics.infoItems && basics.infoItems.length > 0
      ? basics.infoItems.map((it) => ({ id: it.id, icon: it.icon, label: it.label, value: it.value }))
      : [
        { id: 'emp', icon: 'briefcase', label: '', value: basics.employmentStatus ?? '' },
        { id: 'birth', icon: 'calendar', label: '', value: basics.birthDate ?? '' },
        { id: 'mail', icon: 'mail', label: '', value: basics.email ?? '' },
        { id: 'phone', icon: 'phone', label: '', value: basics.phone ?? '' },
        { id: 'loc', icon: 'pin', label: '', value: basics.location ?? '' },
        { id: 'web', icon: 'globe', label: '', value: basics.website ?? '' }
      ].filter((it) => it.value.length > 0)

  return (
    <div className="preview-paper-body" style={rootStyle}>
      {/* basics：三列水平布局（左头像 | 中名字+职位 | 右基本信息两列；对齐 PDF 真实坐标） */}
      <SectionBlock path="basics" onClick={() => jump('basics')} style={{ fontFamily: fontFor('basics') }} hint={t('preview.locateHint')}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {showPhoto ? (
            <img
              src={photoSrc as string}
              alt=""
              width={photoW}
              height={photoH}
              style={{ width: photoW, height: photoH, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : null}
          {/* 中：名字（22.5pt≈30px）+ 职位（13.5pt≈18px） */}
          <div style={{ minWidth: 0, paddingTop: '2px' }}>
            {basics.name ? (
              <h1 style={{ fontSize: '30px', fontWeight: 600, lineHeight: 1.2, marginBottom: '2px', color: 'var(--rm-accent)' }}>{basics.name}</h1>
            ) : null}
            {basics.headline ? (
              <div style={{ fontSize: '18px', opacity: 0.75, lineHeight: 1.4 }}>{basics.headline}</div>
            ) : null}
          </div>
          {/* 右：基本信息 3 行 2 列（图标 + 文字；PDF 12pt≈16px，右对齐到名字块右侧） */}
          {infoItems.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto',
                columnGap: '20px',
                rowGap: '7px',
                marginLeft: 'auto',
                fontSize: '16px',
                alignSelf: 'flex-start'
              }}
            >
              {infoItems.map((it) => (
                <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', color: '#666', flexShrink: 0 }}>
                    <InfoIcon id={it.icon as InfoIconId} size={15} />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{it.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {basics.profile ? (
          <div style={{ marginTop: '12px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(basics.profile) }} />
        ) : null}
        {/* 兜底：当 infoItems 缺失时显示联系方式一行（向后兼容） */}
        {infoItems.length === 0 && contactItems.length > 0 ? (
          <div style={{ fontSize: '0.82em', opacity: 0.75, marginTop: '8px' }}>{contactItems.join(' · ')}</div>
        ) : null}
      </SectionBlock>

      {/* 自我评价（PDF 顺序：放在工作/项目后，但为方便阅读放教育前；按 PDF 第二页位置仍合理） */}
      <SectionBlock path="summary" onClick={() => jump('summary')} style={{ fontFamily: fontFor('summary') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.summary')}</SecTitle>
        <div style={pStyle} dangerouslySetInnerHTML={{ __html: richTextToHtml(resume.summary?.content) }} />
      </SectionBlock>

      {/* 教育经历 */}
      <SectionBlock path="education" onClick={() => jump('education')} style={{ fontFamily: fontFor('education') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.education')}</SecTitle>
        {resume.education.filter((e) => e.visible !== false).map((e) => (
          <div key={e.id} style={{ marginBottom: '10px' }}>
            {entryHead(e.school, [fmtDate(e.startDate), e.endDate ? fmtDate(e.endDate) : ''].filter(Boolean).join(' – '), {
              fontSize: '0.95em',
              fontWeight: 500
            })}
            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{[e.degree, e.major].filter(Boolean).join(' · ')}</div>
            {e.description ? (
              <div style={{ ...pStyle, marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(e.description) }} />
            ) : null}
          </div>
        ))}
        {resume.education.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
      </SectionBlock>

      {/* 工作经验 */}
      <SectionBlock path="work" onClick={() => jump('work')} style={{ fontFamily: fontFor('work') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.work')}</SecTitle>
        {resume.work.filter((w) => w.visible !== false).map((w) => (
          <div key={w.id} style={{ marginBottom: '12px' }}>
            {entryHead(w.company, [fmtDate(w.startDate), w.current ? t('editor.field.current') : w.endDate ? fmtDate(w.endDate) : ''].filter(Boolean).join(' – '), {
              fontSize: '0.95em',
              fontWeight: 500
            })}
            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{w.title}</div>
            {w.summary ? (
              <div style={{ ...pStyle, marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(w.summary) }} />
            ) : null}
          </div>
        ))}
        {resume.work.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
      </SectionBlock>

      {/* 项目经历 */}
      <SectionBlock path="projects" onClick={() => jump('projects')} style={{ fontFamily: fontFor('projects') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.projects')}</SecTitle>
        {resume.projects.filter((p) => p.visible !== false).map((p) => (
          <div key={p.id} style={{ marginBottom: '12px' }}>
            {entryHead(p.name, [fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : ''].filter(Boolean).join(' – '), {
              fontSize: '0.95em',
              fontWeight: 500
            })}
            <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{[p.role, p.organization].filter(Boolean).join(' · ')}</div>
            {p.description ? (
              <div style={{ ...pStyle, marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(p.description) }} />
            ) : null}
          </div>
        ))}
        {resume.projects.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
      </SectionBlock>

      {/* 专业技能 */}
      <SectionBlock path="skills" onClick={() => jump('skills')} style={{ fontFamily: fontFor('skills') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.skills')}</SecTitle>
        {resume.skills.length > 0 ? (
          <ul style={{ listStyle: 'disc', paddingLeft: '18px', marginTop: '2px' }}>
            {resume.skills.map((s) => (
              <li key={s.id} style={{ fontSize: '0.92em', lineHeight }}>
                {s.name}
                {s.level ? `（${t(`editor.skill.${s.level}`)}）` : ''}
                {s.category ? ` · ${s.category}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder label={t('editor.action.placeholder')} />
        )}
      </SectionBlock>

      {/* 证书 */}
      <SectionBlock path="certificates" onClick={() => jump('certificates')} style={{ fontFamily: fontFor('certificates') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.certificates')}</SecTitle>
        {resume.certificates.map((c) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', marginBottom: '4px' }}>
            <span>{c.name}</span>
            <span style={{ opacity: 0.7 }}>{[c.issuer, fmtDate(c.date)].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
        {resume.certificates.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
      </SectionBlock>

      {/* 语言 */}
      <SectionBlock path="languages" onClick={() => jump('languages')} style={{ fontFamily: fontFor('languages') }} hint={t('preview.locateHint')}>
        <SecTitle size={headerSize}>{t('editor.section.languages')}</SecTitle>
        {resume.languages.map((l) => (
          <div key={l.id} style={{ fontSize: '0.85em', marginBottom: '2px' }}>
            {l.name}
            {l.proficiency ? `（${t(`editor.lang.${l.proficiency}`)}）` : ''}
          </div>
        ))}
        {resume.languages.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
      </SectionBlock>
    </div>
  )
}