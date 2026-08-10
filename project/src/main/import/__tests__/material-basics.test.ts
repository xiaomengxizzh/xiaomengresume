/**
 * material-basics.test.ts —— 2026-08-09 T2 回归：material 简历示例 PDF → B 档 rules 识别
 * 断言基本信息字段数（含职业 headline）——验证导入识别完整性（用户反馈少 3 个字段）。
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { extractPdfText } from '../pdf'
import { splitBySectionAnchors, rulesToImportMap } from '../rules'

const MATERIAL_PDF = path.resolve(import.meta.dirname, '../../../../../material/简历示例1.pdf')

describe('material 示例 PDF → B 档识别（T2 回归）', () => {
  it('识别 6+ 基本信息字段（姓名/电话/邮箱/地址/生日/在职 + 职业 headline）', async () => {
    const ext = await extractPdfText(MATERIAL_PDF)
    expect(ext.text.length).toBeGreaterThan(0)
    const sections = splitBySectionAnchors(ext.text)
    const map = rulesToImportMap(sections)
    expect(map.basics).toBeDefined()
    const b = map.basics ?? {}
    const found = ['name', 'phone', 'email', 'address', 'location', 'website', 'birthDate', 'employmentStatus', 'headline'].filter((k) => (b as Record<string, unknown>)[k])
    console.log('[T2] basics 识别字段:', found.join(', '))
    expect(found.length).toBeGreaterThanOrEqual(6)
    // 2026-08-10 修复断言：地址（北京市朝阳区，同行拆分）与职业（裸行 headline）必须命中
    expect(b.address).toBeTruthy()
    expect(b.address).toContain('朝阳区')
    expect(b.headline).toBeTruthy()
  })
})
