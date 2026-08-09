/**
 * map.test.ts —— M4a AI 映射单测
 * mock 链：electron（config.ts）→ electron-store（内存）→ 'ai'（generateObject）
 * → ai/client（createActiveModel）。覆盖：正常映射（→ importMapToResume 收口）/ NO_PROVIDER 冒泡 / 映射非法结构 → 抛错。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const storeData: Record<string, unknown> = {
  providers: {
    deepseek: { enabled: true },
    volcengine: { enabled: false },
    openai: { enabled: false },
    google: { enabled: false }
  },
  temperature: 0.7,
  maxTokens: 4096,
  customProviders: []
}

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/xm-import-map' },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8')
  }
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string): unknown {
      return storeData[key]
    }
    set(key: string, value: unknown): void {
      storeData[key] = value
    }
    delete(key: string): void {
      delete storeData[key]
    }
    get path(): string {
      return '/tmp/xm-import-map/settings.json'
    }
  }
}))

const generateObject = vi.fn()
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObject(...args)
}))

const createActiveModel = vi.fn()
vi.mock('../../ai/client', () => ({
  createActiveModel: (...args: unknown[]) => createActiveModel(...args)
}))

import { mapTextToDraft } from '../map'

beforeEach(() => {
  vi.clearAllMocks()
  createActiveModel.mockResolvedValue({ model: {}, displayName: 'test', temperature: 0.7, maxTokens: 4096 })
})

describe('mapTextToDraft（A 档 AI 映射）', () => {
  it('正常映射 → ImportMapSchema → Resume 收口（字段落位）', async () => {
    generateObject.mockResolvedValue({
      object: {
        basics: { name: '张三', phone: '13800000000' },
        summary: '五年后端开发',
        work: [{ company: '某科技', title: '工程师', startDate: '2020.09', highlights: ['做了 A'] }],
        skills: [{ name: 'TS', level: '熟练' }]
      }
    })
    const d = await mapTextToDraft('简历文本', 'a.pdf', 'pdf', [])
    expect(d.format).toBe('pdf')
    expect(d.resume.basics.name).toBe('张三')
    expect(d.resume.work[0].startDate).toBe('2020-09')
    expect(d.resume.skills[0].level).toBe('熟练')
    expect(d.sourcePreview).toBe('简历文本')
  })

  it('映射入参：system 硬约束 + 文本截断', async () => {
    generateObject.mockResolvedValue({ object: {} })
    const long = 'x'.repeat(20000)
    await mapTextToDraft(long, 'b.pdf', 'pdf', [])
    const args = generateObject.mock.calls[0][0]
    expect(args.system).toContain('禁止编造')
    expect(args.prompt.length).toBeLessThan(12000 + 200)
  })

  it('warnings 透传', async () => {
    generateObject.mockResolvedValue({ object: {} })
    const d = await mapTextToDraft('t', 'c.docx', 'docx', ['乱码行剔除 1 行'])
    expect(d.warnings).toContain('乱码行剔除 1 行')
    expect(d.format).toBe('docx')
  })

  it('无可用服务商 → NO_PROVIDER 冒泡（run.ts 转 AiResult）', async () => {
    createActiveModel.mockRejectedValue(Object.assign(new Error('no provider'), { code: 'NO_PROVIDER' }))
    await expect(mapTextToDraft('t', 'd.pdf', 'pdf', [])).rejects.toMatchObject({ code: 'NO_PROVIDER' })
  })

  it('AI 返回非对象结构（脏数据）→ 抛错拒绝', async () => {
    generateObject.mockResolvedValue({ object: null })
    await expect(mapTextToDraft('t', 'e.pdf', 'pdf', [])).rejects.toThrow()
  })
})
