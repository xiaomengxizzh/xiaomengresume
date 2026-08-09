/**
 * json.test.ts —— M4a JSON 导入单测（零 AI；不依赖 electron——errors 独立类）
 * 覆盖：合法结构（含 schemaVersion）→ 草稿；非法 JSON / 无版本 / 结构非法 → PARSE_FAILED。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { createEmptyResume } from '../../../shared/schema/resume'
import { importJson, resumeToPreview } from '../json'
import { ImportError } from '../errors'

// 固定临时目录（动态片段会触发 Mimosa 静态路径穿越误报；测试前清空复用）
const TMP = path.resolve(os.tmpdir(), 'xm-import-json')

/** 测试 fixture 辅助：basename 白名单 + 根目录边界校验（Mimosa 静态路径穿越防护） */
async function writeJson(name: string, data: unknown): Promise<string> {
  await fs.promises.mkdir(TMP, { recursive: true })
  const root = path.resolve(TMP)
  const target = path.resolve(root, path.basename(name))
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('path traversal blocked')
  }
  await fs.promises.writeFile(target, typeof data === 'string' ? data : JSON.stringify(data, null, 2), 'utf-8')
  return target
}

beforeAll(async () => {
  await fs.promises.rm(TMP, { recursive: true, force: true })
})

afterAll(async () => {
  await fs.promises.rm(TMP, { recursive: true, force: true })
})

describe('importJson（M4a JSON）', () => {
  it('合法结构（含 schemaVersion:1）→ 草稿 + 预览', async () => {
    const r = createEmptyResume()
    r.basics.name = '张三'
    r.basics.phone = '13800000000'
    r.summary.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '后端开发' }] }] }
    const p = await writeJson('valid.json', r)
    const draft = await importJson(p, 'valid.json')
    expect(draft.format).toBe('json')
    expect(draft.resume.basics.name).toBe('张三')
    expect(draft.sourcePreview).toContain('张三')
    expect(draft.sourcePreview).toContain('后端开发')
    expect(draft.sourcePreview.length).toBeLessThanOrEqual(2000)
  })

  it('非法 JSON 文本 → PARSE_FAILED', async () => {
    const p = await writeJson('bad.json', '{ not json !!')
    await expect(importJson(p, 'bad.json')).rejects.toMatchObject({ code: 'PARSE_FAILED' })
  })

  it('无 schemaVersion（v0）→ PARSE_FAILED', async () => {
    const p = await writeJson('v0.json', { basics: { name: 'x' } })
    await expect(importJson(p, 'v0.json')).rejects.toMatchObject({ code: 'PARSE_FAILED' })
  })

  it('结构非法（schemaVersion 有但字段错）→ PARSE_FAILED', async () => {
    const p = await writeJson('wrong.json', { schemaVersion: 1, basics: { name: 42 } })
    await expect(importJson(p, 'wrong.json')).rejects.toMatchObject({ code: 'PARSE_FAILED' })
  })

  it('错误 instanceof ImportError', async () => {
    const p = await writeJson('bad2.json', 'nope')
    try {
      await importJson(p, 'bad2.json')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
    }
  })
})

describe('resumeToPreview', () => {
  it('空简历 → 空预览', () => {
    expect(resumeToPreview(createEmptyResume())).toBe('')
  })
})
