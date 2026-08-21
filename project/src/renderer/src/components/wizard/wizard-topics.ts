/**
 * 使用向导数据定义（B1 批，2026-08-21 向导弹窗 D1-L1）
 * 只承载结构与 i18n key（F13 禁硬编码文案），文案 zh/en 在 B3 批补
 * `src/renderer/src/i18n/{zh-CN,en}.json` 的 wizard 命名空间。
 * targetView 值域必须与 App.tsx renderView 分支保持一致（测试有运行时对照护栏）。
 */

/** 可直达视图 = App.tsx currentView 合法分支（welcome/editor/各功能屏） */
export type WizardTargetView =
  | 'welcome'
  | 'editor'
  | 'resumes-home'
  | 'resumes-list'
  | 'resumes-recent'
  | 'resumes-new'
  | 'resumes-manage'
  | 'jobs-manage'
  | 'import-home'
  | 'ai-home'
  | 'ai:grammar'
  | 'ai:intro'
  | 'ai:polish'
  | 'ai:match'
  | 'settings-home'
  | 'settings-appearance'
  | 'settings-templates'
  | 'settings-ai'
  | 'settings-storage'

export interface WizardStep {
  /** i18n key（wizard.topics.<id>.step<N>），文案 B3 批补 */
  textKey: string
  /** 可选直达视图；存在时步骤面板显示「前往」按钮 */
  targetView?: WizardTargetView
}

export interface WizardTopic {
  id: string
  /** wizard.category.gettingStarted 等 */
  categoryKey: string
  /** wizard.topics.<id>.title */
  titleKey: string
  /** wizard.topics.<id>.hint（完成标志行） */
  hintKey: string
  steps: WizardStep[]
}

/** 分类顺序即弹窗列表分组展示顺序 */
export const WIZARD_CATEGORIES = ['gettingStarted', 'import', 'ai', 'exportSettings'] as const

function topic(
  id: string,
  category: (typeof WIZARD_CATEGORIES)[number],
  steps: WizardStep[]
): WizardTopic {
  return {
    id,
    categoryKey: `wizard.category.${category}`,
    titleKey: `wizard.topics.${id}.title`,
    hintKey: `wizard.topics.${id}.hint`,
    steps
  }
}

export const WIZARD_TOPICS: WizardTopic[] = [
  // 1. 新建简历：新建入口（二级选择含空白/导入）
  topic('new-resume', 'gettingStarted', [
    { textKey: 'wizard.topics.new-resume.step1', targetView: 'resumes-new' },
    { textKey: 'wizard.topics.new-resume.step2' },
    { textKey: 'wizard.topics.new-resume.step3' }
  ]),
  // 2. 导入已有简历：新建里选「导入已有」走三步核对；或管理页批量导入
  topic('import-resume', 'import', [
    { textKey: 'wizard.topics.import-resume.step1', targetView: 'resumes-new' },
    { textKey: 'wizard.topics.import-resume.step2', targetView: 'resumes-manage' },
    { textKey: 'wizard.topics.import-resume.step3' }
  ]),
  // 3. 模板与配色：模板设置屏 + 编辑器顶栏主题色板提示
  topic('template-color', 'gettingStarted', [
    { textKey: 'wizard.topics.template-color.step1', targetView: 'settings-templates' },
    { textKey: 'wizard.topics.template-color.step2' }
  ]),
  // 4. AI 功能：AI 设置屏（BYOK 自带 key 本地加密存）+ AI 分区用法
  topic('ai-usage', 'ai', [
    { textKey: 'wizard.topics.ai-usage.step1', targetView: 'settings-ai' },
    { textKey: 'wizard.topics.ai-usage.step2', targetView: 'ai-home' },
    { textKey: 'wizard.topics.ai-usage.step3' }
  ]),
  // 5. 导出 PDF：编辑器导出入口（含隐私打码选项）
  topic('export-pdf', 'exportSettings', [
    { textKey: 'wizard.topics.export-pdf.step1', targetView: 'editor' },
    { textKey: 'wizard.topics.export-pdf.step2' },
    { textKey: 'wizard.topics.export-pdf.step3' }
  ]),
  // 6. 管理简历：重命名/复制/删除
  topic('manage-resumes', 'gettingStarted', [
    { textKey: 'wizard.topics.manage-resumes.step1', targetView: 'resumes-manage' },
    { textKey: 'wizard.topics.manage-resumes.step2' }
  ]),
  // 7. 数据存放：数据全本机（Documents/xiaomengresume），可改位置
  topic('data-storage', 'exportSettings', [
    { textKey: 'wizard.topics.data-storage.step1', targetView: 'settings-storage' },
    { textKey: 'wizard.topics.data-storage.step2' }
  ])
]
