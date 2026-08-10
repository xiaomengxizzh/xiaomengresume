import { describe, it, expect } from 'vitest'
import {
  ResumeSchema,
  createEmptyResume,
  migrate,
  EMPTY_DOC,
  RichTextSchema,
  LayoutSchema,
  CustomFieldSchema
} from '../schema/resume'
import { JobSchema, createEmptyJob } from '../schema/job'
import { createSampleResume } from '../../main/files/sample-resume'
import resumeZh from './fixtures/resume-zh.json'
import resumeEn from './fixtures/resume-en.json'

describe('ResumeSchema · 空工厂', () => {
  it('createEmptyResume() 经 parse 通过（空简历合法）', () => {
    const r = ResumeSchema.parse(createEmptyResume())
    expect(r.schemaVersion).toBe(1)
    expect(r.basics.name).toBe('')
    expect(r.education).toEqual([])
    expect(r.layout).toBeUndefined() // 缺省回落模板预设
    expect(r.meta).toBeUndefined()
  })

  it('schemaVersion 必须为 1（版本化事实源）', () => {
    const r = ResumeSchema.safeParse({ ...createEmptyResume(), schemaVersion: 2 })
    expect(r.success).toBe(false)
  })
})

describe('ResumeSchema · 完整示例 fixture', () => {
  it.each([
    ['zh', resumeZh],
    ['en', resumeEn]
  ])('%s 示例简历 parse 通过', (_lang, data) => {
    const r = ResumeSchema.parse(data)
    expect(r.schemaVersion).toBe(1)
    // 全 sections 覆盖
    expect(r.basics.name.length).toBeGreaterThan(0)
    expect(r.summary.content).toBeDefined()
    expect(r.education.length).toBeGreaterThan(0)
    expect(r.work.length).toBeGreaterThan(0)
    expect(r.projects.length).toBeGreaterThan(0)
    expect(r.skills.length).toBeGreaterThan(0)
    expect(r.certificates.length).toBeGreaterThan(0)
    expect(r.languages.length).toBeGreaterThan(0)
    // layout 示例
    expect(r.layout).toBeDefined()
    expect(LayoutSchema.parse(r.layout).templateId).toBeDefined()
  })

  it('zh 示例 customFields 与 visible 字段存在', () => {
    const r = ResumeSchema.parse(resumeZh)
    expect(r.basics.customFields.length).toBe(1)
    expect(CustomFieldSchema.parse(r.basics.customFields[0]).label).toBe('个人网站')
    expect(r.work[0].visible).toBe(true)
    expect(r.work[1].visible).toBe(false) // 条目级显隐
    expect(r.basics.fieldOrder?.length).toBe(7)
  })

  it('en 示例 boundJobIds 默认数组生效', () => {
    const r = ResumeSchema.parse(resumeEn)
    expect(r.boundJobIds).toHaveLength(1)
    // 缺省回落：无 boundJobIds 的旧 JSON 兼容
    const r2 = ResumeSchema.parse({ ...resumeEn, boundJobIds: undefined, schemaVersion: 1 })
    expect(r2.boundJobIds).toEqual([])
  })
})

describe('migrate() 迁移入口', () => {
  it('v1 直通', () => {
    const r = migrate(createEmptyResume())
    expect(r.schemaVersion).toBe(1)
  })

  it('无版本号抛错（视为 v0 不支持）', () => {
    const { schemaVersion, ...noVersion } = createEmptyResume()
    void schemaVersion
    expect(() => migrate(noVersion)).toThrow(/Unsupported schemaVersion/)
  })

  it('未知版本号抛错', () => {
    expect(() => migrate({ ...createEmptyResume(), schemaVersion: 99 })).toThrow(
      /Unsupported schemaVersion/
    )
  })
})

describe('RichText / Layout 边界', () => {
  it('RichTextSchema 接受 Tiptap doc 与降级 HTML', () => {
    expect(RichTextSchema.parse(EMPTY_DOC)).toEqual({ type: 'doc', content: [] })
    expect(RichTextSchema.parse('<p>降级</p>')).toBe('<p>降级</p>')
    expect(RichTextSchema.safeParse('无标签纯文本').success).toBe(false)
  })

  it('layout 全 optional，themeColor 校验 #RRGGBB', () => {
    expect(LayoutSchema.parse({}).templateId).toBeUndefined()
    expect(LayoutSchema.safeParse({ themeColor: '#475569' }).success).toBe(true)
    expect(LayoutSchema.safeParse({ themeColor: 'red' }).success).toBe(false)
  })

  it('layout.sectionFonts（2026-08-07 UI 重构：单元级字体覆盖）', () => {
    const ok = LayoutSchema.parse({ sectionFonts: { work: 'yahei', summary: 'songti' } })
    expect(ok.sectionFonts?.work).toBe('yahei')
    // 缺省无 sectionFonts 合法
    expect(LayoutSchema.parse({}).sectionFonts).toBeUndefined()
  })
})

describe('JobSchema（F19 数据层 M1 顺带）', () => {
  it('createEmptyJob 生成合法岗位', () => {
    const j = JobSchema.parse(createEmptyJob('前端工程师'))
    expect(j.name).toBe('前端工程师')
    expect(j.appliedAt).toBe('')
    expect(j.createdAt).toBeDefined()
  })

  it('name 为空被拒绝', () => {
    // createEmptyJob() 默认空名 → min(1) 拒绝（岗位必须有名才创建）
    expect(JobSchema.safeParse(createEmptyJob()).success).toBe(false)
    expect(JobSchema.safeParse(createEmptyJob('前端工程师')).success).toBe(true)
  })
})

describe('内置示例简历（M1 补口 · 打开示例入口数据源）', () => {
  it('createSampleResume() 经 parse 通过且内容完整', () => {
    const r = ResumeSchema.parse(createSampleResume())
    expect(r.schemaVersion).toBe(1)
    expect(r.basics.name).toBe('宋哈娜')
    expect(r.education.length).toBeGreaterThan(0)
    expect(r.work.length).toBeGreaterThan(0)
    expect(r.layout).toBeDefined()
    expect(r.layout?.templateId).toBe('classic')
    // meta 由写入方补齐，数据源不含
    expect(r.meta).toBeUndefined()
  })

  it('每次调用返回独立对象（可安全修改）', () => {
    const a = createSampleResume()
    const b = createSampleResume()
    expect(a).not.toBe(b)
    expect(a.basics).not.toBe(b.basics)
  })
})

describe('模块排序与自定义模块（2026-08-09 增补）', () => {
  it('LayoutSchema.sectionOrder 可选且校验字符串数组', () => {
    expect(LayoutSchema.parse({ sectionOrder: ['work', 'skills'] }).sectionOrder).toEqual(['work', 'skills'])
    expect(LayoutSchema.parse({}).sectionOrder).toBeUndefined()
  })

  it('ResumeSchema.customSections 可选，合法结构通过', () => {
    const r = createEmptyResume()
    r.customSections = [{ id: crypto.randomUUID(), title: '兴趣爱好', content: { type: 'doc', content: [] } }]
    const parsed = ResumeSchema.parse(r)
    expect(parsed.customSections?.[0].title).toBe('兴趣爱好')
    // 非法（缺 id）拒绝
    const bad = { ...r, customSections: [{ title: 'x' }] }
    expect(ResumeSchema.safeParse(bad).success).toBe(false)
    // 缺省 undefined（零迁移）
    expect(ResumeSchema.parse(createEmptyResume()).customSections).toBeUndefined()
  })

  it('LayoutSchema.basicsOrder 可选且仅接受三块枚举（2026-08-09 R6 回归）', () => {
    expect(LayoutSchema.parse({ basicsOrder: ['tags', 'identity', 'photo'] }).basicsOrder).toEqual(['tags', 'identity', 'photo'])
    expect(LayoutSchema.parse({}).basicsOrder).toBeUndefined()
    // 非法块名拒绝
    expect(LayoutSchema.safeParse({ basicsOrder: ['photo', 'avatar'] }).success).toBe(false)
    // 旧简历（无 basicsOrder）经 ResumeSchema parse 兼容
    const r = createEmptyResume()
    r.layout = { templateId: 'classic' }
    const parsed = ResumeSchema.parse(r)
    expect(parsed.layout?.basicsOrder).toBeUndefined()
  })
})
