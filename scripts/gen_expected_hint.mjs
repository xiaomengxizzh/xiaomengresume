/**
 * gen_expected_hint.mjs —— S2/S3 ground truth 半自动标注辅助（2026-08-12 批 5）
 * 作用：抽文本 → 正则提取「机器可靠」字段（phone/email/website）→ 写 *.expected.json 草稿
 *       （仅含可靠字段；name/address/location/birthDate/employmentStatus/headline/counts 标 null 待人工核对）
 * 产出：每份 *.expected.json + 汇总待核对清单（stdout）。
 * 人工核对流程：对每份 PDF 抽出的文本（--dump 看原文）逐项确认后补填。
 * 用法：node gen_expected_hint.mjs [--dump <文件>]  （默认扫描 s1/s2/s3 全部）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE = path.resolve(HERE, '../material/import-cases')
// unpdf 在 project/node_modules；用 project 的 require 解析出路径再 ESM import（Windows 路径需 file:// URL）
const require = createRequire(path.resolve(HERE, '../project/package.json'))
const { extractText, getDocumentProxy } = await import(pathToFileURL(require.resolve('unpdf')).href)

const PHONE_RE = /1[3-9]\d{9}|0\d{2,3}-\d{7,8}|\+?\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const WEB_RE = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|cn|net|org|io|dev|me|github\.io)(?:\/[^\s]*)?/gi

function extractHints(text) {
  const hints = {}
  const phone = text.match(PHONE_RE)
  const email = text.match(EMAIL_RE)
  const web = text.match(WEB_RE)
  if (phone) hints.phone = phone[0]
  if (email) hints.email = email[0].toLowerCase()
  if (web) {
    // 去掉尾部标点
    hints.website = web[0].replace(/[),.;，。]+$/, '')
  }
  return hints
}

// --dump 模式：打印某份 PDF 的抽取文本（人工核对用）
const dumpArg = process.argv.findIndex((a) => a === '--dump')
if (dumpArg >= 0 && process.argv[dumpArg + 1]) {
  const rel = process.argv[dumpArg + 1]
    const buf = fs.readFileSync(path.join(BASE, rel))
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(pdf, { mergePages: true })
  console.log(`===== ${rel} 抽取文本 =====\n${text}\n===== 结束 =====`)
  process.exit(0)
}

// 默认：扫描并写草稿
const subDirs = ['s2', 's3/linkedin', 's3/bjherger']
let total = 0
for (const sub of subDirs) {
  const dir = path.join(BASE, sub)
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.pdf')).sort()) {
    try {
      const buf = fs.readFileSync(path.join(dir, f))
      const pdf = await getDocumentProxy(new Uint8Array(buf))
      const { text } = await extractText(pdf, { mergePages: true })
      const hints = extractHints(text || '')
      const expected = {
        basics: {
          name: null, phone: hints.phone ?? null, email: hints.email ?? null,
          address: null, location: null, website: hints.website ?? null,
          birthDate: null, employmentStatus: null, headline: null
        },
        counts: { education: null, work: null, projects: null, skills: null },
        _hint: true // 标记为半自动草稿，人工核对后删除此字段
      }
      const out = path.join(dir, f.replace(/\.pdf$/, '.expected.json'))
      fs.writeFileSync(out, JSON.stringify(expected, null, 2))
      total++
      const phone = hints.phone ? '✓' : '·'
      const email = hints.email ? '✓' : '·'
      const web = hints.web ? '✓' : '·'
      console.log(`${phone}${email}${web} ${sub}/${f}`)
    } catch (e) {
      console.log(`✗ ${sub}/${f}: ${e.message.slice(0, 50)}`)
    }
  }
}
console.log(`\n半自动 expected 草稿 ${total} 份（S2/S3；含 _hint 标记，人工核对后移除）`)
console.log('核对：node gen_expected_hint.mjs --dump s2/xxx.pdf 看原文')
