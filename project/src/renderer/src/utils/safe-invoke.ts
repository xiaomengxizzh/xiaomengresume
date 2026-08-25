/**
 * safeInvoke —— G5（2026-08-25 修复批②）：统一 IPC 错误处理
 * 原问题：渲染层多处裸 await IPC——通道级 reject（渲染/主进程崩溃、通道异常）既无用户反馈，
 * busy 态又永久卡死（按钮禁用到刷新）。本工具收口：busy 一律 finally 复位；失败走
 * reportIpcError（toast + console）或调用方自定义 onError（已有 error 展示的组件保持展示）。
 * 业务层 Result 错误（res.ok === false）不在此处理——由调用方按既有 UI 分支展示。
 */
import { reportIpcError } from '../components/ui/toast'
import i18n from '../i18n'

export interface SafeInvokeOptions {
  /** busy 布尔态 setter：进入时 true，finally 复位 false（失败不再永久卡死） */
  busy?: (b: boolean) => void
  /** 自定义错误反馈（默认 reportIpcError toast）；已有本地 error 展示可在此补充或覆盖 */
  onError?: (e: unknown) => void
  /** 默认 toast 文案（已翻译字符串）；缺省 common.opFailed */
  errorMessage?: string
}

export async function safeInvoke<T>(p: Promise<T>, opts: SafeInvokeOptions = {}): Promise<T | null> {
  opts.busy?.(true)
  try {
    return await p
  } catch (err) {
    if (opts.onError) opts.onError(err)
    else reportIpcError(opts.errorMessage ?? (i18n.t('common.opFailed') as string), err)
    return null
  } finally {
    opts.busy?.(false)
  }
}
