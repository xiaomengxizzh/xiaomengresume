/**
 * handlers.test.ts —— M3 AI 四 handler 单测（node 环境）
 * mock 链：electron（config.ts 顶层引用）→ electron-store（内存）→ 'ai'（generateObject/streamText）
 * → resume-store/job-store（openResume/getJob）。覆盖：正常流 + 全部错误码分支。
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createEmptyResume, type Resume } from '../../../shared/schema/resume'

// ── mocks（vi.mock 提升到 import 前）──────────────────────────────────────

const TEST_DIR = vi.hoisted(() => `${process.cwd()}/.tmp/xm-ai-test`)
const storeData: Record<string, unknown> = {
  providers: {
    deepseek: { enabled: true },
    volcengine: { enabled: false },
    openai: { enabled: false },
    google: { enabled: false }
  },
  temperature: 0.7,
  maxTokens: 4096,
  aiPrompts: undefined,
  customProviders: []
}

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR },
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
      return '/tmp/xm-ai-test/settings.json'
    }
  }
}))

const generateObject = vi.fn()
const streamText = vi.fn()
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
  streamText: (...args: unknown[]) => streamText(...args)
}))

const openResume = vi.fn()
vi.mock('../../files/resume-store', () => ({ openResume: (...a: unknown[]) => openResume(...a) }))
const getJob = vi.fn()
vi.mock('../../files/job-store', () => ({ getJob: (...a: unknown[]) => getJob(...a) }))

// ── 被测模块（mock 之后 import）────────────────────────────────────────────
import { runGrammar } from '../grammar'
import { runIntro } from '../intro'
import { runPolish } from '../polish'
import { runMatch } from '../match'
import type { GrammarIssue } from '../../../shared/schema/grammar'

function resumeWithSummary(): Resume {
  const r = createEmptyResume()
  r.basics.name = '张三'
  r.summary.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '五年后端开发经验' }] }] }
  r.work = [
    {
      id: crypto.randomUUID(),
      company: 'X 公司',
      title: '后端工程师',
      startDate: '2020',
      endDate: '2023',
      current: false,
      summary: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '负责订单系统' }] }] },
      highlights: [],
      visible: true
    }
  ]
  return r
}

function mockStream(chunks: string[]): { stream: AsyncGenerator<{ type: string; delta: string }> } {
  return {
    stream: (async function* () {
      for (const c of chunks) yield { type: 'text-delta', delta: c }
    })()
  }
}

beforeAll(async () => {
  // 预置 keyring（config.ts 从 <userData>/ai-keys.json 读 key）
  await fs.promises.mkdir(TEST_DIR, { recursive: true })
  await fs.promises.writeFile(
    path.join(TEST_DIR, 'ai-keys.json'),
    JSON.stringify({ deepseek: Buffer.from('sk-test-key').toString('base64') })
  )
})

afterAll(async () => {
  await fs.promises.rm(TEST_DIR, { recursive: true, force: true })
})

beforeEach(() => {
  vi.clearAllMocks()
  openResume.mockResolvedValue(resumeWithSummary())
  generateObject.mockReset()
  streamText.mockReset()
})

describe('runGrammar（F8）', () => {
  it('selection 无 text → CONFIG_INVALID', async () => {
    await expect(runGrammar({ resumeId: 'r1', scope: 'selection' } as never)).rejects.toMatchObject({
      code: 'CONFIG_INVALID'
    })
  })

  it('selection 返回过滤后的 issues（越界条目剔除）', async () => {
    generateObject.mockResolvedValue({
      object: [
        { from: 0, to: 2, message: '错别字', suggestion: '修' },
        { from: 0, to: 99, message: '越界', suggestion: 'x' } // to > text.length → 剔除
      ]
    })
    const out = (await runGrammar({ resumeId: 'r1', scope: 'selection', text: 'abc' })) as GrammarIssue[]
    expect(out).toHaveLength(1)
    expect(out[0].message).toBe('错别字')
  })

  it('full 逐字段收集并调用 generateObject', async () => {
    generateObject.mockResolvedValue({ object: [{ from: 0, to: 4, message: '语病', suggestion: '改' }] })
    const out = (await runGrammar({ resumeId: 'r1', scope: 'full' })) as Array<GrammarIssue & { field: string }>
    expect(generateObject).toHaveBeenCalled()
    expect(out.some((g) => g.field === 'work[0].summary')).toBe(true)
  })
})

describe('runIntro（F20）', () => {
  it('translate 空 summary → CONFIG_INVALID', async () => {
    openResume.mockResolvedValue(createEmptyResume())
    await expect(runIntro({ requestId: 'rid-1', resumeId: 'r1', mode: 'translate' }, () => {})).rejects.toMatchObject({
      code: 'CONFIG_INVALID'
    })
  })

  it('generate 流式返回全文', async () => {
    streamText.mockResolvedValue(mockStream(['你好', '世界']))
    const deltas: string[] = []
    const full = await runIntro({ requestId: 'rid-2', resumeId: 'r1', mode: 'generate' }, (d) => deltas.push(d))
    expect(full).toBe('你好世界')
    expect(deltas).toEqual(['你好', '世界'])
  })

  it('translate 空简历 summary 存在时正常翻译（含铁律片段）', async () => {
    const resume = resumeWithSummary()
    resume.summary.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '中文简介' }] }] }
    openResume.mockResolvedValue(resume)
    streamText.mockResolvedValue(mockStream(['English summary.']))
    const promptArg = streamText.mock.calls[0]?.[0] as { prompt: string }
    void promptArg
    const full = await runIntro({ requestId: 'rid-3', resumeId: 'r1', mode: 'translate' }, () => {})
    expect(full).toBe('English summary.')
    // 翻译铁律已附加
    const call = streamText.mock.calls[0]?.[0] as { prompt?: string }
    expect(call?.prompt).toContain('忠实翻译')
  })
})

describe('runPolish（F7）', () => {
  it('空 text → CONFIG_INVALID', async () => {
    await expect(runPolish({ requestId: 'rid-4', resumeId: 'r1', field: 'summary.content', text: '   ' }, () => {})).rejects.toMatchObject({
      code: 'CONFIG_INVALID'
    })
  })

  it('正常流式；jobId 注入 requirements（岗位存在时）', async () => {
    getJob.mockResolvedValue({ id: 'j1', name: '后端', appliedAt: '2026-01', requirements: '熟悉 Node.js', createdAt: '', updatedAt: '' })
    streamText.mockResolvedValue(mockStream(['润色', '结果']))
    const full = await runPolish({ requestId: 'rid-5', resumeId: 'r1', field: 'summary.content', text: '做后端', jobId: 'j1' }, () => {})
    expect(full).toBe('润色结果')
    const call = streamText.mock.calls[0]?.[0] as { prompt?: string }
    expect(call?.prompt).toContain('熟悉 Node.js')
  })
})

describe('runMatch（F9）', () => {
  it('无 JD（岗位无 requirements 且无 targetJobDescription）→ CONFIG_INVALID', async () => {
    getJob.mockResolvedValue({ id: 'j1', name: '后端', appliedAt: '', requirements: '', createdAt: '', updatedAt: '' })
    await expect(runMatch({ resumeId: 'r1', jobId: 'j1' })).rejects.toMatchObject({ code: 'CONFIG_INVALID' })
  })

  it('岗位 requirements 作为 JD 并返回 MatchScore', async () => {
    getJob.mockResolvedValue({ id: 'j1', name: '后端', appliedAt: '', requirements: 'Node.js', createdAt: '', updatedAt: '' })
    generateObject.mockResolvedValue({
      object: { overall: 80, dimensions: [{ name: '技能', score: 80, comment: 'ok' }], suggestions: [] }
    })
    const score = await runMatch({ resumeId: 'r1', jobId: 'j1' })
    expect(score.overall).toBe(80)
  })

  it('targetJobDescription 兼容兜底', async () => {
    const resume = resumeWithSummary()
    resume.targetJobDescription = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '兜底 JD' }] }] }
    openResume.mockResolvedValue(resume)
    getJob.mockResolvedValue({ id: 'j1', name: '后端', appliedAt: '', requirements: '', createdAt: '', updatedAt: '' })
    generateObject.mockResolvedValue({
      object: { overall: 60, dimensions: [], suggestions: [] }
    })
    await runMatch({ resumeId: 'r1', jobId: 'j1' })
    const call = generateObject.mock.calls[0]?.[0] as { prompt?: string }
    expect(call?.prompt).toContain('兜底 JD')
  })
})
