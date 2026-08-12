/**
 * SettingsAppearance —— M5-4 D1 外观屏（设置区第 1 屏）
 * 内容：4 色主题单选（300ms 实时预览）+ 跟随系统（仅 dark 有效）+ 语言 + D2 自定义主题（primary 派生）
 *       + D5 字体系统（界面字体 uiFont 下拉 + 导入字体管理 + 许可提示）
 * 持久化走 settings:set（M5-3 链路）；主题应用由 useThemeApplier 接管（App 级）。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { Button } from '../components/ui'
import { THEME_COLOR_PRESETS } from '@shared/constants/theme-colors'

const APPEARANCES = ['light', 'dark', 'beige', 'green'] as const

/** 系统字体枚举（Local Font Access API，渲染层；session 权限已放行） */
function useSystemFonts(): string[] {
  const [fonts, setFonts] = useState<string[]>([])
  useEffect(() => {
    const q = (window as unknown as { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts
    if (typeof q !== 'function') return
    q()
      .then((list) => setFonts([...new Set(list.map((f) => f.family))].sort()))
      .catch(() => {
        // 权限拒绝/API 不可用：静默回落内置白名单
      })
  }, [])
  return fonts
}

export function SettingsAppearance(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useResumeStore((s) => s.settings)
  const setSettings = useResumeStore((s) => s.setSettings)
  const sysFonts = useSystemFonts()
  const [customHex, setCustomHex] = useState(settings.customTheme?.primary ?? '#5b6abf')

  // 导入字体 @font-face 注入（font:// 协议；卸载不清理——应用生命周期内常驻，重载覆盖）
  useEffect(() => {
    const faces = (settings.importedFonts ?? []).map((f) => {
      const ext = f.fileName.split('.').pop() ?? 'ttf'
      const face = new FontFace(f.family, `url('font:///${f.id}.${ext}')`)
      face.load().then((loaded) => document.fonts.add(loaded)).catch(() => {})
      return face
    })
    return () => {
      // FontFace 无同步 delete；重复 add 同 family 会覆盖，无需清理
      void faces
    }
  }, [settings.importedFonts])

  const importFont = async (): Promise<void> => {
    // 许可提示（定案：仅本机使用、不重新分发）
    if (!window.confirm(t('settings.fonts.licenseNote'))) return
    const entry = await window.electronAPI.font.import()
    if (entry) {
      setSettings({ importedFonts: [...(settings.importedFonts ?? []), entry] })
    }
  }
  const removeFont = async (id: string): Promise<void> => {
    await window.electronAPI.font.remove(id)
    setSettings({ importedFonts: (settings.importedFonts ?? []).filter((f) => f.id !== id) })
  }

  return (
    <div className="home-view">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground/70 transition-colors hover:bg-border/40 hover:text-foreground"
          onClick={() => useResumeStore.getState().setCurrentView('settings-home')}
        >
          ← {t('common.back')}
        </button>
        <h2 className="home-title">{t('settings.appearance.title')}</h2>
      </div>

      {/* D1：4 色主题单选（300ms 实时预览由 useThemeApplier 处理） */}
      <div className="mb-4">
        <div className="mb-2 text-sm text-foreground/80">{t('settings.appearance.theme')}</div>
        <div className="grid grid-cols-4 gap-2">
          {APPEARANCES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setSettings({ appearance: a })}
              className={`rounded-lg border p-2 text-center transition-colors ${
                settings.appearance === a ? 'border-foreground bg-selected/30' : 'border-border hover:bg-selected/20'
              }`}
            >
              <span className={`mx-auto mb-1 block h-6 w-6 rounded-full border border-border`} data-theme-swatch={a} />
              <span className="text-xs">{t(`settings.appearance.${a}`)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* D1：跟随系统（仅 dark 有效；其余三色固定） */}
      <div className="mb-4">
        <div className="mb-2 text-sm text-foreground/80">{t('settings.appearance.mode')}</div>
        <div className="flex gap-2">
          {(['fixed', 'system'] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={settings.appearance !== 'dark' && m === 'system'}
              onClick={() => setSettings({ appearanceMode: m })}
              className={`rounded-md border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
                settings.appearanceMode === m ? 'border-foreground bg-selected/40 text-foreground' : 'border-border text-foreground/70'
              }`}
            >
              {t(`settings.appearance.modeOptions.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {/* D1：语言（F13 T5：仅切 UI 文案） */}
      <div className="mb-4">
        <div className="mb-2 text-sm text-foreground/80">{t('settings.appearance.language')}</div>
        <div className="flex gap-2">
          {(['zh-CN', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setSettings({ language: l })}
              className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                settings.language === l ? 'border-foreground bg-selected/40 text-foreground' : 'border-border text-foreground/70'
              }`}
            >
              {l === 'zh-CN' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* D2：自定义主题（primary 派生全套令牌，deriveTokens 护栏保证对比度） */}
      <div className="mb-4">
        <div className="mb-2 text-sm text-foreground/80">{t('settings.appearance.customTheme')}</div>
        <div className="flex flex-wrap items-center gap-2">
          {THEME_COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              title={t(c.labelKey)}
              onClick={() => {
                setCustomHex(c.value)
                setSettings({ customTheme: { primary: c.value } })
              }}
              className={`h-6 w-6 rounded-full border transition-transform ${settings.customTheme?.primary === c.value ? 'scale-110 border-foreground' : 'border-border'}`}
              style={{ background: c.value }}
            />
          ))}
          <label className="flex items-center gap-1 text-xs text-foreground/60">
            <input
              type="color"
              value={customHex}
              onChange={(e) => {
                setCustomHex(e.target.value)
                setSettings({ customTheme: { primary: e.target.value } })
              }}
              className="h-6 w-8 cursor-pointer border-none bg-transparent"
            />
            {t('settings.appearance.customHex')}
          </label>
          {settings.customTheme?.primary ? (
            <Button variant="ghost" size="sm" onClick={() => setSettings({ customTheme: {} })}>
              {t('settings.appearance.customReset')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* D5：界面字体（uiFont）+ 导入字体管理 */}
      <div>
        <div className="mb-2 text-sm text-foreground/80">{t('settings.fonts.title')}</div>
        <div className="flex items-center gap-2">
          <select
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            value={settings.uiFont}
            onChange={(e) => setSettings({ uiFont: e.target.value })}
          >
            <option value="system">{t('settings.fonts.fontSystem')}</option>
            {sysFonts.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
            {(settings.importedFonts ?? []).map((f) => (
              <option key={f.id} value={f.family}>
                {f.family}（{t('settings.fonts.imported')}）
              </option>
            ))}
          </select>
          <Button size="sm" variant="default" onClick={() => void importFont()}>
            {t('settings.fonts.import')}
          </Button>
        </div>
        {(settings.importedFonts ?? []).length > 0 ? (
          <ul className="mt-2 space-y-1">
            {(settings.importedFonts ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs">
                <span className="truncate text-foreground/80">{f.family}</span>
                <button type="button" className="text-foreground/40 hover:text-danger" onClick={() => void removeFont(f.id)}>
                  {t('settings.fonts.remove')}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
