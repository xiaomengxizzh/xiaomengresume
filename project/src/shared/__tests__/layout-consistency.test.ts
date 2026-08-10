/**
 * layout-consistency.test.ts —— 排版一致性结构守卫（2026-08-10 架构收敛批）
 * 守护"单一事实源"：断言渲染端模板不再持有排版数值字面量（全部引用 shared/templates/layout.ts），
 * 防止未来手填漂移（自定义模板开放后由架构保证两端一致）。
 *
 * 2026-08-10 B 档迁移批 3：PDF 端（@react-pdf template.tsx 等）已退役，导出走 printToPDF 单引擎——
 * 原 PDF 端断言替换为"主进程导出无 @react-pdf 依赖 + pdf/ 目录不存在"守卫。
 */
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'

const REPO = path.resolve(process.cwd(), '..')
const files = {
  rendererRegistry: path.join(REPO, 'project/src/renderer/src/templates/registry.ts'),
  rendererResumeBody: path.join(REPO, 'project/src/renderer/src/templates/shared/ResumeBody.tsx'),
  rendererPrimitives: path.join(REPO, 'project/src/renderer/src/templates/shared/primitives.tsx'),
  runExport: path.join(REPO, 'project/src/main/export/run.ts'),
  printPdf: path.join(REPO, 'project/src/main/print/pdf.ts'),
  pdfDir: path.join(REPO, 'project/src/main/export/pdf'),
  sharedLayout: path.join(REPO, 'project/src/shared/templates/layout.ts')
}

async function read(p: string): Promise<string> {
  return fs.readFile(p, 'utf-8')
}

describe('排版单一事实源守卫（shared/templates/layout.ts）', () => {
  it('shared/layout.ts 存在且含全部逻辑值源', async () => {
    const s = await read(files.sharedLayout)
    for (const k of ['TEMPLATE_PRESETS', 'TYPE_SCALE', 'titleStyleLogic', 'sectionSpacingLogic', 'entrySpacingLogic', 'CONTACT_GRID_LOGIC', 'LIST_MARK_LOGIC', 'INFO_ICON_ELEMENTS', 'fmtDate', 'lv']) {
      expect(s).toContain(k)
    }
  })

  it('主进程导出不再依赖 @react-pdf（B 档退役后单引擎）', async () => {
    for (const p of [files.runExport, files.printPdf]) {
      const s = await read(p)
      expect(s).not.toContain('@react-pdf/renderer')
      expect(s).not.toContain('@react-pdf/types')
    }
    // pdf/ 目录（@react-pdf 导出模板）已退役
    await expect(fs.access(files.pdfDir)).rejects.toThrow()
  })

  it('渲染端 registry 不再本地定义 PRESETS 字面量（引用 shared）', async () => {
    const s = await read(files.rendererRegistry)
    expect(s).toContain("TEMPLATE_PRESETS as Record<TemplateId, TemplatePreset>")
    expect(s).not.toContain('classic: { baseFontSize: 16, lineHeight: 1.8')
  })

  it('渲染端 ResumeBody 无本地排版字面量残留', async () => {
    const s = await read(files.rendererResumeBody)
    expect(s).not.toContain("fontSize: '0.95em'") // entryHead 旧字面量
    expect(s).not.toContain("fontSize: '0.85em'") // sub/cert/lang 旧字面量
    expect(s).not.toContain("fontSize: '0.92em'") // desc 旧字面量
    expect(s).not.toContain('paddingLeft: \'18px\'') // skills 旧缩进
    expect(s).not.toContain("marginBottom: '10px'") // edu 旧间距
    expect(s).not.toContain("marginBottom: '12px'") // work/proj 旧间距
    expect(s).not.toContain("maxWidth: '150px'") // 标签旧宽度
    expect(s).not.toContain('size={15}') // 图标旧尺寸
  })

  it('primitives 收敛（fmtDate/sectionSpacingLogic 引用 shared）', async () => {
    const prim = await read(files.rendererPrimitives)
    expect(prim).toContain("from '@shared/templates/layout'")
  })
})
