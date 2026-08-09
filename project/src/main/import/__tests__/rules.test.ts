/**
 * rules.test.ts —— M4a.1 B 档本地规则单测（纯 node，零依赖）
 * 覆盖：cleanText / 锚点独立词匹配 / bullet 提取 / 分段 / 脏排版判定 / 日期跨度 / 组装 ImportMap。
 */
import { describe, it, expect } from 'vitest'
import {
  cleanText,
  hasIndependentKeyword,
  matchAnchorLine,
  matchBullet,
  splitBySectionAnchors,
  detectDirtyLayout,
  parseDateSpan,
  rulesToImportMap
} from '../rules'
import { importMapToResume } from '../../../shared/schema/import-map'

describe('cleanText（清洗）', () => {
  it('剔空行 / 纯页码 / 装饰线', () => {
    expect(cleanText('  张三\n\n12\n---\n电话 138\n')).toBe('张三\n电话 138')
  })
})

describe('hasIndependentKeyword（独立成词）', () => {
  it('中文：项目经理不命中「项目」，行首「项目经验：」命中', () => {
    expect(hasIndependentKeyword('项目经理', '项目')).toBe(false)
    expect(hasIndependentKeyword('项目经验：', '项目经验')).toBe(true)
    expect(hasIndependentKeyword('五年工作经历', '工作经历')).toBe(false) // 前接汉字
    expect(hasIndependentKeyword('工作经历：', '工作经历')).toBe(true)
  })

  it('英文：works 不命中 work，Work Experience 命中', () => {
    expect(hasIndependentKeyword('Works at X', 'work')).toBe(false)
    expect(hasIndependentKeyword('Work Experience', 'work')).toBe(true)
    expect(hasIndependentKeyword('Skills & Tools', 'skills')).toBe(true)
  })
})

describe('matchAnchorLine（锚点匹配）', () => {
  it('中英锚点行命中对应 section', () => {
    expect(matchAnchorLine('教育经历')).toBe('education')
    expect(matchAnchorLine('Education')).toBe('education')
    expect(matchAnchorLine('工作经历：')).toBe('work')
    expect(matchAnchorLine('专业技能')).toBe('skills')
    expect(matchAnchorLine('Languages')).toBe('languages')
  })

  it('正文行不误命中', () => {
    expect(matchAnchorLine('张三 项目经理')).toBeNull()
    expect(matchAnchorLine('负责核心模块开发')).toBeNull()
  })
})

describe('matchBullet（bullet 提取）', () => {
  it('符号 / 数字序号 / 中文序号', () => {
    expect(matchBullet('- 做了 A')).toBe('做了 A')
    expect(matchBullet('• 做了 B')).toBe('做了 B')
    expect(matchBullet('1. 第一点')).toBe('第一点')
    expect(matchBullet('（1）子项')).toBe('子项')
    expect(matchBullet('① 首项')).toBe('首项')
    expect(matchBullet('普通行')).toBeNull()
  })
})

describe('splitBySectionAnchors（分段）', () => {
  it('锚点分段 + bullet/段落归类 + unclassified 暂存', () => {
    const text = cleanText([
      '张三',
      '13800000000',
      '教育经历',
      '北京大学 本科 计算机 2013-2017',
      '工作经历',
      '- 某科技 工程师 2020-2023',
      '技能',
      'TypeScript、React、Node.js'
    ].join('\n'))
    const sections = splitBySectionAnchors(text)
    expect(sections[0].id).toBe('unclassified')
    expect(sections[0].rawText).toContain('张三')
    expect(sections.find((s) => s.id === 'education')?.rawText).toContain('北京大学')
    expect(sections.find((s) => s.id === 'work')?.items).toEqual(['某科技 工程师 2020-2023'])
    expect(sections.find((s) => s.id === 'skills')?.rawText).toContain('TypeScript')
  })
})

describe('detectDirtyLayout（脏排版判定）', () => {
  it('表格残余 → table 提示', () => {
    expect(detectDirtyLayout('a | b\nc | d', [{ id: 'work', rawText: '', items: [] }])).toContain('table')
  })

  it('无锚点 → no-anchor 提示', () => {
    expect(detectDirtyLayout('随便一些文本', [{ id: 'unclassified', rawText: 'x', items: [] }])).toContain(
      'no-anchor'
    )
  })

  it('短行密集 → multi-column 提示', () => {
    const text = Array.from({ length: 12 }, (_, i) => (i % 2 ? '短' : '甲乙')).join('\n')
    expect(detectDirtyLayout(text, [{ id: 'work', rawText: '', items: [] }])).toContain('multi-column')
  })

  it('正常排版无提示', () => {
    const text = ['教育经历', '北京大学 本科 2013-2017', '工作经历', '某科技 工程师 2020-2023'].join('\n')
    const sections = splitBySectionAnchors(text)
    expect(detectDirtyLayout(text, sections)).toEqual([])
  })
})

describe('parseDateSpan（日期跨度）', () => {
  it('YYYY-MM 至 YYYY-MM / YYYY 单年', () => {
    expect(parseDateSpan('2013-09 至 2017-06')).toEqual({ start: '2013-09', end: '2017-06', rest: '' })
    expect(parseDateSpan('2020 工程师 某公司')).toEqual({ start: '2020', end: undefined, rest: '工程师 某公司' })
  })
})

describe('rulesToImportMap（组装 ImportMap → importMapToResume 收口）', () => {
  const sampleText = cleanText([
    '张三',
    '13800138000',
    'zhangsan@x.com',
    '教育经历',
    '北京大学 本科 计算机科学 2013-09 至 2017-06',
    '工作经历',
    '- 字节跳动 前端工程师 2017-07 至 2021-06',
    '- 某科技 产品经理 2021-07 至今',
    '项目经验',
    '- 订单系统重构',
    '技能',
    'TypeScript、React、Node.js',
    '证书',
    'CET-6 2019-06',
    '语言能力',
    '英语 流利'
  ].join('\n'))

  it('完整文本 → ImportMap → Resume 合法（migrate 收口通过）', () => {
    const sections = splitBySectionAnchors(sampleText)
    const map = rulesToImportMap(sections)
    const resume = importMapToResume(map)
    expect(resume.basics.name).toBe('张三')
    expect(resume.basics.phone).toBe('13800138000')
    expect(resume.basics.email).toBe('zhangsan@x.com')
    expect(resume.education[0].school).toBe('北京大学')
    expect(resume.education[0].startDate).toBe('2013-09')
    expect(resume.work[0].company).toBe('字节跳动')
    expect(resume.work[0].title).toBe('前端工程师')
    expect(resume.work[0].startDate).toBe('2017-07')
    // 2026-08-09 修复：技能整行保留（不按空格/逗号拆碎）
    expect(resume.skills.map((s) => s.name)).toEqual(['TypeScript、React、Node.js'])
    expect(resume.certificates[0].name).toBe('CET-6')
    expect(resume.languages[0].name).toBe('英语')
  })

  it('拆碎回归（对照「项目导出简历示例」）：项目/工作要点行并入条目，不拆成独立条目', () => {
    const text = cleanText([
      '项目经验',
      '抖音创作者中台 前端负责人 2022.06-2023.12',
      '- 基于 React 开发的创作者平台',
      '- 实施代码分割和懒加载',
      '前端监控平台 技术负责人 2021.09-2022.03',
      '- 接入 APM 监控',
      '工作经历',
      '字节跳动 高级前端工程师 2021.07-2024.12',
      '- 负责抖音创作者平台的开发',
      '- 优化工程化配置'
    ].join('\n'))
    const sections = splitBySectionAnchors(text)
    const map = rulesToImportMap(sections)
    const resume = importMapToResume(map)
    // 2 个项目（原实现会把 5 条要点拆成 5+1 个条目）
    expect(resume.projects.length).toBe(2)
    expect(resume.projects[0].name).toBe('抖音创作者中台')
    expect(resume.projects[0].role).toBe('前端负责人')
    // 要点并入 description（bulletList 化）
    const desc = resume.projects[0].description as { content: Array<{ type: string }> }
    expect(JSON.stringify(desc)).toContain('bulletList')
    expect(JSON.stringify(desc)).toContain('基于 React 开发的创作者平台')
    // 工作 1 条 + 要点并入 summary
    expect(resume.work.length).toBe(1)
    expect(JSON.stringify(resume.work[0].summary)).toContain('负责抖音创作者平台的开发')
  })

  it('技能"分类：内容"→ category + name（对齐示例形态）', () => {
    const text = cleanText('专业技能\n前端框架：熟悉 React、Vue.js\n开发语言：TypeScript')
    const sections = splitBySectionAnchors(text)
    const map = rulesToImportMap(sections)
    const resume = importMapToResume(map)
    expect(resume.skills[0]).toMatchObject({ category: '前端框架', name: '熟悉 React、Vue.js' })
    expect(resume.skills[1]).toMatchObject({ category: '开发语言', name: 'TypeScript' })
  })

  it('无锚点文本 → 全部 unclassified → 空 ImportMap（dirtyLayout 提示切 A 档）', () => {
    const sections = splitBySectionAnchors('一段无法归类的自由文本')
    expect(sections.every((s) => s.id === 'unclassified')).toBe(true)
    expect(rulesToImportMap(sections)).toEqual({})
  })
})
