#!/usr/bin/env node
/**
 * i18n_check.mjs —— P1-9 zh/en 键集合对称校验（2026-08-21）
 * 用法：node scripts/i18n_check.mjs（exit 0 = 对称；exit 1 = 有缺失，打印清单）
 * CI/收口可跑；类型化 resources.d.ts 迁移另行推进（动态 key 点多，见偏差登记）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIR = path.resolve(HERE, '../src/renderer/src/i18n')
const zh = JSON.parse(fs.readFileSync(path.join(DIR, 'zh-CN.json'), 'utf8'))
const en = JSON.parse(fs.readFileSync(path.join(DIR, 'en.json'), 'utf8'))

function flat(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flat(v, key, out)
    else out.add(key)
  }
  return out
}

const zk = flat(zh)
const ek = flat(en)
const missEn = [...zk].filter((k) => !ek.has(k))
const missZh = [...ek].filter((k) => !zk.has(k))

if (missEn.length === 0 && missZh.length === 0) {
  console.log(`i18n check ok: ${zk.size} keys, zh/en symmetric`)
} else {
  if (missEn.length) console.error(`missing in en.json (${missEn.length}):\n  ` + missEn.join('\n  '))
  if (missZh.length) console.error(`missing in zh-CN.json (${missZh.length}):\n  ` + missZh.join('\n  '))
  process.exit(1)
}
