/**
 * gen_expected_s1.mjs —— S1 ground truth 生成（2026-08-12 批 5）
 * S1 = 王晨变体（同一份 sample-resume.json）→ expected.json 直接从数据源生成（真值已知）。
 * 字段口径 = B 档当前可识别字段（basics 9 项 + counts 4 项）。
 * 用法：node gen_expected_s1.mjs（写入 ../material/import-cases/s1/王晨_*.pdf 同名 expected.json）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const S1 = path.resolve(HERE, '../material/import-cases/s1')
const SAMPLE = JSON.parse(fs.readFileSync(path.resolve(HERE, '../project/src/shared/sample-resume.json'), 'utf8'))

const B = SAMPLE.basics
const expected = {
  basics: {
    name: B.name || null,
    phone: B.phone || null,
    email: B.email || null,
    address: B.address || null,
    location: B.location || null,
    website: B.website || null,
    birthDate: B.birthDate || null,
    employmentStatus: B.employmentStatus || null,
    headline: B.headline || null
  },
  counts: {
    education: SAMPLE.education.length,
    work: SAMPLE.work.length,
    projects: SAMPLE.projects.length,
    skills: SAMPLE.skills.length
  }
}

let n = 0
for (const f of fs.readdirSync(S1).filter((x) => x.endsWith('.pdf'))) {
  const out = path.join(S1, f.replace(/\.pdf$/, '.expected.json'))
  fs.writeFileSync(out, JSON.stringify(expected, null, 2))
  n++
  console.log('✓', f, '→', path.basename(out))
}
console.log(`S1 expected 生成 ${n} 份`)
