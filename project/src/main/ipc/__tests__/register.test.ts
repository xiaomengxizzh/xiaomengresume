/**
 * register.test.ts —— 主进程 IPC 注册对账（补测试盲区批 T6，结构测试防通道漏注册）
 * 做法：mock electron 的 ipcMain（handle/on 记录到 Map）+ electron-store（内存），
 * 调 registerIpc()（聚合 registerAiIpc / registerExportIpc / registerImportIpc 等），
 * 断言「契约中所有 invoke 类通道」全部被注册——对账集合从 IPC 常量结构化提取（遍历常量对象，
 * 不手抄字符串），新增契约通道漏注册时本测试自动红。
 *
 * 通道分类依据（src/shared/ipc-channels.ts + 各注册器实现）：
 * - invoke 类（ipcMain.handle）：除下列两类外的全部契约通道；
 * - ipcMain.on 单向：resume:save-now（关窗静默保存，P2 不等回执）；window:minimize /
 *   window:maximize-toggle / window:close（窗口控制在 main/index.ts 注册，不经 registerIpc）；
 * - webContents.send 事件通道（不在 IPC 常量内、无 handle，不参与对账，仅列出）：
 *   export:progress / import:progress / ai:intro:chunk / ai:polish:chunk / ai:stream:chunk /
 *   window:maximized / window:before-hide。
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { IPC } from '../../../shared/ipc-channels'

const h = vi.hoisted(() => ({
  /** channel -> handler（ipcMain.handle） */
  handled: new Map<string, unknown>(),
  /** channel -> listeners（ipcMain.on 单向） */
  onListeners: new Map<string, unknown[]>(),
  /** 重复注册的通道（同通道二次 handle） */
  duplicated: [] as string[]
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: unknown): void => {
      if (h.handled.has(channel)) h.duplicated.push(channel)
      h.handled.set(channel, handler)
    },
    on: (channel: string, listener: unknown): void => {
      const arr = h.onListeners.get(channel) ?? []
      arr.push(listener)
      h.onListeners.set(channel, arr)
    }
  },
  app: {
    getPath: () => '/tmp/xm-register-test',
    getVersion: (): string => '0.0.0-test',
    // print/pdf.ts 模块顶层注册 before-quit 钩子
    on: vi.fn()
  },
  safeStorage: {
    isEncryptionAvailable: (): boolean => true,
    encryptString: (s: string): Buffer => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer): string => b.toString('utf-8')
  },
  BrowserWindow: class {
    static fromWebContents(): null {
      return null
    }
    static getAllWindows(): unknown[] {
      return []
    }
  },
  dialog: {
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
    showSaveDialog: vi.fn(async () => ({ canceled: true })),
    showMessageBox: vi.fn(async () => ({}))
  },
  shell: { openPath: vi.fn(async () => '') }
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    private data = new Map<string, unknown>()
    get(key: string): unknown {
      return this.data.get(key)
    }
    set(key: string, value: unknown): void {
      this.data.set(key, value)
    }
    delete(key: string): void {
      this.data.delete(key)
    }
  }
}))

// ai/mock.ts 引 @electron-toolkit/utils（node_modules 外部化，吃不到上面的 electron mock）
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false }, electronApp: {}, optimizer: {} }))

import { registerIpc } from '../register'

// ── 契约通道结构化提取 ──────────────────────────────────────────────────────

type Entry = { ns: string; ch: string }
/** 遍历 IPC 常量对象展开全部通道（ns = 命名空间键，ch = 通道字符串） */
const allEntries: Entry[] = Object.entries(IPC).flatMap(([ns, chans]) =>
  Object.values(chans as Record<string, string>).map((ch) => ({ ns, ch }))
)

/** 非 invoke 类（见文件头分类依据）：window:* 命名空间 + resume:save-now */
const ON_NAMESPACES = new Set(['Window'])
const ON_CHANNELS = new Set<string>([IPC.Resume.SaveNow])
const expectedInvoke: string[] = allEntries
  .filter(({ ns, ch }) => !ON_NAMESPACES.has(ns) && !ON_CHANNELS.has(ch))
  .map((e) => e.ch)
const sendOnly: string[] = allEntries
  .filter(({ ns, ch }) => ON_NAMESPACES.has(ns) || ON_CHANNELS.has(ch))
  .map((e) => e.ch)

beforeAll(() => {
  registerIpc()
})

describe('IPC 注册对账（registerIpc vs ipc-channels 契约）', () => {
  it('契约 invoke 类通道全部经 ipcMain.handle 注册（缺一即红）', () => {
    const missing = expectedInvoke.filter((ch) => !h.handled.has(ch))
    expect(missing).toEqual([])
  })

  it('注册数与契约 invoke 类通道数一致（多注册的野通道也红）', () => {
    expect(h.handled.size).toBe(expectedInvoke.length)
  })

  it('已注册通道必须存在于契约（防手写错别字通道名）', () => {
    const contract = new Set(allEntries.map((e) => e.ch))
    const rogue = [...h.handled.keys()].filter((ch) => !contract.has(ch))
    expect(rogue).toEqual([])
  })

  it('无重复注册（同通道二次 handle 会覆盖旧处理器）', () => {
    expect(h.duplicated).toEqual([])
  })

  it('resume:save-now 为单向 ipcMain.on（非 handle），且确已注册', () => {
    expect(h.handled.has(IPC.Resume.SaveNow)).toBe(false)
    expect((h.onListeners.get(IPC.Resume.SaveNow) ?? []).length).toBeGreaterThan(0)
  })

  it('非 invoke 类通道恰为 window:* 三通道 + resume:save-now（分类守卫，契约变更时提示同步本测试）', () => {
    const sorted = [...sendOnly].sort()
    expect(sorted).toEqual(
      ['resume:save-now', 'window:close', 'window:maximize-toggle', 'window:minimize'].sort()
    )
  })
})
