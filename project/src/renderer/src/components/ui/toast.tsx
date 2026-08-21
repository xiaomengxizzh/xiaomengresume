/**
 * Toast 轻提示（P1-11 IPC 错误统一处理，2026-08-21）
 * 模块级事件总线：任意处 showToast(msg, kind)；<ToastHost/> 挂应用根部（App 主壳）。
 * 选型说明：替代原定 sonner——npm arborist 安装故障 + 项目自研组件库路线（UI 美化拍板①手抄），
 * 零新依赖；风格对齐 T2 自动保存轻提示（底部右侧、令牌化）。error 类 4s 常驻 + danger 色。
 */
import { useEffect, useState } from 'react'

export type ToastKind = 'info' | 'error'
interface ToastItem {
  id: number
  msg: string
  kind: ToastKind
}
let seq = 0
const listeners = new Set<(t: ToastItem) => void>()

export function showToast(msg: string, kind: ToastKind = 'info'): void {
  const item: ToastItem = { id: ++seq, msg, kind }
  listeners.forEach((l) => l(item))
}

/** P1-11：IPC 错误统一上报（替代静默 catch；文案走 i18n 由调用方给，原始错误进 console 便于排查） */
export function reportIpcError(msg: string, err: unknown): void {
  console.error('[ipc]', err)
  showToast(msg, 'error')
}

export function ToastHost(): React.JSX.Element | null {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    const l = (t: ToastItem): void => {
      setItems((prev) => [...prev.slice(-2), t]) // 同屏最多 3 条
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.kind === 'error' ? 4000 : 1800)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5">
      {items.map((t) => (
        <div
          key={t.id}
          aria-live="polite"
          className={`rounded-lg px-3 py-1.5 text-xs shadow-card-hover ${
            t.kind === 'error' ? 'bg-danger-bg text-danger' : 'bg-surface text-foreground/80'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}
