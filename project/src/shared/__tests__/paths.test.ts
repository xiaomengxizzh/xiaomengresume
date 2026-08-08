import { describe, it, expect } from 'vitest'
import {
  parsePath,
  buildPath,
  parseFieldIndex,
  getByPath,
  setByPath,
  type FieldPath
} from '../paths'
import { createEmptyResume, type Resume } from '../schema/resume'

describe('parsePath / buildPath', () => {
  it('单对象字段：basics.name', () => {
    expect(parsePath('basics.name')).toEqual({ section: 'basics', index: undefined, field: 'name' })
  })

  it('数组条目：education[1].description', () => {
    expect(parsePath('education[1].description')).toEqual({
      section: 'education',
      index: 1,
      field: 'description'
    })
  })

  it('两层数组：work[0].highlights[2]', () => {
    expect(parsePath('work[0].highlights[2]')).toEqual({
      section: 'work',
      index: 0,
      field: 'highlights[2]'
    })
  })

  it('layout 排版参数', () => {
    expect(parsePath('layout.themeColor')).toEqual({
      section: 'layout',
      index: undefined,
      field: 'themeColor'
    })
  })

  it('buildPath 反向构建', () => {
    expect(buildPath('basics', undefined, 'name')).toBe('basics.name')
    expect(buildPath('education', 1, 'description')).toBe('education[1].description')
    expect(buildPath('work', 0, 'highlights[2]')).toBe('work[0].highlights[2]')
    expect(buildPath('layout', undefined, 'themeColor')).toBe('layout.themeColor')
  })

  it('非法路径抛错', () => {
    expect(() => parsePath('')).toThrow()
    expect(() => parsePath('123abc.x')).toThrow()
    expect(() => parsePath('basics[-1].x')).toThrow()
  })
})

describe('parseFieldIndex', () => {
  it('拆字段名与子下标', () => {
    expect(parseFieldIndex('highlights[2]')).toEqual({ field: 'highlights', index: 2 })
    expect(parseFieldIndex('name')).toEqual({ field: 'name', index: undefined })
  })
})

describe('getByPath / setByPath', () => {
  function sample(): Resume {
    const r = createEmptyResume()
    r.basics.name = '宋哈娜'
    r.basics.customFields = [
      { id: 'f0a1b2c3-0000-4000-8000-000000000001', label: '个人网站', value: 'https://x.dev' }
    ]
    r.education = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        school: '北京大学',
        degree: '本科',
        major: '计算机科学',
        startDate: '2013-09',
        endDate: '2017-06',
        location: '北京',
        gpa: '',
        description: undefined,
        visible: true
      }
    ]
    r.work = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        company: '字节跳动',
        title: '前端工程师',
        location: '',
        startDate: '2017-07',
        endDate: '2021-06',
        current: false,
        summary: undefined,
        highlights: [
          { type: 'doc', content: [{ type: 'paragraph' }] },
          { type: 'doc', content: [] }
        ],
        visible: true
      }
    ]
    r.layout = { templateId: 'classic' }
    return r
  }

  it('读取：单对象 / 数组条目 / 两层数组 / layout', () => {
    const r = sample()
    expect(getByPath(r, 'basics.name')).toBe('宋哈娜')
    expect(getByPath(r, 'basics.customFields[0]')).toMatchObject({ label: '个人网站' })
    expect(getByPath(r, 'education[0].school')).toBe('北京大学')
    expect(getByPath(r, 'work[0].highlights[1]')).toEqual({ type: 'doc', content: [] })
    expect(getByPath(r, 'layout.templateId')).toBe('classic')
  })

  it('读取：越界/不存在返回 undefined', () => {
    const r = sample()
    expect(getByPath(r, 'work[9].company')).toBeUndefined()
    expect(getByPath(r, 'work[0].highlights[9]')).toBeUndefined()
    expect(getByPath(r, 'basics.ghost')).toBeUndefined()
    expect(getByPath(r, 'ghostSection.x')).toBeUndefined()
  })

  it('写入：单对象字段', () => {
    const r = sample()
    setByPath(r, 'basics.name', '新名字')
    expect(r.basics.name).toBe('新名字')
  })

  it('写入：数组条目字段', () => {
    const r = sample()
    setByPath(r, 'education[0].school', '清华大学')
    expect(r.education[0].school).toBe('清华大学')
  })

  it('写入：两层数组元素', () => {
    const r = sample()
    setByPath(r, 'work[0].highlights[0]', { type: 'doc', content: [] })
    expect(r.work[0].highlights[0]).toEqual({ type: 'doc', content: [] })
  })

  it('写入：layout 字段', () => {
    const r = sample()
    setByPath(r, 'layout.themeColor', '#475569')
    expect(r.layout?.themeColor).toBe('#475569')
  })

  it('写入：数组越界 / section 不存在抛错', () => {
    const r = sample()
    expect(() => setByPath(r, 'work[9].company', 'x')).toThrow(/out of range/)
    expect(() => setByPath(r, 'ghost.x', 'x')).toThrow(/not found/)
    expect(() => setByPath(r, 'work[0].highlights[9]', 'x')).toThrow(/out of range/)
  })

  it('P1 回归：两级点号路径（数组条目内部属性）读/写', () => {
    const r = sample()
    // 读取
    expect(getByPath(r, 'basics.customFields[0].label')).toBe('个人网站')
    expect(getByPath(r, 'basics.customFields[0].value')).toBe('https://x.dev')
    // 写入
    setByPath(r, 'basics.customFields[0].label', '博客')
    expect(r.basics.customFields[0].label).toBe('博客')
    // infoItems 数组条目内部字段（EditorPane 添加条目时先初始化数组）
    r.basics.infoItems = [{ id: 'mail', icon: 'mail', label: '邮箱', value: 'a@b.c' }]
    expect(getByPath(r, 'basics.infoItems[0].icon')).toBe('mail')
    setByPath(r, 'basics.infoItems[0].icon', 'web')
    setByPath(r, 'basics.infoItems[0].value', 'x.dev')
    expect(r.basics.infoItems[0]).toMatchObject({ icon: 'web', value: 'x.dev' })
    // 越界仍抛错
    expect(() => setByPath(r, 'basics.customFields[9].label', 'x')).toThrow(/out of range/)
    expect(() => setByPath(r, 'basics.customFields[0].ghost', 'x')).not.toThrow()
  })

  it('FieldPath 为字符串类型（宽松起步）', () => {
    const p: FieldPath = 'basics.name'
    expect(typeof p).toBe('string')
  })
})
