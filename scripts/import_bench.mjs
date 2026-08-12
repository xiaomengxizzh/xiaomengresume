/**
 * import_bench.mjs —— 导入 B 档评测（2026-08-12 批 6，天池三级加权 F1）
 * 真实链路：unpdf 抽文本 → B 档 rules.ts（splitBySectionAnchors → rulesToImportMap，线上源码零 mock）
 * 评测指标（天池三级）：
 *   单值字段（basics 9 项）：归一化后精确匹配，命中 1 否则 0
 *   列表字段（counts 4 项）：条数多集匹配（相等 1 否则 0）
 *   （本测试集无长文本字段期望，长文本级预留）
 * 汇总：按 S1/S2/S3 分组 + 版式分类统计 F1；输出每份命中/缺失/多余。
 * 用法：node import_bench.mjs [--dump]（--dump 打印每份识别结果明细）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BASE = path.resolve(HERE, '../material/import-cases')
const require = createRequire(path.resolve(HERE, '../project/package.json'))
const { extractText, getDocumentProxy } = await import(pathToFileURL(require.resolve('unpdf')).href)
const { splitBySectionAnchors, rulesToImportMap } = await import(pathToFileURL(require.resolve('../project/src/main/import/rules.ts')).href)

const DUMP = process.argv.includes('--dump')

/** 归一化：去空白/大小写/常见标点（电话/邮箱比较用） */
const norm = (s) => String(s ?? '').replace(/\s+/g, '').replace(/[()\-+.]/g, '').toLowerCase()

/** 单值字段精确匹配（命中 1/0）——expected null 视为不要求该字段（跳过） */
function exact(expected, actual) {
  if (expected === null || expected === undefined || expected === '') return null // 不要求
  if (!actual) return 0
  return norm(expected) === norm(actual) ? 1 : 0
}

const SCORED_BASICS = ['name', 'phone', 'email', 'address', 'location', 'website', 'birthDate', 'employmentStatus', 'headline']
const SCORED_COUNTS = ['education', 'work', 'projects', 'skills']

const groups = { s1: [], s2: [], s3: [] }

function classify(rel) {
  if (rel.startsWith('s1/')) return 's1'
  if (rel.startsWith('s2/')) return 's2'
  return 's3'
}

// 遍历所有 pdf（含 expected.json）
const files = []
for (const sub of ['s1', 's2', 's3/linkedin', 's3/bjherger']) {
  const dir = path.join(BASE, sub)
  if (!fs.existsSync(dir)) continue
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.pdf'))) {
    files.push({ rel: `${sub}/${f}`, pdf: path.join(dir, f), expected: path.join(dir, f.replace(/\.pdf$/, '.expected.json')) })
  }
}

const allRows = []

for (const { rel, pdf, expected: expFile } of files) {
  const group = classify(rel)
  if (!fs.existsSync(expFile)) {
    console.warn(`⚠ 缺 expected: ${rel}`)
    continue
  }
  const exp = JSON.parse(fs.readFileSync(expFile, 'utf8'))
  const buf = fs.readFileSync(pdf)
  const proxy = await getDocumentProxy(new Uint8Array(buf))
  const { text } = await extractText(proxy, { mergePages: true })
  const sections = splitBySectionAnchors(text || '')
  const map = rulesToImportMap(sections)
  const actual = map.basics ?? {}

  // 单值字段
  const basicsScores = {}
  let basicsTotal = 0, basicsHits = 0
  for (const k of SCORED_BASICS) {
    const s = exact(exp.basics?.[k], actual[k])
    if (s !== null) {
      basicsTotal++
      basicsHits += s
      basicsScores[k] = s
    }
  }
  const basicsF1 = basicsTotal ? basicsHits / basicsTotal : null

  // 列表字段（counts 条数多集匹配）
  const countScores = {}
  let cntTotal = 0, cntHits = 0
  for (const k of SCORED_COUNTS) {
    const e = exp.counts?.[k]
    if (e === null || e === undefined) continue
    const a = map[k]?.length ?? 0
    const s = a === e ? 1 : 0
    cntTotal++
    cntHits += s
    countScores[k] = { exp: e, act: a, hit: s }
  }
  const countsF1 = cntTotal ? cntHits / cntTotal : null

  // 总分 = 单值 + 列表字段平均（天池加权：本次单值 9 + 列表 4 均等权重）
  const denom = (basicsTotal || 0) + (cntTotal || 0)
  const f1 = denom ? (basicsHits + cntHits) / denom : null

  // 缺失/多余（诊断）
  const missing = SCORED_BASICS.filter((k) => exp.basics?.[k] && !actual[k])
  const extra = Object.keys(actual).filter((k) => SCORED_BASICS.includes(k) && !exp.basics?.[k])

  allRows.push({ rel, group, basicsF1, countsF1, f1, basicsScores, countScores, missing, extra })
  if (DUMP) {
    console.log(`${rel}\n  basics F1=${basicsF1?.toFixed(2) ?? '-'} counts F1=${countsF1?.toFixed(2) ?? '-'} 总=${f1?.toFixed(2) ?? '-'}`)
    if (missing.length) console.log('  缺失:', missing.join(','))
    if (extra.length) console.log('  多余:', extra.join(','))
  }
}

// ── 汇总 ──
console.log('\n================ B 档评测汇总（天池三级 F1） ================')
console.log('样本总数:', allRows.length)
for (const g of ['s1', 's2', 's3']) {
  const rows = allRows.filter((r) => r.group === g)
  if (!rows.length) continue
  const f1s = rows.map((r) => r.f1).filter((x) => x !== null)
  const bf1 = rows.map((r) => r.basicsF1).filter((x) => x !== null)
  const cf1 = rows.map((r) => r.countsF1).filter((x) => x !== null)
  const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : '-')
  console.log(`\n[${g.toUpperCase()}] n=${rows.length} | 总F1均值=${avg(f1s)} | basics均值=${avg(bf1)} | counts均值=${avg(cf1)}`)
}

// 每份明细表
console.log('\n───── 每份明细 ─────')
for (const r of allRows) {
  console.log(`${r.f1?.toFixed(2) ?? '--'}  ${r.group}  ${r.rel.replace(/\.pdf$/, '').padEnd(48)} basics=${r.basicsF1?.toFixed(2) ?? '--'} counts=${r.countsF1?.toFixed(2) ?? '--'}${r.missing.length ? ' 缺[' + r.missing.join('/') + ']' : ''}${r.extra.length ? ' 多[' + r.extra.join('/') + ']' : ''}`)
}

// 按 F1 排序找 badcase
const ranked = [...allRows].filter((r) => r.f1 !== null).sort((a, b) => a.f1 - b.f1)
console.log('\n───── badcase（F1 最低 10 份，识别差 → 回归层候选） ─────')
for (const r of ranked.slice(0, 10)) {
  console.log(`${r.f1.toFixed(2)}  ${r.rel.replace(/\.pdf$/, '')}  缺[${r.missing.join('/') || '-'}]`)
}
