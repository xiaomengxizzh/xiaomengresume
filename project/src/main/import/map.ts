/**
 * import/map.ts —— M4a AI 语义映射（A 档主路径；B 档兜底归 M4a.1）
 * 流程：createActiveModel()（复用 M3，四家+自定义）→ generateObject({ schema: ImportMapSchema })
 *   → importMapToResume()（宽松清洗 + migrate 收口）→ 草稿。
 * 信任底线（R2）：三步核对向导不可跳过；提示词硬约束「仅映射已有文本，禁编造」。
 * 错误：NO_PROVIDER / CONFIG_INVALID / TIMEOUT 等 AiServiceError 原样冒泡（run.ts 统一转 AiResult）。
 */
import { generateObject } from 'ai'
import { ImportMapSchema, importMapToResume } from '../../shared/schema/import-map'
import type { ImportDraft } from '../../shared/ipc-channels'
import { createActiveModel } from '../ai/client'

/** 文本送入 AI 的截断上限（防超长 token；三步核对兜底，无需全量） */
export const MAP_INPUT_MAX_CHARS = 12000

/** A 档映射提示词：硬约束禁编造（R2 信任底线） */
export const IMPORT_MAP_SYSTEM_PROMPT = `你是简历数据提取器，把简历文本映射为结构化字段。铁律：
1. 只映射原文已出现的信息，禁止编造、推测、补全；原文没有的字段留空。
2. 描述类字段（summary/description/highlights）用原文要点忠实转述，不扩写不改意。
3. 日期、联系方式等照抄原文（保留原始写法即可）。
4. 无法归类的文本放到最接近的字段，宁可留空也不要硬塞。`

export async function mapTextToDraft(
  text: string,
  fileName: string,
  format: 'pdf' | 'docx',
  warnings: string[]
): Promise<ImportDraft> {
  const { model, temperature, maxTokens } = await createActiveModel()
  const { object } = await generateObject({
    model,
    schema: ImportMapSchema,
    system: IMPORT_MAP_SYSTEM_PROMPT,
    prompt: `以下是从简历文件「${fileName}」提取的文本，请映射为结构化字段：\n\n${text.slice(0, MAP_INPUT_MAX_CHARS)}`,
    temperature,
    maxOutputTokens: maxTokens
  })
  // 清洗 + migrate 收口：非法结构在此抛 ZodError（run.ts 转 PARSE_FAILED）
  const resume = importMapToResume(object)
  return {
    format,
    fileName,
    sourcePreview: text.slice(0, 2000),
    resume,
    warnings
  }
}
