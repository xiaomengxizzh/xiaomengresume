/**
 * import/map.ts —— M4a AI 语义映射（A 档主路径；B 档兜底归 M4a.1）
 * 流程：createActiveModel()（复用 M3，四家+自定义）→ generateObject({ schema: ImportMapSchema })
 *   → importMapToResume()（宽松清洗 + migrate 收口）→ 草稿。
 * 信任底线（R2）：三步核对向导不可跳过；提示词硬约束「仅映射已有文本，禁编造」。
 * 错误：NO_PROVIDER / CONFIG_INVALID / TIMEOUT 等 AiServiceError 原样冒泡（run.ts 统一转 AiResult）。
 *
 * 2026-08-10 强化（对标 cv-parser-ai-tb 同构架构 + Instructor 模式）：
 * - prompt 显式"常见键→固定字段"映射表 + 「任意标签对必进 customFields、label 必须原文」——消除"只认固定字段"
 * - ZodError 校验失败重试一次（带错误信息重发，防字段丢失/结构跑偏）
 */
import { generateObject } from 'ai'
import { ImportMapSchema, importMapToResume } from '../../shared/schema/import-map'
import type { ImportDraft } from '../../shared/ipc-channels'
import { createActiveModel } from '../ai/client'

/** 文本送入 AI 的截断上限（防超长 token；三步核对兜底，无需全量） */
export const MAP_INPUT_MAX_CHARS = 12000

/** A 档映射提示词：硬约束禁编造（R2 信任底线）；2026-08-10 加任意标签对约束 */
export const IMPORT_MAP_SYSTEM_PROMPT = `你是简历数据提取器，把简历文本映射为结构化字段。铁律：
1. 只映射原文已出现的信息，禁止编造、推测、补全；原文没有的字段留空。
2. 描述类字段（summary/description/highlights）用原文要点忠实转述，不扩写不改意。
3. 日期、联系方式等照抄原文（保留原始写法即可）。
4. 无法归类的文本放到最接近的字段，宁可留空也不要硬塞。
5. 基本信息（basics）中，凡"标签：值"、"标签 值"或两列"短标签 + 长值"形态的字段（如 年龄、籍贯、性别、政治面貌、实习天数、期望薪资、到岗时间 等任何非标准字段），一律输出到 basics.customFields（数组元素 {label, value}）；label 必须来自原文、不得改名或翻译，value 照抄原文；不得丢弃任何标签对。
6. 常见字段（电话/邮箱/地址/网址/生日/在职状态/职业 headline）映射到对应固定字段，其余全部进 basics.customFields。`

/** 单次 generateObject 尝试（供重试复用） */
async function tryGenerate(
  model: Parameters<typeof generateObject>[0]['model'],
  system: string,
  prompt: string,
  temperature: number,
  maxTokens: number
): Promise<unknown> {
  const { object } = await generateObject({
    model,
    schema: ImportMapSchema,
    system,
    prompt,
    temperature,
    maxOutputTokens: maxTokens
  })
  return object
}

export async function mapTextToDraft(
  text: string,
  fileName: string,
  format: 'pdf' | 'docx',
  warnings: string[]
): Promise<ImportDraft> {
  const { model, temperature, maxTokens } = await createActiveModel()
  const prompt = `以下是从简历文件「${fileName}」提取的文本，请映射为结构化字段：\n\n${text.slice(0, MAP_INPUT_MAX_CHARS)}`
  let object: unknown
  try {
    object = await tryGenerate(model, IMPORT_MAP_SYSTEM_PROMPT, prompt, temperature, maxTokens)
  } catch (firstErr) {
    // 2026-08-10：结构化校验失败（ZodError/NoObjectGeneratedError）重试一次——
    // Instructor 模式：带上次错误信息重发，防字段丢失/结构跑偏
    const reason = firstErr instanceof Error ? firstErr.message.slice(0, 200) : String(firstErr)
    try {
      object = await tryGenerate(model, IMPORT_MAP_SYSTEM_PROMPT, `${prompt}\n\n注意：上次输出未通过 schema 校验（${reason}）。请重新严格按 schema 输出，自定义标签对务必进 basics.customFields。`, temperature, maxTokens)
    } catch {
      throw firstErr // 二次失败抛原错误（run.ts 转 PARSE_FAILED）
    }
  }
  // 清洗 + migrate 收口：非法结构在此抛 ZodError（run.ts 转 PARSE_FAILED）
  const resume = importMapToResume(object as Parameters<typeof importMapToResume>[0])
  return {
    format,
    fileName,
    sourcePreview: text.slice(0, 2000),
    resume,
    warnings
  }
}
