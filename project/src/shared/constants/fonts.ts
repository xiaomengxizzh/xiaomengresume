/**
 * 系统字体静态白名单 —— F4 简历字体（T 批 #23 定案）
 * 跨平台常见中英文字体；id 为存储值（layout.resumeFont），family 为 CSS 字体栈，
 * labelKey 为 i18n 显示名（禁硬编码中文）。M1 最小集 = 系统默认 + 固定几项；
 * M2 起用户导入字体（font:// 协议）扩展。
 * 「系统默认」= 空 family，走现有 fallback 链（PingFang SC / Microsoft YaHei / Noto Sans CJK SC / sans-serif）。
 */
export interface FontOption {
  id: string
  family: string
  labelKey: string
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'system', family: '', labelKey: 'editor.font.system' },
  { id: 'songti', family: 'SimSun, serif', labelKey: 'editor.font.songti' },
  { id: 'heiti', family: 'SimHei, sans-serif', labelKey: 'editor.font.heiti' },
  { id: 'yahei', family: '"Microsoft YaHei", sans-serif', labelKey: 'editor.font.yahei' },
  { id: 'kaiti', family: 'KaiTi, serif', labelKey: 'editor.font.kaiti' },
  { id: 'fangsong', family: 'FangSong, serif', labelKey: 'editor.font.fangsong' },
  { id: 'times', family: '"Times New Roman", serif', labelKey: 'editor.font.times' },
  { id: 'arial', family: 'Arial, sans-serif', labelKey: 'editor.font.arial' },
  { id: 'georgia', family: 'Georgia, serif', labelKey: 'editor.font.georgia' }
]

export const DEFAULT_FONT_ID = 'system'
