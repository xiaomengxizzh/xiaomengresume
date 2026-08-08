/**
 * job-store.test.ts —— F19 岗位存储单测（node 环境，tmp 目录）
 * 覆盖：CRUD round-trip / uuid 校验（路径穿越防护）/ 删除清理 .bak/.tmp / list 损坏跳过。
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import * as path from 'node:path'
import { promises as fs } from 'node:fs'

const TEST_DIR = vi.hoisted(() => `${process.cwd()}/.tmp/xm-jobs-test-${Date.now()}`)

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR }
}))

import { saveJob, getJob, deleteJob, listJobs } from '../job-store'
import { createEmptyJob } from '../../../shared/schema/job'

describe('job-store（F19）', () => {
  beforeAll(async () => {
    await fs.mkdir(path.join(TEST_DIR, 'jobs'), { recursive: true })
  })

  beforeEach(async () => {
    // 每例独立：清空 jobs 目录（防测试间文件残留影响 list 计数）
    await fs.rm(path.join(TEST_DIR, 'jobs'), { recursive: true, force: true })
    await fs.mkdir(path.join(TEST_DIR, 'jobs'), { recursive: true })
  })

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  it('save → get round-trip（requirements 保留）', async () => {
    const job = createEmptyJob('前端工程师')
    job.appliedAt = '2026-03'
    job.requirements = '熟悉 React、TypeScript'
    const saved = await saveJob(job)
    expect(saved.updatedAt).toBeTruthy()
    const got = await getJob(job.id)
    expect(got.name).toBe('前端工程师')
    expect(got.requirements).toBe('熟悉 React、TypeScript')
  })

  it('非法 uuid → 拒绝（路径穿越防护）', async () => {
    const job = createEmptyJob('x')
    job.id = '../../../etc/passwd'
    await expect(saveJob(job)).rejects.toThrow()
    await expect(getJob('../../evil')).rejects.toThrow()
  })

  it('delete 清理正式文件与 .bak', async () => {
    const job = createEmptyJob('待删岗位')
    await saveJob(job)
    await saveJob({ ...job, name: '改名' }) // 触发 .bak 轮转
    await deleteJob(job.id)
    await expect(getJob(job.id)).rejects.toThrow()
    const files = await fs.readdir(path.join(TEST_DIR, 'jobs'))
    expect(files.some((f) => f.startsWith(job.id))).toBe(false)
  })

  it('list 返回全部有效岗位且损坏文件跳过', async () => {
    const a = await saveJob(createEmptyJob('岗位A'))
    const b = await saveJob(createEmptyJob('岗位B'))
    // 写入损坏 json
    await fs.writeFile(path.join(TEST_DIR, 'jobs', 'deadbeef-dead-beef-dead-beefdeadbeef.json'), 'not-json', 'utf-8')
    const list = await listJobs()
    expect(list).toHaveLength(2)
    expect(new Set(list.map((j) => j.id))).toEqual(new Set([a.id, b.id]))
  })
})
