/**
 * AiIntro —— AI 屏自我介绍分区（F20：生成草稿 / AI 翻译，流式 + 接受/放弃）
 * 输入 = 主进程按 resumeId 读简历（generate：buildResumeText；translate：summary.content）；
 * 接受 = store 提交级写入 + 立即保存（AI 屏无 useAutoSave，须手动落盘）。
 * 2026-08-09 T4：改用 AiScreenLayout 共享外壳 + 结果卡片化。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiScreenLayout } from '../components/ai/AiScreenLayout'
import { Button, EmptyState } from '../components/ui'
import { useAiStream } from '../hooks/useAiStream'
import type { RichText } from '@shared/schema/resume'

function textToRichText(text: string): RichText {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

export function AiIntro(): React.JSX.Element {
  const { t } = useTranslation()
  const resumeId = useResumeStore((s) => s.aiContext.resumeId)
  const setField = useResumeStore((s) => s.setField)

  const [mode, setMode] = useState<'generate' | 'translate'>('generate')
  const [accepted, setAccepted] = useState(false)

  const stream = useAiStream({
    start: (requestId) => window.electronAPI.ai.intro({ requestId, resumeId: resumeId ?? '', mode }),
    cancel: (requestId) => window.electronAPI.ai.introCancel(requestId),
    subscribe: (cb) => window.electronAPI.ai.onIntroChunk(cb)
  })

  const accept = async (): Promise<void> => {
    const { resumeId: rid } = useResumeStore.getState()
    if (!rid || !stream.result) return
    const path = mode === 'translate' ? 'summary.enContent' : 'summary.content'
    setField(path, textToRichText(stream.result))
    await window.electronAPI.resumes.save(rid, useResumeStore.getState().resume)
    setAccepted(true)
  }

  const run = (m: 'generate' | 'translate'): void => {
    setMode(m)
    setAccepted(false)
    void stream.run()
  }

  return (
    <AiScreenLayout
      icon="intro"
      backTo="ai-home"
      title={t('navSub.intro')}
      actions={
        <>
          <Button size="sm" variant="default" disabled={stream.busy || !resumeId} onClick={() => run('generate')}>
            {stream.busy && mode === 'generate' ? t('ai.intro.generating') : t('ai.intro.generate')}
          </Button>
          <Button size="sm" variant="outline" disabled={stream.busy || !resumeId} onClick={() => run('translate')} title={t('ai.intro.translateHint')}>
            {stream.busy && mode === 'translate' ? t('ai.intro.translating') : t('ai.intro.translate')}
          </Button>
        </>
      }
    >
      {!resumeId ? (
        <EmptyState title={t('ai.noResumeHint')} desc={t('ai.noResumeDesc')} />
      ) : stream.error ? (
        <EmptyState error title={t('ai.error.' + stream.error.code)} secondary={{ label: t('common.retry'), onClick: () => void run(mode) }} />
      ) : stream.result || stream.busy ? (
        <div className="flex flex-col gap-3">
          <div className="whitespace-pre-wrap rounded-card border border-border bg-surface p-4 shadow-card-press text-sm leading-relaxed text-foreground">
            {stream.result || (stream.busy ? (mode === 'generate' ? t('ai.intro.generating') : t('ai.intro.translating')) : '')}
          </div>
          {stream.result && !stream.busy && !accepted ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="default" onClick={() => void accept()}>
                {t('ai.intro.accept')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => stream.reset()}>
                {t('ai.intro.discard')}
              </Button>
            </div>
          ) : null}
          {accepted ? <p className="text-xs text-foreground/50">{t('ai.polish.applied')}</p> : null}
        </div>
      ) : (
        <EmptyState title={t('navSub.intro')} desc={t('homeDesc.intro')} action={{ label: t('ai.intro.generate'), onClick: () => run('generate') }} />
      )}
    </AiScreenLayout>
  )
}
