/**
 * 数据路径工具 —— F2 数据路径体系（2026-08-07 增补 · 三合一核心资产）
 * 服务 F3 撤销栈 / F7-F10 AI 定位 / 预览反查。
 *
 * 路径形态（section 名以 F1 schema 为准，如 `basics`）：
 *   'basics.name'                  → 单对象字段
 *   'basics.customFields[0]'       → 数组条目
 *   'education[1].description'     → 列表条目富文本
 *   'work[0].highlights[2]'        → 亮点数组元素（两层数组）
 *   'layout.themeColor'            → 排版参数（per-resume）
 *
 * 注意：F2 规格示例中的 'basic.name'（缺 s）为文档笔误，落码以 F1 schema
 * 命名（basics）为准，收口时同步文档（见《项目日志》M1 条目）。
 */
import type { Resume } from './schema/resume'

/** 数据路径：宽松起步，不做穷举联合类型 */
export type FieldPath = string

export interface ParsedPath {
  /** section 名（basics / summary / education / work / projects / skills / certificates / languages / layout） */
  section: string
  /** 数组条目下标（单对象 section 或无下标时为 undefined） */
  index?: number
  /** 余下字段段（可能含子数组下标，如 'highlights[2]'） */
  field: string
}

const PATH_RE = /^([A-Za-z_]\w*)(?:\[(\d+)\])?(?:\.(.+))?$/

/** 解析数据路径 → { section, index?, field } */
export function parsePath(path: FieldPath): ParsedPath {
  const m = PATH_RE.exec(path)
  if (!m) {
    throw new Error(`invalid data path: ${path}`)
  }
  const [, section, indexRaw, field = ''] = m
  const index = indexRaw === undefined ? undefined : Number(indexRaw)
  if (index !== undefined && index < 0) {
    throw new Error(`data path index out of range: ${path}`)
  }
  return { section, index, field }
}

/** 构建数据路径（index 省略 = 单对象字段） */
export function buildPath(section: string, index?: number, field?: string): FieldPath {
  const seg = `${section}${index === undefined ? '' : `[${index}]`}`
  return field ? `${seg}.${field}` : seg
}

/** 解析字段段中的子数组下标：'highlights[2]' → { field: 'highlights', index: 2 } */
export function parseFieldIndex(field: string): { field: string; index?: number } {
  const m = /^([A-Za-z_]\w*)(?:\[(\d+)\])?$/.exec(field)
  if (!m) {
    throw new Error(`invalid field segment: ${field}`)
  }
  const [, name, indexRaw] = m
  return { field: name, index: indexRaw === undefined ? undefined : Number(indexRaw) }
}

type UnknownRecord = Record<string, unknown>

/** 读取路径值（不存在返回 undefined） */
export function getByPath(target: unknown, path: FieldPath): unknown {
  const { section, index, field } = parsePath(path)
  const root = target as UnknownRecord | undefined
  if (!root || typeof root !== 'object' || !(section in root)) return undefined
  let cur: unknown = root[section]

  if (index !== undefined) {
    const arr = cur as unknown[] | undefined
    if (!Array.isArray(arr) || index >= arr.length) return undefined
    cur = arr[index]
  }

  if (!field) return cur
  const { field: fname, index: fIndex } = parseFieldIndex(field)
  if (!cur || typeof cur !== 'object') return undefined
  const obj = cur as UnknownRecord
  if (!(fname in obj)) return undefined
  cur = obj[fname]
  if (fIndex !== undefined) {
    const arr = cur as unknown[] | undefined
    if (!Array.isArray(arr) || fIndex >= arr.length) return undefined
    cur = arr[fIndex]
  }
  return cur
}

/** 写入路径值（中间对象缺失抛错；数组越界抛错） */
export function setByPath(target: Resume, path: FieldPath, value: unknown): void {
  const { section, index, field } = parsePath(path)
  const root = target as UnknownRecord
  if (!(section in root)) {
    throw new Error(`write failed: section not found ${section}`)
  }
  let cur: unknown = root[section]

  if (index !== undefined) {
    const arr = cur as unknown[] | undefined
    if (!Array.isArray(arr) || index >= arr.length) {
      throw new Error(`write failed: array index out of range ${path}`)
    }
    cur = arr[index]
  }

  if (!field) {
    throw new Error(`write failed: missing field segment ${path}`)
  }
  const { field: fname, index: fIndex } = parseFieldIndex(field)
  if (!cur || typeof cur !== 'object') {
    throw new Error(`write failed: intermediate node is not an object ${path}`)
  }
  const obj = cur as UnknownRecord
  if (fIndex !== undefined) {
    const arr = obj[fname] as unknown[] | undefined
    if (!Array.isArray(arr) || fIndex >= arr.length) {
      throw new Error(`write failed: array index out of range ${path}`)
    }
    arr[fIndex] = value
  } else {
    obj[fname] = value
  }
}
