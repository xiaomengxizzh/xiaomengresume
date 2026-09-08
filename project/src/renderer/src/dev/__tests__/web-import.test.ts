/**
 * web-import 测试 —— web 端导入管线的纯逻辑与解析链路（node 环境）。
 * PDF 用例以程序化构造的最小 PDF（ASCII 文本、正确 xref）走完整链路：
 * parse-core（unpdf/pdf.js）→ rulesDraftLocal（B 档规则）→ ImportDraft。
 * 真实简历样本不入库（PII 铁律：fixture 一律合成）。
 */
import { describe, expect, it } from 'vitest'
import { htmlToPlainText, parseFile } from '../web-import'
import sample from '../../../../shared/sample-resume.json'

/** 构造最小合法 PDF（全 ASCII，偏移量程序化计算） */
function buildMinimalPdf(textLines: string[]): Uint8Array {
  const content = textLines
    .map((t, i) => `BT /F1 18 Tf 40 ${760 - i * 24} Td (${t.replace(/[\\()]/g, '\\$&')}) Tj ET`)
    .join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xrefStart = body.length
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  return new TextEncoder().encode(body + xref + trailer)
}

describe('htmlToPlainText（docx.ts 同步副本）', () => {
  it('块级标签转行、li 加符号、实体解码、空行合并', () => {
    const html = '<p>姓名: 王晨</p><ul><li>经验一</li><li>经验二</li></ul><div>A&amp;B</div>'
    expect(htmlToPlainText(html)).toBe('姓名: 王晨\n• 经验一\n• 经验二\nA&B')
  })
})

describe('parseFile（渲染端导入管线）', () => {
  it('JSON：migrate 校验通过 → 草稿（零警告）', async () => {
    const file = new File([JSON.stringify(sample)], 'resume.json', { type: 'application/json' })
    const draft = await parseFile(file, 'json')
    expect(draft.format).toBe('json')
    expect(draft.warnings).toEqual([])
    expect(draft.resume.basics.name.length).toBeGreaterThan(0)
    expect(draft.sourcePreview.length).toBeGreaterThan(0)
  })

  it('JSON：非法 schema → 抛 PARSE_FAILED', async () => {
    const file = new File(['{"hello":"world"}'], 'bad.json', { type: 'application/json' })
    await expect(parseFile(file, 'json')).rejects.toMatchObject({ code: 'PARSE_FAILED' })
  })

  it('PDF：unpdf 抽文本 → B 档规则草稿（localRules 警告）', async () => {
    // 有效字符须 ≥ PDF_TEXT_MIN_CHARS(100) 才不判为扫描件
    const lines = [
      'Wang Chen',
      'Sales Manager',
      'Work Experience',
      'Account Executive',
      'Key account management and CRM',
      'Team leadership and mentoring',
      'Data analysis and business reporting',
      'Solution selling for SaaS products',
      'Contract negotiation and bidding',
      'Customer retention and renewal'
    ]
    const bytes = buildMinimalPdf(lines)
    const file = new File([new Uint8Array(bytes)], 'resume.pdf', { type: 'application/pdf' })
    const draft = await parseFile(file, 'pdf')
    expect(draft.format).toBe('pdf')
    expect(draft.sourcePreview).toContain('Wang Chen')
    expect(draft.warnings).toContain('import.warning.localRules')
    expect(draft.needsVision).toBeUndefined()
  })

  it('PDF：扫描件（无文本层）→ needsVision 占位草稿', async () => {
    // 只含一条短文本（有效字符 < PDF_TEXT_MIN_CHARS=100）→ 分流为视觉识别占位
    const bytes = buildMinimalPdf(['hi'])
    const file = new File([new Uint8Array(bytes)], 'scanned.pdf', { type: 'application/pdf' })
    const draft = await parseFile(file, 'pdf')
    expect(draft.needsVision).toBe(true)
    expect(draft.warnings).toContain('import.warning.scanned')
  })
})
