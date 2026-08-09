/**
 * templates/shared/ResumeBody.tsx —— 简历正文泛化渲染器（F4 规格：三套模板共享）
 * 三套模板 = 薄壳（classic/modern/compact），全部 section 渲染逻辑收敛于此单点。
 * variant 差异：SecTitle 样式（underline / accent-bar / compact）+ 间距乘数 + 头部布局。
 * classic 对标 material/简历示例1.pdf（视觉细节在 variant==='classic' 分支完整保留）。
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { InfoIcon, type InfoIconId } from '../../components/icons/InfoIcons'
import avatarUrl from '../../assets/avatar.png'
import { richTextToHtml } from '../../preview/richtext-html'
import { getTemplate, type TemplateId } from '../registry'
import { lv, resolveFontFamily, type TemplatePreset } from './preset'
import type { Resume } from '@shared/schema/resume'
import { SectionBlock, Placeholder, entryHead, fmtDate, useJump } from './primitives'
import { useThrottledResume } from '../../hooks/useThrottledResume'

const CLASSIC_PHOTO = { width: 110, height: 110 }

export type TitleVariant = 'underline' | 'accent-bar' | 'compact'

const TITLE_STYLES: Record<TitleVariant, CSSProperties> = {
  // classic：全大写下划线（v2.3 线色随主题主色，对标简历示例1；原 #e8e8e8 浅灰）
  underline: {
    fontWeight: 600,
    letterSpacing: '1px',
    color: 'var(--rm-accent)',
    borderBottom: '2px solid var(--rm-accent)',
    paddingBottom: '4px',
    marginBottom: '10px',
    textTransform: 'uppercase'
  },
  // modern：左对齐 + 左侧 accent 色条（无下划线）
  'accent-bar': {
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: '#333',
    borderLeft: '4px solid var(--rm-accent, #475569)',
    paddingLeft: '8px',
    paddingBottom: '2px',
    marginBottom: '10px',
    textTransform: 'none'
  },
  // compact：小号加粗（无下划线、无装饰）
  compact: {
    fontWeight: 700,
    letterSpacing: '0.3px',
    color: '#333',
    paddingBottom: '2px',
    marginBottom: '6px',
    textTransform: 'none'
  }
}

export function ResumeBody({ variant, resume: externalResume }: { variant: TemplateId; resume?: Resume }): React.JSX.Element {
  const { t } = useTranslation()
  // P2（用户拍板 C）：resume 经 rAF 合并节流订阅——同帧多次 setField 只渲染一次。
  // 2026-08-09 统一预览：外部 resume（导入向导草稿预览）优先，否则 store 订阅（实时预览）
  const storeResume = useThrottledResume()
  const resume = externalResume ?? storeResume
  const privacyMode = useResumeStore((s) => s.privacyMode)
  const layout = resume.layout
  const jump = useJump()
  const meta = getTemplate(layout?.templateId ?? variant)
  const preset: TemplatePreset = meta.preset
  const titleVariant: TitleVariant = variant === 'classic' ? 'underline' : variant === 'modern' ? 'accent-bar' : 'compact'

  const baseFont = lv(layout, 'baseFontSize', preset)
  const lineHeight = lv(layout, 'lineHeight', preset)
  const sectionGap = lv(layout, 'sectionSpacing', preset)
  const paragraphGap = lv(layout, 'paragraphSpacing', preset)
  const headerSize = lv(layout, 'headerSize', preset)
  const pagePad = lv(layout, 'pagePadding', preset)
  const fontFor = (section: string): string | undefined => resolveFontFamily(layout, section)

  const rootStyle: CSSProperties = {
    fontSize: baseFont,
    lineHeight,
    padding: `${pagePad}px ${pagePad + (variant === 'classic' ? 24 : 20)}px`,
    ['--rm-section-gap' as string]: `${sectionGap}px`,
    ['--rm-accent' as string]: layout?.themeColor ?? '#475569'
  }

  const secTitle = (children: React.ReactNode, size: number): React.JSX.Element => (
    <h2 style={{ fontSize: `${size}px`, ...TITLE_STYLES[titleVariant] }}>{children}</h2>
  )

  const basics = resume.basics
  const photoSrc: string | null = ((): string | null => {
    const p = basics.photo
    if (typeof p !== 'string' || p.trim().length === 0) return null
    const v = p.trim()
    if (v === 'avatar' || v === '/avatar.png' || v === 'avatar.png') return avatarUrl
    return v
  })()
  const showPhoto = photoSrc !== null
  const photoW = basics.photoWidth ?? CLASSIC_PHOTO.width
  const photoH = basics.photoHeight ?? CLASSIC_PHOTO.height
  // P1 修复：外链头像加载失败时隐藏（避免裂图占位挤压布局）；本地/内嵌资源不受影响
  const [photoBroken, setPhotoBroken] = useState(false)
  useEffect(() => {
    setPhotoBroken(false) // photo 变化时重置
  }, [photoSrc])

  const contactItems = [
    basics.phone,
    basics.email,
    basics.location,
    basics.website,
    ...basics.customFields.map((c) => c.value)
  ]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    // P1 修复：与 PDF 端一致——website 与 customFields 值可能重复（示例简历两处同 URL），
    // 底部拼接显示时去重，避免"网页链接多次出现"
    .filter((v, i, arr) => arr.indexOf(v) === i)

  const pStyle: CSSProperties = { fontSize: '0.92em', lineHeight, marginBottom: paragraphGap }

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
    <div className="preview-paper-body" data-redact={privacyMode ? 'on' : 'off'} style={rootStyle}>
      {/* basics：左头像 | 中名字+职位 | 右基本信息（classic 三列；modern/compact 简化两列） */}
      <SectionBlock path="basics" onClick={() => jump('basics')} style={{ fontFamily: fontFor('basics') }} hint={t('preview.locateHint')}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {showPhoto && !photoBroken ? (
            <img
              src={photoSrc as string}
              alt=""
              width={photoW}
              height={photoH}
              className="redact-field"
              onError={() => setPhotoBroken(true)}
              style={{ width: photoW, height: photoH, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : null}
          <div style={{ minWidth: 0, paddingTop: '2px' }}>
            {basics.name ? (
              <h1 className="redact-field" style={{ fontSize: variant === 'compact' ? '24px' : '30px', fontWeight: 700, lineHeight: 1.2, marginBottom: '2px', color: '#111827' }}>{basics.name}</h1>
            ) : null}
            {basics.headline ? (
              <div className="redact-field" style={{ fontSize: variant === 'compact' ? '15px' : '18px', opacity: 0.75, lineHeight: 1.4 }}>{basics.headline}</div>
            ) : null}
          </div>
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
                <div key={it.id} className="redact-field" style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', color: 'var(--rm-accent)', flexShrink: 0 }}>
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
        {infoItems.length === 0 && contactItems.length > 0 ? (
          <div className="redact-field" style={{ fontSize: '0.82em', opacity: 0.75, marginTop: '8px' }}>{contactItems.join(' · ')}</div>
        ) : null}
      </SectionBlock>

      {/* 自我评价 */}
      <SectionBlock path="summary" onClick={() => jump('summary')} style={{ fontFamily: fontFor('summary') }} hint={t('preview.locateHint')}>
        {secTitle(t('editor.section.summary'), headerSize)}
        <div style={pStyle} dangerouslySetInnerHTML={{ __html: richTextToHtml(resume.summary?.content) }} />
      </SectionBlock>

      {/* 教育经历 */}
      <SectionBlock path="education" onClick={() => jump('education')} style={{ fontFamily: fontFor('education') }} hint={t('preview.locateHint')}>
        {secTitle(t('editor.section.education'), headerSize)}
        {resume.education.filter((e) => e.visible !== false).map((e) => (
          <div key={e.id} style={{ marginBottom: '10px' }}>
            {entryHead(e.school, [fmtDate(e.startDate), e.endDate ? fmtDate(e.endDate) : ''].filter(Boolean).join(' – '), {
              fontSize: '0.95em',
              fontWeight: 700
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
        {secTitle(t('editor.section.work'), headerSize)}
        {resume.work.filter((w) => w.visible !== false).map((w) => (
          <div key={w.id} style={{ marginBottom: '12px' }}>
            {entryHead(w.company, [fmtDate(w.startDate), w.current ? t('editor.field.current') : w.endDate ? fmtDate(w.endDate) : ''].filter(Boolean).join(' – '), {
              fontSize: '0.95em',
              fontWeight: 700
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
        {secTitle(t('editor.section.projects'), headerSize)}
        {resume.projects.filter((p) => p.visible !== false).map((p) => (
          <div key={p.id} style={{ marginBottom: '12px' }}>
            {entryHead(p.name, [fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : ''].filter(Boolean).join(' – '), {
              fontSize: '0.95em',
              fontWeight: 700
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
        {secTitle(t('editor.section.skills'), headerSize)}
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
        {secTitle(t('editor.section.certificates'), headerSize)}
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
        {secTitle(t('editor.section.languages'), headerSize)}
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
