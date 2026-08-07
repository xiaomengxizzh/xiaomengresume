#!/usr/bin/env node
/**
 * gen_api_docs.mjs —— 从 src/shared/（契约唯一事实源）自动生成 API 参考文档
 *
 * 铁律（《项目规范.md》§五.7，2026-08-08 定案）：
 *   API 参考文档禁止手写维护；src/shared/ 变更后必须重跑本脚本，生成产物随代码同步提交。
 *
 * 用法：
 *   node scripts/gen_api_docs.mjs                # 默认输出到 ../../file/detail/api/
 *   node scripts/gen_api_docs.mjs --out <dir>    # 自定义输出目录
 *
 * 实现：零依赖纯文本解析（不引入 zod-to-json-schema 等新依赖，符合 G.2 依赖纪律）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const SHARED_DIR = join(PROJECT_ROOT, 'src', 'shared')
const argOutIdx = process.argv.indexOf('--out')
const OUT_DIR = argOutIdx !== -1 ? resolve(process.argv[argOutIdx + 1]) : resolve(PROJECT_ROOT, '..', 'file', 'detail', 'api')

// ── 工具 ───────────────────────────────────────────────────────────────────

function readTs(rel) {
  return readFileSync(join(SHARED_DIR, rel), 'utf8')
}

/** 提取文件头 JSDoc（/** ... *\/，取第一块） */
function fileHeader(src) {
  const m = src.match(/^\/\*\*([\s\S]*?)\*\//)
  return m ? m[1].replace(/^\s*\* ?/gm, '').trim() : ''
}

/** 提取 `/** ... *\/` 单行注释内容（前置注释行） */
function lineDoc(src, lineIdx) {
  for (let i = lineIdx - 1; i >= 0; i--) {
    const t = src[i].trim()
    if (t.startsWith('/**') || t.startsWith('*')) {
      if (t.startsWith('/**')) return t.replace(/^\/\*\* ?/, '').replace(/\*\/$/, '').trim()
    } else if (t === '' || t === '*/') {
      continue
    } else {
      break
    }
  }
  return ''
}

// ── 1. IPC 通道 ────────────────────────────────────────────────────────────

function parseIpc(src) {
  const header = fileHeader(src)
  const namespaces = []
  const block = src.match(/const IPC = \{([\s\S]*?)\} as const/)
  if (!block) return { header, namespaces }
  const lines = block[1].split('\n')
  let ns = null
  for (const line of lines) {
    const nsM = line.match(/^ {2}(\w+): \{/)
    if (nsM) {
      ns = { name: nsM[1], doc: '', channels: [] }
      // 命名空间前置注释：回看上方行
      const idx = lines.indexOf(line)
      ns.doc = lineDoc(lines, idx)
      namespaces.push(ns)
      continue
    }
    if (ns && /^ {2}\},?$/.test(line.trim() === '' ? '' : line)) {
      if (/^ {2}\}$/.test(line)) ns = null
      continue
    }
    if (ns) {
      const chM = line.match(/^ {4}(\w+): '([^']+)'/)
      if (chM) {
        const idx = lines.indexOf(line)
        ns.channels.push({ key: chM[1], channel: chM[2], doc: lineDoc(lines, idx) })
      }
    }
  }
  return { header, namespaces }
}

// ── 2. Zod schema ──────────────────────────────────────────────────────────

/** 从 src 中提取文件头注释 + 全部 export const 定义 */
function parseSchemaFile(src) {
  const header = fileHeader(src)
  const exports = []
  const re = /export const (\w+)(?::[^=]+)? = (z\.[\s\S]*?)(?=\nexport const|\nexport type|\n\/\*|\n\/\/|\nimport |\n\s*$)/g
  let m
  while ((m = re.exec(src)) !== null) {
    const name = m[1]
    let body = m[2].trim()
    // 截断到第一个顶层 `)` 后跟可选 `,\n` 或 `\n\})`：取合理长度内的首个完整声明
    body = body.split('\n').slice(0, 40).join('\n')
    exports.push({ name, body, doc: lineDoc(src.split('\n'), src.split('\n').indexOf(m[0].split('\n')[0]) + 1) })
  }
  return { header, exports }
}

function renderSchemaDoc(rel, src) {
  const { header, exports } = parseSchemaFile(src)
  let out = `# ${rel}（Zod 数据模型 · 自动生成）\n\n`
  out += `> 本文件由 \`scripts/gen_api_docs.mjs\` 自动生成，**禁止手写**。事实源 = \`src/shared/${rel}\`。\n\n`
  if (header) out += `${header}\n\n`
  out += `## 导出\n\n`
  if (exports.length === 0) out += '_（无导出 schema 常量）_\n\n'
  for (const e of exports) {
    out += `### \`${e.name}\`\n\n`
    if (e.doc) out += `${e.doc}\n\n`
    out += '```ts\n' + e.body + '\n```\n\n'
  }
  return out
}

// ── 主流程 ────────────────────────────────────────────────────────────────

mkdirSync(OUT_DIR, { recursive: true })

// IPC 通道
const ipcSrc = readTs('ipc-channels.ts')
const ipc = parseIpc(ipcSrc)
let ipcMd = `# IPC 通道契约（自动生成）\n\n`
ipcMd += `> 本文件由 \`scripts/gen_api_docs.mjs\` 自动生成，**禁止手写**。事实源 = \`src/shared/ipc-channels.ts\`（契约冻结区，变更需组长批准，见《项目规范.md》§三.8）。\n\n`
if (ipc.header) ipcMd += `${ipc.header}\n\n`
ipcMd += `## 通道总览\n\n| 命名空间 | 通道 | 说明 |\n|---|---|---|\n`
for (const ns of ipc.namespaces) {
  for (const ch of ns.channels) {
    ipcMd += `| ${ns.name} | \`${ch.channel}\` | ${ch.doc.replace(/\|/g, '\\|') || '—'} |\n`
  }
}
ipcMd += `\n## 分命名空间明细\n\n`
for (const ns of ipc.namespaces) {
  ipcMd += `### ${ns.name}\n\n`
  if (ns.doc) ipcMd += `${ns.doc}\n\n`
  if (ns.channels.length === 0) {
    ipcMd += '_（暂无通道）_\n\n'
    continue
  }
  for (const ch of ns.channels) {
    ipcMd += `- \`${ch.key}\` → \`${ch.channel}\`${ch.doc ? '：' + ch.doc : ''}\n`
  }
  ipcMd += `\n`
}

// 类型（interface / type 别名）
const ifaceRe = /export (?:interface (\w+)|type (\w+))\s*=?\s*\{([\s\S]*?)\n\}/g
let m
const ifaces = []
while ((m = ifaceRe.exec(ipcSrc)) !== null) {
  const body = m[3]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n')
  ifaces.push({ name: m[1] || m[2], body })
}
if (ifaces.length > 0) {
  ipcMd += `## 返回类型\n\n`
  for (const it of ifaces) {
    ipcMd += `### \`${it.name}\`\n\n\`\`\`ts\n${it.body.trim()}\n\`\`\`\n\n`
  }
}

writeFileSync(join(OUT_DIR, 'ipc-channels.md'), ipcMd, 'utf8')

// Zod schema
const schemaFiles = ['resume.ts', 'job.ts', 'settings.ts']
for (const rel of schemaFiles) {
  const src = readTs(join('schema', rel))
  writeFileSync(join(OUT_DIR, `schema-${rel.replace('.ts', '')}.md`), renderSchemaDoc(`schema/${rel}`, src), 'utf8')
}

// API 目录索引
let idx = `# API 参考（自动生成 · 勿手写）\n\n`
idx += `> 事实源 = \`project/src/shared/\`；改动契约后重跑 \`node scripts/gen_api_docs.mjs\`（《项目规范.md》§五.7）。\n\n`
idx += `| 文件 | 内容 |\n|---|---|\n`
idx += `| ipc-channels.md | IPC 通道契约（命名空间/通道名/说明）+ 返回类型 |\n`
idx += `| schema-resume.md | 简历数据模型（ResumeSchema 及子结构） |\n`
idx += `| schema-job.md | 岗位目录数据模型 |\n`
idx += `| schema-settings.md | 应用设置数据模型 |\n`
writeFileSync(join(OUT_DIR, 'README.md'), idx, 'utf8')

console.log(`[gen_api_docs] 生成完成 → ${OUT_DIR}`)
console.log(`  - ipc-channels.md（${ipc.namespaces.length} 命名空间）`)
console.log(`  - schema-{resume,job,settings}.md`)
