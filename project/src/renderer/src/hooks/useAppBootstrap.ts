/**
 * useAppBootstrap —— F11 启动恢复（§5.3）
 * ① 崩溃恢复扫描：残留 .tmp → confirm 恢复（三件套 a，落地不降级）
 * ② 启动恢复：打开最近编辑的简历（M1 简化用 recent[0]；lastEditedResumeId 键随 M5 设置屏完善）
 * 空 → 保持空简历（M1 无欢迎面板，编辑器直达；欢迎态随导航中枢里程碑）
 * M2 F5 D10：export 模式（打印窗口）→ 跳过恢复/最近，直接按 ?resumeId= 加载指定简历。
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'

export function useAppBootstrap(): void {
  const { t } = useTranslation()
  useEffect(() => {
    const init = async (): Promise<void> => {
      try {
        // M2 F5 D10：导出模式（打印窗口）→ 按 resumeId 加载，跳过常规启动流程
        const params = new URLSearchParams(window.location.search)
        if (params.get('export') === '1') {
          const resumeId = params.get('resumeId')
          if (resumeId) {
            const resume = await window.electronAPI.resumes.open(resumeId)
            useResumeStore.getState().loadResume(resumeId, resume)
            // B 档（2026-08-10）：导出窗口为独立渲染进程，隐私状态经 URL 传参注入 store
            //（模板 data-redact 消费 store.privacyMode）；语言经 i18n/index.ts 初始化处理。
            if (params.get('privacyMode') === '1') {
              useResumeStore.setState({ privacyMode: true })
            }
          }
          return
        }

        // 崩溃恢复
        const pending = await window.electronAPI.resumes.scanRecovery()
        for (const id of pending) {
          // 同步确认弹窗（Electron renderer 支持 window.confirm）
          if (window.confirm(t('editor.recovery.confirm', { id: id.slice(0, 8) }))) {
            try {
              await window.electronAPI.resumes.recover(id)
            } catch {
              // 2026-08-08：单条恢复失败不阻断其余恢复与最近简历加载（原抛错连带跳过下方流程）
              window.alert(t('editor.recovery.failed', { id: id.slice(0, 8) }))
            }
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
      // M5 设置加载（P1 修复批 F6，2026-08-23：独立段不与前段共 try——原串联写法下
      // scanRecovery/recent 任一 reject 会跳过 settings.get → 设置静默回出厂）；
      // 失败上报 console（渲染层可观测），保持出厂默认不中断启动
      try {
        const settings = await window.electronAPI.settings.get()
        useResumeStore.getState().setSettings(settings)
      } catch (e) {
        console.error('[useAppBootstrap] settings:get failed', e)
      }
    }
    void init()
  }, [])
}
