/**
 * useAiStream —— M3 单请求互斥流式封装（Q4 拍板）
 * run 时若有进行中请求先 cancel 旧（渲染层互斥，主进程按 requestId 支持取消）；
 * chunk 按 requestId 匹配（客户端生成 uuid，见 AiIntroArgs/AiPolishArgs.requestId）。
 */
import { useCallback, useRef, useState } from 'react'
import type { AiError, AiResult, AiStreamChunk } from '@shared/ipc-channels'

interface UseAiStreamOpts {
  start: (requestId: string) => Promise<AiResult<string>>
  cancel: (requestId: string) => Promise<unknown>
  subscribe: (cb: (chunk: AiStreamChunk) => void) => () => void
}

export interface UseAiStreamResult {
  busy: boolean
  error: AiError | null
  result: string
  run: () => Promise<string | null>
  cancel: () => Promise<void>
  reset: () => void
}

export function useAiStream(opts: UseAiStreamOpts): UseAiStreamResult {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AiError | null>(null)
  const [result, setResult] = useState('')
  const requestIdRef = useRef<string | null>(null)

  const cancel = useCallback(async (): Promise<void> => {
    const rid = requestIdRef.current
    if (rid) {
      requestIdRef.current = null
      await opts.cancel(rid)
    }
  }, [opts.cancel])

  const reset = useCallback(() => {
    void cancel()
    setResult('')
    setError(null)
  }, [cancel])

  const run = useCallback(async (): Promise<string | null> => {
    await cancel()
    const requestId = crypto.randomUUID()
    requestIdRef.current = requestId
    setBusy(true)
    setError(null)
    setResult('')
    const unsub = opts.subscribe((chunk) => {
      if (chunk.requestId === requestId) setResult((prev) => prev + chunk.delta)
    })
    try {
      const res = await opts.start(requestId)
      if (res.ok) return res.data
      setError(res.error)
      return null
    } catch {
      setError({ code: 'UNKNOWN' })
      return null
    } finally {
      unsub()
      if (requestIdRef.current === requestId) requestIdRef.current = null
      setBusy(false)
    }
  }, [opts, cancel])

  return { busy, error, result, run, cancel, reset }
}
