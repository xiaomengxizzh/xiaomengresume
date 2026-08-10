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
// 2026-08-10 架构收敛批：排版逻辑值单一事实源（与 PDF 端同源引用）
import { contactFontSize, titleStyleLogic, TYPE_SCALE, LIST_MARK_LOGIC, CONTACT_GRID_LOGIC, entrySpacingLogic, type TitleVariant } from '@shared/templates/layout'

const CLASSIC_PHOTO = { width: 110, height: 110 }

/**
 * 2026-08-10：节标题样式收敛自 shared titleStyleLogic（逻辑值 → CSSProperties 适配；
 * accent 色经 CSS 变量 --rm-accent 由 rootStyle 注入，与 PDF 端 accent 直值同源）。
 */
function titleCss(logic: ReturnType<typeof titleStyleLogic>): CSSProperties {
  return {
    fontWeight: logic.fontWeight,
    letterSpacing: `${logic.letterSpacing}px`,
    color: logic.color === 'accent' ? 'var(--rm-accent)' : '#333',
    textTransform: logic.textTransform,
    paddingBottom: `${logic.paddingBottom}px`,
    marginBottom: `${logic.marginBottom}px`,
    ...(logic.borderBottom ? { borderBottom: `${logic.borderBottom.width}px solid var(--rm-accent)` } : {}),
    ...(logic.borderLeft ? { borderLeft: `${logic.borderLeft.width}px solid var(--rm-accent)`, paddingLeft: `${logic.borderLeft.paddingLeft}px` } : {})
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
    ['--rm-accent' as string]: layout?.themeColor ?? '#475569',
    // 2026-08-10：预览简历纸显式使用 system 字体栈（DengXian 优先，与 PDF 端 system→Deng 对齐），
    // 不再继承 body 的 UI 字体（微软雅黑）——消除两端默认字体不一致（P0-1）
    fontFamily: fontFor('basics') ?? "'DengXian', 'Microsoft YaHei', 'SimHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif"
  }

  // 2026-08-10：节标题样式 = shared titleStyleLogic 适配（TITLE_STYLES 已收敛，不再本地定义）
  const secTitle = (children: React.ReactNode, size: number): React.JSX.Element => (
    <h2 style={{ fontSize: `${size}px`, ...titleCss(titleStyleLogic(titleVariant)) }}>{children}</h2>
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
  // 2026-08-09 T2：渲染尺寸兜底 clamp（导入已等比缩放，此处防任何异常大图占满 A4；上限宽 180/高 240）
  const photoW = Math.min(basics.photoWidth ?? CLASSIC_PHOTO.width, 180)
  const photoH = Math.min(basics.photoHeight ?? CLASSIC_PHOTO.height, 240)
  // P1 修复：外链头像加载失败时隐藏（避免裂图占位挤压布局）；本地/内嵌资源不受影响
  const [photoBroken, setPhotoBroken] = useState(false)
  useEffect(() => {
    setPhotoBroken(false) // photo 变化时重置
  }, [photoSrc])

  // R6：基本信息三透明模块排序（编辑区 basicsOrder 驱动预览/PDF 头部三块排列；缺省经典顺序）
  const basicsOrder = (resume.layout?.basicsOrder?.length ? resume.layout.basicsOrder : ['photo', 'identity', 'tags']) as Array<'photo' | 'identity' | 'tags'>

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

  const pStyle: CSSProperties = { fontSize: `${TYPE_SCALE.descEm}em`, lineHeight, marginBottom: paragraphGap }

  // 2026-08-09 T2：标签（customFields，含 icon）并入 infoItems 网格——预览同步显示用户标签内容；
  // 均空时回退旧固定字段 6 项（兼容导入数据）
  let infoItems: Array<{ id: string; icon: string; label: string; value: string }> = [
    ...(basics.infoItems ?? []).map((it) => ({ id: it.id, icon: it.icon, label: it.label, value: it.value })),
    ...(basics.customFields ?? [])
      .filter((cf) => cf.value)
      .map((cf) => ({ id: cf.id, icon: cf.icon || 'pin', label: cf.label, value: cf.value }))
  ]
  if (infoItems.length === 0) {
    infoItems = [
      { id: 'emp', icon: 'briefcase', label: '', value: basics.employmentStatus ?? '' },
      { id: 'birth', icon: 'calendar', label: '', value: basics.birthDate ?? '' },
      { id: 'mail', icon: 'mail', label: '', value: basics.email ?? '' },
      { id: 'phone', icon: 'phone', label: '', value: basics.phone ?? '' },
      { id: 'loc', icon: 'pin', label: '', value: basics.location ?? '' },
      { id: 'web', icon: 'globe', label: '', value: basics.website ?? '' }
    ].filter((it) => it.value.length > 0)
  }

  const DEFAULT_SECTION_ORDER = ['education', 'work', 'projects', 'skills', 'certificates', 'languages']
  const orderedIds = resume.layout?.sectionOrder?.length
    ? resume.layout.sectionOrder.filter((id) => id !== 'basics' && id !== 'summary')
    : DEFAULT_SECTION_ORDER
  const renderCustom = (id: string): React.JSX.Element | null => {
    const cs = resume.customSections?.find((c) => c.id === id)
    if (!cs) return null
    return (
      <SectionBlock path={cs.id} onClick={() => jump(cs.id)} style={{ fontFamily: fontFor(cs.id) }} hint={t('preview.locateHint')}>
        {secTitle(cs.title || t('editor.section.custom'), headerSize)}
        {cs.content ? <div style={pStyle} dangerouslySetInnerHTML={{ __html: richTextToHtml(cs.content) }} /> : null}
      </SectionBlock>
    )
  }
  const sectionRenderers: Record<string, () => React.JSX.Element> = {
    education: () => (
      <>
        {/* 教育经历 */}
        <SectionBlock path="education" onClick={() => jump('education')} style={{ fontFamily: fontFor('education') }} hint={t('preview.locateHint')}>
          {secTitle(t('editor.section.education'), headerSize)}
          {resume.education.filter((e) => e.visible !== false).map((e) => (
            <div key={e.id} style={{ marginBottom: `${entrySpacingLogic('education')}px` }}>
              {entryHead(e.school, [fmtDate(e.startDate), e.endDate ? fmtDate(e.endDate) : ''].filter(Boolean).join(' – '), {
                fontSize: `${TYPE_SCALE.entryHeadEm}em`,
                fontWeight: 700
              })}
              <div style={{ fontSize: `${TYPE_SCALE.entrySubEm}em`, opacity: 0.8 }}>{[e.degree, e.major].filter(Boolean).join(' · ')}</div>
              {e.description ? (
                <div style={{ ...pStyle, marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(e.description) }} />
              ) : null}
            </div>
          ))}
          {resume.education.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
        </SectionBlock>
      </>
    ),
    work: () => (
      <>
        {/* 工作经验 */}
        <SectionBlock path="work" onClick={() => jump('work')} style={{ fontFamily: fontFor('work') }} hint={t('preview.locateHint')}>
          {secTitle(t('editor.section.work'), headerSize)}
          {resume.work.filter((w) => w.visible !== false).map((w) => (
            <div key={w.id} style={{ marginBottom: `${entrySpacingLogic('work')}px` }}>
              {entryHead(w.company, [fmtDate(w.startDate), w.current ? t('editor.field.current') : w.endDate ? fmtDate(w.endDate) : ''].filter(Boolean).join(' – '), {
                fontSize: `${TYPE_SCALE.entryHeadEm}em`,
                fontWeight: 700
              })}
              <div style={{ fontSize: `${TYPE_SCALE.entrySubEm}em`, opacity: 0.8 }}>{w.title}</div>
              {w.summary ? (
                <div style={{ ...pStyle, marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(w.summary) }} />
              ) : null}
            </div>
          ))}
          {resume.work.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
        </SectionBlock>
      </>
    ),
    projects: () => (
      <>
        {/* 项目经历 */}
        <SectionBlock path="projects" onClick={() => jump('projects')} style={{ fontFamily: fontFor('projects') }} hint={t('preview.locateHint')}>
          {secTitle(t('editor.section.projects'), headerSize)}
          {resume.projects.filter((p) => p.visible !== false).map((p) => (
            <div key={p.id} style={{ marginBottom: `${entrySpacingLogic('projects')}px` }}>
              {entryHead(p.name, [fmtDate(p.startDate), p.endDate ? fmtDate(p.endDate) : ''].filter(Boolean).join(' – '), {
                fontSize: `${TYPE_SCALE.entryHeadEm}em`,
                fontWeight: 700
              })}
              <div style={{ fontSize: `${TYPE_SCALE.entrySubEm}em`, opacity: 0.8 }}>{[p.role, p.organization].filter(Boolean).join(' · ')}</div>
              {p.description ? (
                <div style={{ ...pStyle, marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(p.description) }} />
              ) : null}
            </div>
          ))}
          {resume.projects.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
        </SectionBlock>

      </>
    ),
    skills: () => (
      <>
        {/* 专业技能 */}
        <SectionBlock path="skills" onClick={() => jump('skills')} style={{ fontFamily: fontFor('skills') }} hint={t('preview.locateHint')}>
          {secTitle(t('editor.section.skills'), headerSize)}
          {resume.skills.length > 0 ? (
            <ul style={{ listStyle: 'disc', paddingLeft: `${LIST_MARK_LOGIC.indent}px`, marginTop: '2px' }}>
              {resume.skills.map((s) => (
                <li key={s.id} style={{ fontSize: `${TYPE_SCALE.skillEm}em`, lineHeight }}>
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

      </>
    ),
    certificates: () => (
      <>
        {/* 证书 */}
        <SectionBlock path="certificates" onClick={() => jump('certificates')} style={{ fontFamily: fontFor('certificates') }} hint={t('preview.locateHint')}>
          {secTitle(t('editor.section.certificates'), headerSize)}
          {resume.certificates.map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: `${TYPE_SCALE.certEm}em`, marginBottom: '4px' }}>
              <span>{c.name}</span>
              <span style={{ opacity: 0.7 }}>{[c.issuer, fmtDate(c.date)].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
          {resume.certificates.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
        </SectionBlock>

      </>
    ),
    languages: () => (
      <>
        {/* 语言 */}
        <SectionBlock path="languages" onClick={() => jump('languages')} style={{ fontFamily: fontFor('languages') }} hint={t('preview.locateHint')}>
          {secTitle(t('editor.section.languages'), headerSize)}
          {resume.languages.map((l) => (
            <div key={l.id} style={{ fontSize: `${TYPE_SCALE.langEm}em`, marginBottom: '2px' }}>
              {l.name}
              {l.proficiency ? `（${t(`editor.lang.${l.proficiency}`)}）` : ''}
            </div>
          ))}
          {resume.languages.length === 0 ? <Placeholder label={t('editor.action.placeholder')} /> : null}
        </SectionBlock>
      </>
    )
  }
  return (
    <div className="preview-paper-body" data-redact={privacyMode ? 'on' : 'off'} style={rootStyle}>
      {/* basics：左头像 | 中名字+职位 | 右基本信息（classic 三列；modern/compact 简化两列） */}
      <SectionBlock path="basics" onClick={() => jump('basics')} style={{ fontFamily: fontFor('basics') }} hint={t('preview.locateHint')}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* R6：头部三块（图片/姓名与职业/标签信息）按 basicsOrder 顺序渲染 */}
          {basicsOrder.map((bid) => {
            if (bid === 'photo') {
              // 2026-08-09 T2：无照片时显示人形剪影占位（左头像位；PDF 端同步占位保证「模板=打印」）
              return !showPhoto ? (
                <div
                  key={bid}
                  aria-hidden
                  className="photo-placeholder"
                  style={{ width: photoW, height: photoH, flexShrink: 0 }}
                >
                  <svg width={photoW * 0.5} height={photoH * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="9" r="4" />
                    <path d="M4.5 20c1.6-3.6 4.4-5.2 7.5-5.2s5.9 1.6 7.5 5.2" />
                  </svg>
                </div>
              ) : showPhoto && !photoBroken ? (
                <img
                  key={bid}
                  src={photoSrc as string}
                  alt=""
                  width={photoW}
                  height={photoH}
                  className="redact-field"
                  onError={() => setPhotoBroken(true)}
                  style={{ width: photoW, height: photoH, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : null
            }
            if (bid === 'identity') {
              return (
                <div key={bid} style={{ minWidth: 0, paddingTop: '2px' }}>
                  {basics.name ? (
                    <h1 className="redact-field" style={{ fontSize: `${TYPE_SCALE.namePx[variant]}px`, fontWeight: 700, lineHeight: 1.2, marginBottom: '2px', color: '#111827' }}>{basics.name}</h1>
                  ) : null}
                  {basics.headline ? (
                    <div className="redact-field" style={{ fontSize: `${TYPE_SCALE.headlinePx[variant]}px`, opacity: 0.75, lineHeight: 1.4 }}>{basics.headline}</div>
                  ) : null}
                </div>
              )
            }
            return infoItems.length > 0 ? (
              <div
                key={bid}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto auto',
                  columnGap: '20px',
                  rowGap: '7px',
                  // R5：紧跟姓名右侧（不再推到行尾）；网格水平方向对齐
                  alignSelf: 'flex-start'
                }}
              >
                {infoItems.map((it) => (
                  <div key={it.id} className="redact-field" style={{ display: 'flex', alignItems: 'center', gap: `${CONTACT_GRID_LOGIC.iconGap}px`, minWidth: 0, fontSize: contactFontSize(it.value) }}>
                    {/* 2026-08-10 任务1：lineHeight:0 消除 svg 基线对垂直居中的影响（图1 图标-文字错位加固） */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, color: 'var(--rm-accent)', flexShrink: 0 }}>
                      <InfoIcon id={it.icon as InfoIconId} size={CONTACT_GRID_LOGIC.iconSize} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: `${CONTACT_GRID_LOGIC.maxWidth}px` }}>{it.value}</span>
                  </div>
                ))}
              </div>
            ) : null
          })}
        </div>
        {basics.profile ? (
          <div style={{ marginTop: '12px' }} dangerouslySetInnerHTML={{ __html: richTextToHtml(basics.profile) }} />
        ) : null}
        {infoItems.length === 0 && contactItems.length > 0 ? (
          <div className="redact-field" style={{ fontSize: '0.82em', opacity: 0.75, marginTop: '8px' }}>{contactItems.join(' · ')}</div>
        ) : null}
      </SectionBlock>

      {/* 自我评价（2026-08-10 P1-8：空内容隐藏整节，与 PDF 端对齐——原空 doc 渲染空标题+大块留白） */}
      {(() => {
        const html = richTextToHtml(resume.summary?.content)
        return html.trim().length > 0 ? (
          <SectionBlock path="summary" onClick={() => jump('summary')} style={{ fontFamily: fontFor('summary') }} hint={t('preview.locateHint')}>
            {secTitle(t('editor.section.summary'), headerSize)}
            <div style={pStyle} dangerouslySetInnerHTML={{ __html: html }} />
          </SectionBlock>
        ) : null
      })()}

      {/* 2026-08-09 模块排序：板块按 layout.sectionOrder 渲染（basics/summary 固定顶部）；
         自定义模块（customSections）插入排序位；缺省 = 模板默认顺序 */}
      {orderedIds.map((id) => sectionRenderers[id]?.() ?? renderCustom(id))}
    </div>
  )
}