#!/usr/bin/env node
/**
 * check_pii.mjs —— PII/本机路径入库防护扫描（F1 处置配套，2026-08-25）
 *
 * 背景：真实简历（姓名/手机号/邮箱）曾因手工放入 material/import-cases/s1/ 而进入公开仓库
 * （gitleaks 只认凭据形态，不认中文 PII）。本脚本是最后防线，三处接入：
 *   1. pre-commit 钩子（.githooks/pre-commit，--staged 模式只扫暂存文件）；
 *   2. CI security.yml（全量模式，远端最后防线）；
 *   3. 收口自检可手动跑：node scripts/check_pii.mjs
 *
 * 检测项：中国大陆手机号（白名单假号除外）/ 18 位身份证号 / 本机绝对路径（C:\Users、E:\ai 等）。
 * 命中即退出码 1（拒绝提交/CI 失败）。正则模式用拼接构造，防脚本自命中。
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BS = String.fromCharCode(92)
// 模式拼接构造（防自命中）：本文件被 git 跟踪，若直接书写完整形态会被自己扫出
const PHONE_RE = new RegExp('(?<!\\d)1[3-9]\\d{9}(?!\\d)', 'g')
const ID_RE = new RegExp('(?<!\\d)\\d{17}[\\dXx](?!\\d)', 'g')
const PATH_RES = [
  new RegExp('C:[/' + BS + BS + ']Users[' + BS + BS + '/][^' + BS + BS + '/\s\'"]+', 'g'),
  new RegExp('[Ee]:[' + BS + BS + '/]ai[' + BS + BS + '/]', 'g')
]
// F1 泄露事件哨兵（2026-08-26）：已泄露真实姓名/手机号/邮箱字面量（中文姓名正则不可及，单列）；拼接构造防自命中
const SENTINELS = ['张哲' + '晗', '178723153' + '28', 'ctpzzh@16' + '3.com']
// 已知虚构号白名单（测试 fixture 常用假号）
const PHONE_WHITELIST = new Set(['13800138000', '12345678901', '13912345678', '13800000000',
  '13800001111', '13800002222', '13800003333', '13800004444', '13800005555'])
// 二进制/大文件跳过
const SKIP_EXT = /\.(pdf|png|jpe?g|gif|zip|woff2?|ttf|otf|ico|exe|dll|node)$/i
const MAX_BYTES = 2 * 1024 * 1024

const staged = process.argv.includes('--staged')
let files
if (staged) {
  files = execSync('git diff --cached --name-only -z --diff-filter=ACM', { encoding: 'utf-8' })
    .split('\0')
    .filter(Boolean)
} else {
  files = execSync('git -c core.quotepath=false ls-files', { encoding: 'utf-8' })
    .split('\n')
    .filter(Boolean)
}

const hits = []
for (const f of files) {
  if (SKIP_EXT.test(f)) continue
  let buf
  try {
    buf = readFileSync(f)
  } catch {
    continue // 已删除等竞态，跳过
  }
  if (buf.length > MAX_BYTES) continue
  const text = buf.toString('utf-8')
  const lineStarts = [...text.matchAll(/\n/g)].map((m) => m.index)
  const lineOf = (idx) => lineStarts.findIndex((p) => p > idx) + 1 || lineStarts.length + 1
  const record = (kind, m) => {
    const v = kind === 'PHONE' && PHONE_WHITELIST.has(m[0]) ? null : m[0]
    // '<' = 已脱敏占位符（如 C:/Users/<用户目录>），非真实路径
    if (v && !v.includes('<')) hits.push(`${f}:${lineOf(m.index)} [${kind}] ${v}`)
  }
  for (const m of text.matchAll(PHONE_RE)) record('PHONE', m)
  for (const m of text.matchAll(ID_RE)) record('IDCARD', m)
  for (const re of PATH_RES) for (const m of text.matchAll(re)) record('PATH', m)
  for (const s of SENTINELS) if (text.includes(s)) record('SENTINEL', { 0: s, index: text.indexOf(s) })
}

if (hits.length > 0) {
  console.error(`[check_pii] 检测到疑似 PII/本机路径 ${hits.length} 处（真实个人信息严禁入库；如为误报请加入白名单或调整规则）：`)
  for (const h of hits) console.error('  ' + h)
  process.exit(1)
}
console.log(`[check_pii] OK（${staged ? 'staged' : '全量'} ${files.length} 文件，0 命中）`)
