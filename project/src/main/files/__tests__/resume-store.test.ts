/**
 * resume-store.test.ts —— G1 修复批②：跨锁 read-modify-write 竞态
 * 原缺陷：renameResume/bindJob/unbindJob 先经 openResume（独立锁）读盘，再二次进锁写回——
 * 两锁间隙内并发的 saveResume 落盘新内容会被旧对象覆盖（用户编辑被回滚）。
 * 修复：读-改-写整体包进一次 per-id 写锁（无锁内部读取变体供锁内使用）。
 * 手法：受控时序——gate 住 rename 的首次 utf-8 读盘，期间注入并发 save，
 * 断言 save 被写锁排队（结构证明）+ 终态落盘为后到的 save 内容（不被旧读覆盖）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'node:path'

const TEST_DIR = vi.hoisted(() => `${process.cwd()}/.tmp/xm-resume-store-test`)
const STORAGE_DIR = `${TEST_DIR}/xiaomengresume`

/** 测试与 mock 工厂共享的可变状态（hoisted：vi.mock 提升 早于顶层 import） */
const h = vi.hoisted(() => ({
  events: [] as string[],
  gateRead: null as null | ((real: () => Promise<string>) => Promise<string>),
  realFs: null as null | typeof import('node:fs').promises
}))

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR },
  dialog: { showMessageBox: vi.fn(async () => ({})) },
  BrowserWindow: { getAllWindows: () => [] }
}))

const storeData: Record<string, unknown> = {}
vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string): unknown {
      return storeData[key]
    }
    set(key: string, value: unknown): void {
      storeData[key] = value
    }
    delete(key: string): void {
      delete storeData[key]
    }
    get path(): string {
      return `${TEST_DIR}/settings.json`
    }
  }
}))

// node:fs 部分代理：utf-8 读 <uuid>.json 可被 gate（控制时序）；write/rename 记事件序
vi.mock('node:fs', async (importOriginal) => {
  const mod = await importOriginal<typeof import('node:fs')>()
  h.realFs = mod.promises
  const isResumeJsonRead = (args: unknown[]): boolean =>
    args[1] === 'utf-8' && /[0-9a-f-]{36}\.json$/.test(String(args[0]))
  const tag = (p: unknown, op: string): string => `${op}:${path.basename(String(p))}`
  return {
    ...mod,
    promises: {
      ...mod.promises,
      readFile: async (...args: Parameters<typeof mod.promises.readFile>): Promise<string | Buffer> => {
        if (isResumeJsonRead(args)) {
          h.events.push(tag(args[0], 'read'))
          const gate = h.gateRead
          if (gate) {
            h.gateRead = null
            return gate(() => mod.promises.readFile(args[0], 'utf-8')) as Promise<string>
          }
        }
        return mod.promises.readFile(...args)
      },
      writeFile: async (...args: Parameters<typeof mod.promises.writeFile>): Promise<void> => {
        h.events.push(tag(args[0], 'write'))
        return mod.promises.writeFile(...args)
      },
      rename: async (...args: Parameters<typeof mod.promises.rename>): Promise<void> => {
        h.events.push(tag(args[0], 'rename'))
        return mod.promises.rename(...args)
      }
    }
  }
})

// ── 被测模块 ──────────────────────────────────────────────────────────────
import { renameResume, saveResume, bindJob, unbindJob } from '../resume-store'
import { createEmptyResume, type Resume } from '../../../shared/schema/resume'

const ID = '3f5e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'
const JOB_ID = '9c8e7b10-2f4a-4a5d-8c1e-0a1b2c3d4e5f'

function resumeV1(): Resume {
  const r = createEmptyResume()
  r.title = 'old'
  r.basics.name = 'v1'
  return r
}

async function waitForEvent(prefix: string): Promise<void> {
  await vi.waitFor(() => expect(h.events.some((e) => e.startsWith(prefix))).toBe(true))
}

beforeEach(async () => {
  h.events.length = 0
  h.gateRead = null
  await h.realFs!.rm(STORAGE_DIR, { recursive: true, force: true })
})

describe('G1 读改写单锁（竞态回归）', () => {
  it('rename 持锁期间到达的并发 save 排队执行；终态落盘 = save 内容（不被旧读覆盖）', async () => {
    // 种子：磁盘 v1（旧内容）
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(resumeV1()), 'utf-8')

    // gate 住下一次 <uuid>.json utf-8 读（= rename 进锁后的首次读）
    let release!: () => void
    h.gateRead = (real) =>
      new Promise<string>((res) => {
        release = () => void real().then(res)
      })

    const renameP = renameResume(ID, 'renamed')
    await waitForEvent('read:') // rename 已持锁并进入读取（挂起中）

    // 飞行窗口内并发自动保存（渲染端最新内容 v2）
    const v2 = structuredClone(resumeV1())
    v2.basics.name = 'v2-edited'
    const saveP = saveResume(ID, v2)

    // 结构证明：save 被 per-id 写锁排队——gate 未放行前不得有任何落盘写
    await new Promise((r) => setTimeout(r, 20))
    expect(h.events.some((e) => e.startsWith('write:'))).toBe(false)

    release()
    const renamed = await renameP
    expect(renamed.title).toBe('renamed')
    await saveP

    // 终态：后到的 save 内容在盘上（修复前 rename 会用 v1+title 覆盖掉 v2）
    const finalRaw = JSON.parse(await h.realFs!.readFile(path.join(STORAGE_DIR, `${ID}.json`), 'utf-8')) as Resume
    expect(finalRaw.basics.name).toBe('v2-edited')
  })

  it('bindJob 同修：读改写单锁，并发 save 不被绑定前的旧对象回滚', async () => {
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(resumeV1()), 'utf-8')

    let release!: () => void
    h.gateRead = (real) =>
      new Promise<string>((res) => {
        release = () => void real().then(res)
      })

    const bindP = bindJob(ID, JOB_ID)
    await waitForEvent('read:')

    const v2 = structuredClone(resumeV1())
    v2.basics.name = 'v2-edited'
    const saveP = saveResume(ID, v2)

    await new Promise((r) => setTimeout(r, 20))
    expect(h.events.some((e) => e.startsWith('write:'))).toBe(false)

    release()
    const bound = await bindP
    expect(bound.boundJobIds).toContain(JOB_ID)
    await saveP

    const finalRaw = JSON.parse(await h.realFs!.readFile(path.join(STORAGE_DIR, `${ID}.json`), 'utf-8')) as Resume
    expect(finalRaw.basics.name).toBe('v2-edited')
  })
})

describe('基础行为回归（重构防劣化）', () => {
  beforeEach(async () => {
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(resumeV1()), 'utf-8')
  })

  it('rename 持久化 title 且返回值含新标题', async () => {
    const r = await renameResume(ID, '新标题')
    expect(r.title).toBe('新标题')
    const raw = JSON.parse(await h.realFs!.readFile(path.join(STORAGE_DIR, `${ID}.json`), 'utf-8')) as Resume
    expect(raw.title).toBe('新标题')
    expect(raw.meta?.lastOpenedAt).toBeTruthy() // open 语义保留
  })

  it('bind 幂等 + unbind 移除', async () => {
    const once = await bindJob(ID, JOB_ID)
    expect(once.boundJobIds.filter((j) => j === JOB_ID)).toHaveLength(1)
    const twice = await bindJob(ID, JOB_ID)
    expect(twice.boundJobIds.filter((j) => j === JOB_ID)).toHaveLength(1)
    const off = await unbindJob(ID, JOB_ID)
    expect(off.boundJobIds).not.toContain(JOB_ID)
  })
})
