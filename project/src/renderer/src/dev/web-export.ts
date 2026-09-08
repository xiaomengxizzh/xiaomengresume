/**
 * web-export —— web 端导出实现（纯客户端，2026-09-08）
 *
 * textPdf：浏览器打印管线——打开打印窗口（?export=1&autoprint=1，同一 web.html 入口，
 * 携带 mock/安全上下文 polyfill），ExportView 渲染就绪后唤起 window.print()，
 * 用户在浏览器打印对话框中"另存为 PDF"。@page/print CSS 与桌面 printToPDF 管线同源，
 * 隐私打码（privacyMode → data-redact）与语言经 URL 传参与桌面一致。
 * json：Blob 下载（与桌面"导出为版本化 JSON"语义一致）。
 * image / imagePdf：依赖桌面打印管线的位图化，web 暂不支持——返回主进程同款
 * 'coming in v1.1' 错误串（ExportDialog 映射为友好提示）。
 */
import { SettingsSchema } from '@shared/schema/settings'
import type { ExportRunArgs, ExportRunResult } from '@shared/ipc-channels'

/** 打印窗口 URL 组装（纯函数，便于测试；base 相对解析兼容 dev/prod 部署路径） */
export function buildPrintWindowUrl(
  args: {
    resumeId: string
    language: string
    privacyMode?: boolean
    pages?: 'all' | 'first'
  },
  baseHref: string = location.href
): string {
  const url = new URL('web.html', baseHref)
  url.searchParams.set('export', '1')
  url.searchParams.set('resumeId', args.resumeId)
  url.searchParams.set('language', args.language)
  url.searchParams.set('autoprint', '1')
  if (args.privacyMode) url.searchParams.set('privacyMode', '1')
  if (args.pages === 'first') url.searchParams.set('pages', 'first')
  return url.href
}

/** 从 localStorage 读取当前语言（mock settings 的存储约定：xmweb.v1.settings） */
function readLanguage(): string {
  try {
    const raw = localStorage.getItem('xmweb.v1.settings')
    return SettingsSchema.parse(raw ? JSON.parse(raw) : {}).language
  } catch {
    return 'zh-CN'
  }
}

/** 单份导出（契约与主进程 export:run 一致；进度事件 web 端无细分阶段，不发射） */
export async function webExportRun(args: ExportRunArgs): Promise<ExportRunResult> {
  const format = args?.format
  if (format === 'image' || format === 'imagePdf') {
    // 与主进程 v1.1 占位口径一致：ExportDialog 映射为"格式即将支持"友好提示
    return { canceled: false, error: 'coming in v1.1' }
  }
  if (format !== 'textPdf' && format !== 'json') {
    return { canceled: false, error: `unsupported export format: ${String(format)}` }
  }
  const resumeId = args.resumeId
  if (!resumeId) return { canceled: false, error: 'missing resumeId' }

  if (format === 'json') {
    // JSON 导出 = 读取本浏览器存储的简历 → 版本化 JSON 下载
    const raw = localStorage.getItem(`xmweb.v1.resume.${resumeId}`)
    if (!raw) return { canceled: false, error: 'missing resumeId' }
    const record = JSON.parse(raw) as { resume: unknown }
    const blob = new Blob([JSON.stringify(record.resume, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${resumeId}.json`
    a.click()
    URL.revokeObjectURL(url)
    return { canceled: false }
  }

  // textPdf：打印窗口（须在用户手势的瞬时激活窗口内打开，防弹窗拦截）
  const url = buildPrintWindowUrl({
    resumeId,
    language: readLanguage(),
    privacyMode: args.privacyMode,
    pages: args.pages
  })
  const win = window.open(url, '_blank', 'width=840,height=1180')
  if (!win) {
    return { canceled: false, error: 'popup blocked — please allow popups for this site and retry' }
  }
  return { canceled: false }
}
