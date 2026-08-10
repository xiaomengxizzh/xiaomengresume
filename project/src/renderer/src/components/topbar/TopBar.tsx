/**
 * TopBar —— 编辑器顶栏（2026-08-07 UI 重构瘦身；2026-08-08 M2 加导出/隐私）
 * 简历名称（可编辑）+ 模板 + 主题色（推荐色板+自定义）+ 字体 + 导出按钮 + 隐私开关。
 * 已移除：新建/示例/撤销重做按钮/AI 润色（撤销快捷键保留；示例改 Ctrl+Shift+O 隐藏通道）。
 * 2026-08-09 T2：移除「保存中/已保存」状态徽标（晃眼）——自动保存成功提示移至底部状态栏轻提示（EditorView）。
 * 2026-08-09 T3：简历名称输入改编辑 `resume.title`（简历文件标题），与 `basics.name`（姓名）独立。
 * 导出按钮：M2 F5 入口（D4 模态弹窗由 EditorView 持有）。
 * 隐私开关：M2 F16（D6 全部基本信息脱敏；lucide-eye 语义用内联 SVG 替代——lucide 未引入，零新依赖）。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { TemplateBar } from './TemplateBar'
import { Button } from '../ui'

/** M2 F16：隐私开关 eye 图标（内联 SVG，零依赖） */
function EyeIcon({ size = 15 }: { size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function TopBar({ onExport }: { onExport?: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const title = useResumeStore((s) => s.resume.title)
  const setField = useResumeStore((s) => s.setField)
  const privacyMode = useResumeStore((s) => s.privacyMode)
  const togglePrivacyMode = useResumeStore((s) => s.togglePrivacyMode)

  return (
    <header className="topbar">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <label className="shrink-0 text-xs text-foreground/60">{t('editor.resumeName')}</label>
        <input
          className="min-w-0 flex-1 max-w-[360px] rounded-md border-b border-border/60 bg-border/10 px-2 py-1 text-sm font-medium text-foreground outline-none transition-colors hover:bg-border/20 focus:border-foreground/40 focus:bg-transparent"
          value={title ?? ''}
          placeholder={t('editor.resumeNamePlaceholder')}
          onChange={(e) => setField('title', e.target.value)}
        />
      </div>
      <TemplateBar />
      <span aria-hidden className="mx-0.5 h-5 w-px shrink-0 bg-border" />
      {/* M2 F16 隐私开关（Ctrl+Shift+P 快捷键同效） */}
      <button
        type="button"
        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
          privacyMode ? 'bg-selected text-foreground' : 'text-foreground/50 hover:bg-selected/50 hover:text-foreground'
        }`}
        title={t(privacyMode ? 'editor.privacyOff' : 'editor.privacyOn')}
        aria-pressed={privacyMode}
        onClick={togglePrivacyMode}
      >
        <EyeIcon />
      </button>
      {onExport ? (
        <Button size="sm" variant="default" onClick={onExport}>
          {t('export.title')}
        </Button>
      ) : null}
    </header>
  )
}
