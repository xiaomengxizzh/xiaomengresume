/**
 * AiIntro —— AI 屏自我介绍分区（F20：生成草稿 / AI 翻译，流式 + 接受/放弃）
 * 输入 = 主进程按 resumeId 读简历（generate：buildResumeText；translate：summary.content）；
 * 接受 = store 提交级写入 + 立即保存（AI 屏无 useAutoSave，须手动落盘）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../store/useResumeStore'
import { AiContextBar } from '../components/ai/AiContextBar'
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
    <div className="flex h-full flex-col">
      <AiContextBar />
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-2">
        <h2 className="text-sm font-semibold">{t('navSub.intro')}</h2>
        <button
          type="button"
          className="rounded bg-foreground px-2 py-0.5 text-xs text-surface disabled:opacity-50"
          disabled={stream.busy || !resumeId}
          onClick={() => run('generate')}
        >
          {stream.busy && mode === 'generate' ? t('ai.intro.generating') : t('ai.intro.generate')}
        </button>
        <button
          type="button"
          className="rounded border border-border px-2 py-0.5 text-xs text-foreground/70 hover:text-foreground disabled:opacity-50"
          disabled={stream.busy || !resumeId}
          onClick={() => run('translate')}
          title={t('ai.intro.translateHint')}
        >
          {stream.busy && mode === 'translate' ? t('ai.intro.translating') : t('ai.intro.translate')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!resumeId ? (
          <p className="text-sm text-foreground/50">{t('ai.noResumeHint')}</p>
        ) : stream.error ? (
          <p className="text-sm text-red-500">{t('ai.error.' + stream.error.code)}</p>
        ) : stream.result || stream.busy ? (
          <div className="flex flex-col gap-2">
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
              {stream.result || (stream.busy ? (mode === 'generate' ? t('ai.intro.generating') : t('ai.intro.translating')) : '')}
            </div>
            {stream.result && !stream.busy && !accepted ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded bg-foreground px-2 py-0.5 text-xs text-surface"
                  onClick={() => void accept()}
                >
                  {t('ai.intro.accept')}
                </button>
                <button
                  type="button"
                  className="text-xs text-foreground/60 hover:text-foreground"
                  onClick={() => stream.reset()}
                >
                  {t('ai.intro.discard')}
                </button>
              </div>
            ) : null}
            {accepted ? <p className="text-xs text-foreground/50">{t('ai.polish.applied')}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-foreground/50">{t('homeDesc.intro')}</p>
        )}
      </div>
    </div>
  )
}
