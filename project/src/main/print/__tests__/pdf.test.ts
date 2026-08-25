/**
 * pdf.test.ts —— G3 修复批②：pdfWindow 单例并发互踩
 * 原缺陷：printHtmlToPdf / printAppToPdf 共用同一隐藏窗口，两通道并发时互相 loadFile/loadURL
 * 冲掉对方页面。修复：模块级 promise 链串行化（withQueue）。
 * Electron 运行时依赖无法端到端——只单测队列纯逻辑：排队互斥 + 失败不阻塞后续。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: class {},
  app: { on: vi.fn() }
}))

import { withQueue } from '../pdf'

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('G3 withQueue 打印串行化', () => {
  it('前序未完成不得启动后序（互斥），完成后按队执行并透传结果', async () => {
    const dA = deferred<string>()
    const order: string[] = []
    const a = withQueue(async () => {
      order.push('a:start')
      return dA.promise
    }).then((v) => {
      order.push('a:end')
      return v
    })
    const b = withQueue(async () => {
      order.push('b:start')
      return 'B'
    })

    await Promise.resolve()
    expect(order).toEqual(['a:start']) // b 未启动（防共用隐藏窗口互相冲页）

    dA.resolve('A')
    expect(await a).toBe('A')
    expect(await b).toBe('B')
    expect(order).toEqual(['a:start', 'a:end', 'b:start'])
  })

  it('前序 reject 不污染队列，后序照常执行', async () => {
    const dErr = deferred<never>()
    const a = withQueue(() => dErr.promise)
    let bRan = false
    const b = withQueue(async () => {
      bRan = true
      return 'ok'
    })

    await new Promise((r) => setTimeout(r, 0))
    expect(bRan).toBe(false)

    dErr.reject(new Error('print fail'))
    await expect(a).rejects.toThrow('print fail')
    expect(await b).toBe('ok')
    expect(bRan).toBe(true)

    // 队列仍可用（第三棒）
    await expect(withQueue(async () => 'c')).resolves.toBe('c')
  })
})
