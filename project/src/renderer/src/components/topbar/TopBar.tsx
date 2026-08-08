/**
 * TopBar —— 编辑器顶栏（2026-08-07 UI 重构瘦身；2026-08-08 M2 加导出/隐私）
 * 简历名（可编辑）+ 模板 + 主题色（推荐色板+自定义）+ 字体 + 保存状态徽标 + 导出按钮 + 隐私开关。
 * 已移除：新建/示例/撤销重做按钮/AI 润色（撤销快捷键保留；示例改 Ctrl+Shift+O 隐藏通道）。
 * 保存状态：EditorView 挂载 useAutoSave 后经 prop 传入（2026-08-08 二次评估修复 P0-1）。
 * 导出按钮：M2 F5 入口（D4 模态弹窗由 EditorView 持有）。
 * 隐私开关：M2 F16（D6 全部基本信息脱敏；lucide-eye 语义用内联 SVG 替代——lucide 未引入，零新依赖）。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { TemplateBar } from './TemplateBar'
import { Button } from '../ui'
import type { SaveState } from '../../hooks/useAutoSave'

/** 保存状态徽标文案（editor.saveState.*；error 态降级为 idle 文案 + 红点样式） */
const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'editor.saveState.idle',
  saving: 'editor.saveState.saving',
  saved: 'editor.saveState.saved',
  error: 'editor.saveState.saved'
}

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

export function TopBar({ saveState, onExport }: { saveState?: SaveState; onExport?: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  const name = useResumeStore((s) => s.resume.basics.name)
  const setField = useResumeStore((s) => s.setField)
  const privacyMode = useResumeStore((s) => s.privacyMode)
  const togglePrivacyMode = useResumeStore((s) => s.togglePrivacyMode)

  return (
    <header className="topbar">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <label className="shrink-0 text-xs text-foreground/60">{t('editor.resumeName')}</label>
        <input
          className="min-w-0 flex-1 max-w-[360px] border-b border-transparent bg-transparent text-sm font-medium text-foreground outline-none transition-colors hover:border-border focus:border-foreground/40"
          value={name}
          placeholder="…"
          onChange={(e) => setField('basics.name', e.target.value)}
        />
        {saveState ? (
          <span className={`status-badge ${saveState}`} title={saveState === 'error' ? t('editor.saveState.errorHint') : undefined}>
            {t(SAVE_LABEL[saveState])}
          </span>
        ) : null}
      </div>
      <TemplateBar />
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
        <Button size="sm" variant="outline" onClick={onExport}>
          {t('export.title')}
        </Button>
      ) : null}
    </header>
  )
}
