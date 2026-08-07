/**
 * TopBar —— 编辑器顶栏（2026-08-07 UI 重构瘦身）
 * 仅保留：简历名（可编辑）+ 模板 + 主题色（推荐色板+自定义）+ 字体 + 保存状态徽标。
 * 已移除：新建/示例/撤销重做按钮/AI 润色（撤销快捷键保留；示例改 Ctrl+Shift+O 隐藏通道）。
 * 保存状态：EditorView 挂载 useAutoSave 后经 prop 传入（2026-08-08 二次评估修复 P0-1：
 * 此前 useAutoSave 全仓库零调用，编辑内容永不落盘；状态徽标 i18n key 早已存在）。
 */
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { TemplateBar } from './TemplateBar'
import type { SaveState } from '../../hooks/useAutoSave'

/** 保存状态徽标文案（editor.saveState.*；error 态降级为 idle 文案 + 红点样式） */
const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'editor.saveState.idle',
  saving: 'editor.saveState.saving',
  saved: 'editor.saveState.saved',
  error: 'editor.saveState.saved'
}

export function TopBar({ saveState }: { saveState?: SaveState }): React.JSX.Element {
  const { t } = useTranslation()
  const name = useResumeStore((s) => s.resume.basics.name)
  const setField = useResumeStore((s) => s.setField)

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
    </header>
  )
}
