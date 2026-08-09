import { describe, it, expect } from 'vitest'
import { IPC } from '../ipc-channels'
import { ImportMapSchema, importMapToResume } from '../schema/import-map'
import { migrate, SKILL_LEVELS, LANGUAGE_PROFICIENCIES } from '../schema/resume'

describe('IPC 契约（M4a 导入）', () => {
  it('冻结 import:run 通道', () => {
    expect(IPC.Import.Run).toBe('import:run')
  })
})

describe('ImportMapSchema', () => {
  it('接受完整合法结构', () => {
    const r = ImportMapSchema.safeParse({
      basics: { name: '张三', phone: '13800000000' },
      summary: '五年后端开发经验',
      work: [{ company: '某科技', title: '工程师', highlights: ['a'] }],
      skills: [{ name: 'TypeScript', level: '熟练' }]
    })
    expect(r.success).toBe(true)
  })

  it('宽松：全部字段 optional，空对象合法', () => {
    const r = ImportMapSchema.safeParse({})
    expect(r.success).toBe(true)
  })
})

describe('importMapToResume', () => {
  it('纯文本 summary → RichText 单段落', () => {
    const r = importMapToResume({ summary: '  自我介绍文本  ' })
    expect(r.summary.content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '自我介绍文本' }] }]
    })
  })

  it('日期规范化：2020.09 / 2020年9月 / 2020 → YYYY-MM / YYYY', () => {
    const r = importMapToResume({
      work: [{ company: 'A', startDate: '2020.09', endDate: '2021年3月' }],
      education: [{ school: 'B', startDate: '2016' }]
    })
    expect(r.work[0].startDate).toBe('2020-09')
    expect(r.work[0].endDate).toBe('2021-03')
    expect(r.education[0].startDate).toBe('2016')
  })

  it('current=true 时 endDate 置空（至今）', () => {
    const r = importMapToResume({ work: [{ company: 'A', current: true, endDate: '2026-12' }] })
    expect(r.work[0].current).toBe(true)
    expect(r.work[0].endDate).toBe('')
  })

  it('非法日期 → 空串', () => {
    const r = importMapToResume({ work: [{ company: 'A', startDate: '上世纪' }] })
    expect(r.work[0].startDate).toBe('')
  })

  it('skill level 精确匹配枚举，非法 → undefined', () => {
    const r = importMapToResume({
      skills: [
        { name: '合法', level: '精通' },
        { name: '非法', level: '非常熟练' }
      ]
    })
    expect(r.skills[0].level).toBe('精通')
    expect(r.skills[1].level).toBeUndefined()
  })

  it('language proficiency 精确匹配枚举', () => {
    const r = importMapToResume({ languages: [{ name: '英语', proficiency: '流利' }] })
    expect(r.languages[0].proficiency).toBe('流利')
  })

  it('空壳条目被剔除（education 无任何字段）', () => {
    const r = importMapToResume({
      education: [{ school: '', degree: '', startDate: '' }, { school: '有效' }]
    })
    expect(r.education).toHaveLength(1)
    expect(r.education[0].school).toBe('有效')
  })

  it('全空结构 → 合法空简历（migrate 收口通过）', () => {
    const r = importMapToResume({})
    expect(r.schemaVersion).toBe(1)
    expect(() => migrate(r)).not.toThrow()
  })

  it('highlights → RichText 数组', () => {
    const r = importMapToResume({
      work: [{ company: 'A', highlights: ['第一点', '第二点'] }]
    })
    const texts = r.work[0].highlights.map(
      (h) =>
        (
          h as unknown as { content: { content: { text: string }[] }[] }
        ).content[0].content[0].text
    )
    expect(texts).toEqual(['第一点', '第二点'])
  })

  it('枚举常量与 F1 定案一致', () => {
    expect(SKILL_LEVELS).toEqual(['了解', '熟练', '精通'])
    expect(LANGUAGE_PROFICIENCIES).toEqual(['母语', '流利', '熟练', '基础'])
  })
})
