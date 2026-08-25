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
  realFs: null as null | typeof import('node:fs').promises,
  /** H2：置 true 时 mock rename 抛不可重试错误（EACCES 不进退避），模拟 rename 失败路径 */
  failRename: false
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
        if (h.failRename) throw Object.assign(new Error('rename blocked'), { code: 'EACCES' })
        return mod.promises.rename(...args)
      }
    }
  }
})

// ── 被测模块 ──────────────────────────────────────────────────────────────
import { renameResume, saveResume, bindJob, unbindJob, duplicateResume } from '../resume-store'
import { savePhotoFile, readPhotoFile } from '../photo-store'
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
  h.failRename = false
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

describe('H2 rename 失败保留 .tmp（崩溃恢复信号不被删）', () => {
  it('mock rename 恒失败 → saveResume reject，.tmp 仍存在且内容为待写数据，正式文件保持旧版', async () => {
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(resumeV1()), 'utf-8')

    h.failRename = true
    const v2 = structuredClone(resumeV1())
    v2.basics.name = 'v2-pending'
    await expect(saveResume(ID, v2)).rejects.toThrow()
    h.failRename = false

    // .tmp 未被 finally 无条件删除：内含最新待写数据（recoverPending 可救回）
    const tmpRaw = await h.realFs!.readFile(path.join(STORAGE_DIR, `${ID}.json.tmp`), 'utf-8')
    expect((JSON.parse(tmpRaw) as Resume).basics.name).toBe('v2-pending')
    // 正式文件未被半写破坏
    const curRaw = await h.realFs!.readFile(path.join(STORAGE_DIR, `${ID}.json`), 'utf-8')
    expect((JSON.parse(curRaw) as Resume).basics.name).toBe('v1')
  })
})

describe('H4 duplicateResume 先拷照片后写 JSON（杜绝悬空 photos/ 引用）', () => {
  const PHOTO_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='

  async function seedWithPhotoRef(): Promise<void> {
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    // 种照片文件（photo-store 纯函数，直写 STORAGE_DIR/photos）
    await savePhotoFile(STORAGE_DIR, ID, PHOTO_PNG)
    // 种简历 JSON：photo 为文件引用形式
    const r = resumeV1()
    r.basics.photo = `photos/${ID}.png`
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(r), 'utf-8')
  }

  it('照片文件存在：副本 photo 指向新 id 且照片已复制（正向不回归）', async () => {
    await seedWithPhotoRef()
    const { id: newId, resume: copy } = await duplicateResume(ID)
    expect(copy.basics.photo).toBe(`photos/${newId}.png`)
    expect(await readPhotoFile(STORAGE_DIR, `photos/${newId}.png`)).toBe(PHOTO_PNG)
  })

  it('照片文件缺失：副本 photo 回退为空/dataURL，绝不为悬空 photos/ 引用', async () => {
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    const r = resumeV1()
    r.basics.photo = `photos/${ID}.png` // 引用存在，photos/<ID>.png 文件缺失
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(r), 'utf-8')

    const { resume: copy } = await duplicateResume(ID)
    const p = copy.basics.photo ?? ''
    expect(p.startsWith('photos/')).toBe(false)
    // 读不到原文件 → 置空；读得到 → dataURL 内嵌。二者皆非悬空引用
    expect(p === '' || p.startsWith('data:image/')).toBe(true)
  })

  it('原 photo 为空：副本保持空（无引用迁移）', async () => {
    await h.realFs!.mkdir(STORAGE_DIR, { recursive: true })
    const r = resumeV1()
    r.basics.photo = ''
    await h.realFs!.writeFile(path.join(STORAGE_DIR, `${ID}.json`), JSON.stringify(r), 'utf-8')

    const { resume: copy } = await duplicateResume(ID)
    expect(copy.basics.photo ?? '').toBe('')
  })
})
