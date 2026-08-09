/**
 * import/errors.ts —— M4a 导入错误（解析层独立错误类，不依赖 AI 配置层）
 * run.ts 统一 catch → AiResult；code 复用 AiErrorCode（shared 冻结）。
 */
import type { AiErrorCode } from '../../shared/ipc-channels'

export type ImportErrorCode = Extract<
  AiErrorCode,
  'PARSE_FAILED' | 'UNSUPPORTED' | 'TIMEOUT' | 'NO_PROVIDER' | 'CONFIG_INVALID' | 'UNKNOWN'
>

export class ImportError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'ImportError'
  }
}
