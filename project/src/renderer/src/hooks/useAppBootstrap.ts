/**
 * useAppBootstrap —— F11 启动恢复（§5.3）
 * ① 崩溃恢复扫描：残留 .tmp → confirm 恢复（三件套 a，落地不降级）
 * ② 启动恢复：打开最近编辑的简历（M1 简化用 recent[0]；lastEditedResumeId 键随 M5 设置屏完善）
 * 空 → 保持空简历（M1 无欢迎面板，编辑器直达；欢迎态随导航中枢里程碑）
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'

export function useAppBootstrap(): void {
  const { t } = useTranslation()
  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        // 崩溃恢复
        const pending = await window.electronAPI.resumes.scanRecovery()
        for (const id of pending) {
          // 同步确认弹窗（Electron renderer 支持 window.confirm）
          if (window.confirm(t('editor.recovery.confirm', { id: id.slice(0, 8) }))) {
            await window.electronAPI.resumes.recover(id)
          }
        }
        // 启动恢复最近简历（2026-08-07 修正：仅预加载数据，不自动切编辑器——
        // 用户要求启动先进入欢迎页；数据就绪后用户从欢迎页主动进入编辑器）
        const recent = await window.electronAPI.resumes.recent()
        if (recent.length > 0) {
          const r = await window.electronAPI.resumes.open(recent[0].id)
          useResumeStore.getState().loadResume(recent[0].id, r)
        }
      } catch {
        // 存储目录不可用/首启无数据：静默保持空简历
      }
    }
    void init()
  }, [])
}
