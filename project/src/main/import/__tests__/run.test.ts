/**
 * run.test.ts —— M4a import:run 入口单测（mock electron dialog + 各解析模块）
 * 覆盖：格式分发（json 零 AI / pdf+docx AI 映射 / image 占位）/ 取消 → CANCELLED /
 * 非法格式 → UNSUPPORTED / 解析失败 → PARSE_FAILED / 超时 → TIMEOUT。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mocks（vi.mock 提升到 import 前；工厂引用必须经 vi.hoisted）────────────
const m = vi.hoisted(() => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  fromWebContents: vi.fn(),
  importJson: vi.fn(),
  extractPdfLines: vi.fn(),
  extractPdfText: vi.fn(),
  extractPdfPhoto: vi.fn(),
  visionPlaceholderDraft: vi.fn(),
  extractDocxText: vi.fn(),
  mapTextToDraft: vi.fn(),
  // R8：批量导入直接落盘
  saveResume: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: m.ipcMain,
  dialog: m.dialog,
  BrowserWindow: { fromWebContents: (...a: unknown[]) => m.fromWebContents(...a) }
}))

vi.mock('../../ai/config', () => ({ AiServiceError: class AiServiceError extends Error {} }))

vi.mock('../json', () => ({ importJson: (...a: unknown[]) => m.importJson(...a) }))
vi.mock('../pdf', () => ({
  extractPdfLines: (...a: unknown[]) => m.extractPdfLines(...a),
  extractPdfText: (...a: unknown[]) => m.extractPdfText(...a),
  extractPdfPhoto: (...a: unknown[]) => m.extractPdfPhoto(...a),
  visionPlaceholderDraft: (...a: unknown[]) => m.visionPlaceholderDraft(...a)
}))
vi.mock('../docx', () => ({ extractDocxText: (...a: unknown[]) => m.extractDocxText(...a) }))
vi.mock('../map', () => ({ mapTextToDraft: (...a: unknown[]) => m.mapTextToDraft(...a) }))
vi.mock('../../files/resume-store', () => ({ saveResume: (...a: unknown[]) => m.saveResume(...a) }))

import { IPC, type ImportRunArgs } from '../../../shared/ipc-channels'
import { registerImportIpc, withTimeout, toImportAiError, IMPORT_TIMEOUT_MS } from '../run'
import { ImportError } from '../errors'

const sender = { isDestroyed: () => false, send: vi.fn() } as never

function fakeDraft(format: string): object {
  return { format, fileName: 'x', sourcePreview: '', resume: {}, warnings: [] }
}

beforeEach(() => {
  vi.clearAllMocks()
  m.fromWebContents.mockReturnValue({})
  m.importJson.mockResolvedValue(fakeDraft('json'))
  m.mapTextToDraft.mockResolvedValue(fakeDraft('pdf'))
  m.visionPlaceholderDraft.mockReturnValue({ ...fakeDraft('image'), needsVision: true })
  m.extractPdfLines.mockResolvedValue({ text: 't', effectiveChars: 200, warnings: [], needsVision: false, lines: [], pairs: [] })
  m.extractPdfText.mockResolvedValue({ text: 't', effectiveChars: 200, warnings: [], needsVision: false })
  m.extractDocxText.mockResolvedValue({ text: 't', warnings: [] })
  m.extractPdfPhoto.mockResolvedValue({ dataUrl: 'data:image/png;base64,AAA', width: 90, height: 120 })
  m.saveResume.mockResolvedValue({})
})

function getHandler(): (e: unknown, args: ImportRunArgs) => Promise<{
  ok: boolean
  data?: {
    needsVision?: boolean
    format?: string
    warnings?: string[]
    resume?: {
      basics: { name: string; photo?: string; photoWidth?: number; photoHeight?: number }
      education: Array<{ school: string }>
      work: Array<{ company: string }>
    }
  }
  error?: { code: string }
}> {
  registerImportIpc()
  return m.ipcMain.handle.mock.calls.find((c: unknown[]) => c[0] === IPC.Import.Run)?.[1] as never
}

describe('registerImportIpc（入口分发）', () => {
  it('注册 import:run 通道', () => {
    registerImportIpc()
    expect(m.ipcMain.handle).toHaveBeenCalledWith(IPC.Import.Run, expect.any(Function))
  })

  it('json → 零 AI 直通（mapTextToDraft 不被调用）', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.json'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'json' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(m.importJson).toHaveBeenCalled()
    expect(m.mapTextToDraft).not.toHaveBeenCalled()
  })

  it('pdf（文本充足）→ 抽取 + AI 映射', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.pdf'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(m.extractPdfLines).toHaveBeenCalled()
    expect(m.mapTextToDraft).toHaveBeenCalled()
  })

  it('2026-08-09：pdf 导入提取头像 → 草稿 basics.photo 填充（预览/导出显示）', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.pdf'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(m.extractPdfPhoto).toHaveBeenCalled()
    expect(r.data?.resume?.basics?.photo).toBe('data:image/png;base64,AAA')
    expect(r.data?.resume?.basics?.photoWidth).toBe(90)
    expect(r.data?.resume?.basics?.photoHeight).toBe(120)
  })

  it('pdf 无图 → photo 保持空（不阻断）', async () => {
    m.extractPdfPhoto.mockResolvedValue(null)
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.pdf'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(r.data?.resume?.basics?.photo ?? '').toBe('')
  })

  it('pdf 扫描件（needsVision）→ 占位草稿，不调 AI', async () => {
    m.extractPdfLines.mockResolvedValue({ text: '小', effectiveChars: 5, warnings: ['w'], needsVision: true, lines: [], pairs: [] })
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/scan.pdf'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(r.data?.needsVision).toBe(true)
    expect(m.mapTextToDraft).not.toHaveBeenCalled()
  })

  it('docx → 抽取 + AI 映射', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.docx'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'docx' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(m.extractDocxText).toHaveBeenCalled()
  })

  it('M4a.1：A 档映射失败（无 AI/网络）→ 自动降级 B 档本地规则，不阻断导入', async () => {
    m.mapTextToDraft.mockRejectedValue(new Error('NO_PROVIDER'))
    m.extractPdfLines.mockResolvedValue({
      text: '张三\n13800138000\n教育经历\n北京大学 本科 2013-2017\n工作经历\n- 某科技 工程师 2020-2023',
      effectiveChars: 200,
      warnings: [],
      needsVision: false,
      lines: [],
      pairs: []
    })
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.pdf'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(r.data?.warnings).toContain('import.warning.localRules')
    expect(r.data?.resume?.basics.name).toBe('张三')
    expect(r.data?.resume?.education[0].school).toBe('北京大学')
    expect(r.data?.resume?.work[0].company).toBe('某科技')
  })

  it('M4a.1：B 档检测到脏排版 → dirtyLayout 警告提示切 A 档', async () => {
    m.mapTextToDraft.mockRejectedValue(new Error('NETWORK'))
    m.extractPdfLines.mockResolvedValue({
      text: '一段无法归类的自由文本\n没有锚点',
      effectiveChars: 50,
      warnings: [],
      needsVision: false,
      lines: [],
      pairs: []
    })
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/scan.pdf'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(r.data?.warnings).toContain('import.warning.dirtyLayout')
  })

  it('image → M4b 占位（needsVision）', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.png'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'image' } as ImportRunArgs)
    expect(r.ok).toBe(true)
    expect(m.visionPlaceholderDraft).toHaveBeenCalledWith('image', 'a.png', '', expect.any(Array))
  })

  it('取消选择 → CANCELLED', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'pdf' } as ImportRunArgs)
    expect(r).toEqual({ ok: false, error: { code: 'CANCELLED' } })
  })

  it('非法格式 → UNSUPPORTED（不开对话框）', async () => {
    const h = getHandler()
    const r = await h({ sender }, { format: 'txt' } as unknown as ImportRunArgs)
    expect(r).toEqual({ ok: false, error: { code: 'UNSUPPORTED' } })
    expect(m.dialog.showOpenDialog).not.toHaveBeenCalled()
  })

  it('解析失败（ImportError PARSE_FAILED）→ 结构化错误码', async () => {
    m.importJson.mockRejectedValue(new ImportError('PARSE_FAILED', 'bad'))
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.json'] })
    const h = getHandler()
    const r = await h({ sender }, { format: 'json' } as ImportRunArgs)
    expect(r).toEqual({ ok: false, error: { code: 'PARSE_FAILED', message: 'bad' } })
  })
})

describe('withTimeout（超时兜底）', () => {
  it('超时 → TIMEOUT 错误', async () => {
    await expect(withTimeout(new Promise(() => {}), 5)).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('提前完成 → 返回值透传', async () => {
    await expect(withTimeout(Promise.resolve(42), 5000)).resolves.toBe(42)
  })

  it('import 全局超时常量 = 30s', () => {
    expect(IMPORT_TIMEOUT_MS).toBe(30_000)
  })
})

describe('toImportAiError', () => {
  it('UNKNOWN 兜底', () => {
    expect(toImportAiError(new Error('x'))).toEqual({ code: 'UNKNOWN', message: 'x' })
  })
  it('AbortError → CANCELLED', () => {
    const e = new Error('aborted')
    e.name = 'AbortError'
    expect(toImportAiError(e)).toEqual({ code: 'CANCELLED' })
  })
})

describe('registerImportIpc · import:runBatch（2026-08-09 R8）', () => {
  function getBatchHandler(): (e: unknown) => Promise<{ ok: boolean; data?: { imported: number; failed: Array<{ fileName: string; code: string }> }; error?: { code: string } }> {
    registerImportIpc()
    return m.ipcMain.handle.mock.calls.find((c: unknown[]) => c[0] === IPC.Import.RunBatch)?.[1] as never
  }

  it('多选 → 逐份按扩展名分派 → saveResume 落盘，返回成功/失败摘要', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['C:/r/a.pdf', 'C:/r/b.docx', 'C:/r/c.txt']
    })
    const res = await getBatchHandler()({} as never)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data?.imported).toBe(2) // a.pdf（map 档）+ b.docx（docx → map 档）；c.txt 不支持
    expect(m.saveResume).toHaveBeenCalledTimes(2)
    // 标题 = 文件名去扩展名
    const first = m.saveResume.mock.calls[0] as [string, { title?: string }]
    expect(first[1].title).toBe('a')
    expect(res.data?.failed.some((f) => f.fileName === 'c.txt')).toBe(true)
  })

  it('扫描件（needsVision）不落盘，计入 failed', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/r/scan.pdf'] })
    // 命中 needsVision 分流：pdf 文本过少 → visionPlaceholderDraft（beforeEach 已设 needsVision:true）
    m.extractPdfLines.mockResolvedValue({ text: '', effectiveChars: 5, warnings: ['import.warning.scanned'], needsVision: true, lines: [], pairs: [] })
    const res = await getBatchHandler()({} as never)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.data?.imported).toBe(0)
    expect(res.data?.failed.some((f) => f.fileName === 'scan.pdf' && f.code === 'VISION_REQUIRED')).toBe(true)
    expect(m.saveResume).not.toHaveBeenCalled()
  })

  it('取消 → CANCELLED', async () => {
    m.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const res = await getBatchHandler()({} as never)
    expect(res).toEqual({ ok: false, error: { code: 'CANCELLED' } })
  })
})
