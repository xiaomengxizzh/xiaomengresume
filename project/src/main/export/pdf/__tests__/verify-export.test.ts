/**
 * verify-export.test.ts —— 导出核验（2026-08-10 修复批闭环，可重复执行）
 * a) 用 material 最新「项目导出简历示例.json」重新导出 PDF → material/核验导出_修复后.pdf
 * 输出 pageCount 供核验参考；断言 %PDF 魔数 + 字体子集含 Deng（修复验证）。
 */
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { ResumeSchema } from '../../../../shared/schema/resume'
import { buildTextPdf } from '../build'

const MATERIAL_DIR = path.resolve(process.cwd(), '../material')
const OUT = path.join(MATERIAL_DIR, '核验导出_修复后.pdf')

describe('导出核验（2026-08-10 修复批闭环）', () => {
  it('用 material 最新 JSON 重新导出 PDF 并写盘', async () => {
    const raw = JSON.parse(await fs.readFile(path.join(MATERIAL_DIR, '项目导出简历示例.json'), 'utf-8'))
    const resume = ResumeSchema.parse(raw)
    const { buffer, warnings, pageCount } = await buildTextPdf(resume, { language: 'zh-CN', privacyMode: false, pages: 'all' })
    await fs.mkdir(MATERIAL_DIR, { recursive: true })
    await fs.writeFile(OUT, buffer)
    console.log(`[verify-export] pageCount=${pageCount} bytes=${buffer.length} warnings=${warnings.join('|') || 'none'}`)
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    // P0-1 验证：默认字体体系 = 等线（Deng 子集嵌入）
    expect(buffer.toString('latin1')).toContain('Deng')
  })
})
