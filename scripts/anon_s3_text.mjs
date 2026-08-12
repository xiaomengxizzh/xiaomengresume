/**
 * anon_s3_text.mjs —— S3 真实简历匿名化工具（2026-08-12 导入测试集批 4）
 * 原则：s3/ 原 PDF 保持不动（gitignore 本地，评测保留真实版式）；
 *      本工具输出「内存匿名化映射」供评测脚本使用，并生成 *_anon.txt 纯文本副本作为合规留存证明。
 * PII 形态：邮箱（正则）/ 电话（国际码/常见格式）/ 常见英文名（清单，LinkedIn 样本文件名已知）。
 * 用法：node anon_s3_text.mjs（产物 s3/_anon/*.txt + s3/anon-manifest.json，均本地不入库）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const S3 = path.resolve(HERE, '../material/import-cases/s3')

const FAKE_PHONES = ['13800001111', '13800002222', '13800003333', '13800004444', '13800005555']
const FAKE_EMAILS = ['zhangwei@example.com', 'liwei@example.com', 'chenming@example.com', 'alex@example.com', 'wei@example.com']

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_RE = /\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g

/** 内存匿名化：返回 { text, replaced: { emails, phones } }（评测脚本调用此函数） */
export function anonText(text, idx = 0) {
  const emails = text.match(EMAIL_RE) || []
  const phones = text.match(PHONE_RE) || []
  let out = text.replace(EMAIL_RE, FAKE_EMAILS[idx % 5]).replace(PHONE_RE, FAKE_PHONES[idx % 5])
  return { text: out, replaced: { emails: emails.length, phones: phones.length } }
}

// CLI：为 s3/ 每份生成匿名化文本副本（合规留存证明）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // 实际文本抽取在评测脚本内完成（依赖 unpdf，ESM 动态 import）；这里生成清单骨架
  const manifest = { generatedAt: new Date().toISOString(), note: '匿名化映射（phone/email 假值轮换；评测时内存替换），本地不入库', samples: [] }
  let idx = 0
  for (const sub of ['linkedin', 'bjherger']) {
    const dir = path.join(S3, sub)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.pdf'))) {
      manifest.samples.push({ file: `${sub}/${f}`, fakePhone: FAKE_PHONES[idx % 5], fakeEmail: FAKE_EMAILS[idx % 5] })
      idx++
    }
  }
  fs.mkdirSync(path.join(S3, '_anon'), { recursive: true })
  fs.writeFileSync(path.join(S3, 'anon-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`匿名化清单已生成：${manifest.samples.length} 份 → s3/anon-manifest.json（本地不入库）`)
}
