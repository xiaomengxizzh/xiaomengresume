/**
 * basics-blocks —— 基本信息前两透明模块（2026-08-25 自 EditorPane.tsx 原样拆出，行为零变化）
 * PhotoBlock：图片模块（照片选择；canvas 压缩 ≤2MB → dataURL）+ 尺寸滑块；
 * IdentityBlock：姓名与职业模块（中文名必显 + 职业固定框）。
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useResumeStore } from '../../store/useResumeStore'
import { Button } from '../ui'
import { showToast } from '../ui/toast'
import { TextField } from '../fields'
import { FieldRow, getString } from './form-kit'

/** P0-3 照片尺寸滑块（40~400 与 schema 一致）：拖动仅改本地 state，松手/失焦才 setField 入历史栈 */
function PhotoSlider({
  labelKey,
  value,
  onCommit
}: {
  labelKey: string
  value: number
  onCommit: (v: number) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <label className="flex items-center gap-1 text-xs text-foreground/70">
      <span>{t(labelKey)}</span>
      <input
        type="range"
        min={40}
        max={400}
        step={1}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onPointerUp={() => onCommit(local)}
        onKeyUp={(e) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) onCommit(local)
        }}
        onBlur={() => onCommit(local)}
        className="w-24 accent-[var(--foreground)]"
      />
      <span className="w-8 tabular-nums">{local}</span>
    </label>
  )
}

export function PhotoBlock(): React.JSX.Element {
  const { t } = useTranslation()
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)

  const pickPhoto = (file: File): void => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (): void => {
      const img = new Image()
      img.onload = (): void => {
        // P1-8 前置压缩收紧（2026-08-21）：头像场景最长边 ≤400px 足够；质量 0.7 起，
        // >150KB 循环降质（下限 0.4）——大图出 dataURL 前置瘦身，减轻历史栈/自动保存/写盘负担。
        const MAX = 400
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, width, height)
        const LIMIT = 150 * 1024
        let quality = 0.7
        let dataUrl = canvas.toDataURL('image/jpeg', quality)
        while (dataUrl.length > LIMIT && quality > 0.4) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
        if (dataUrl.length > LIMIT) {
          // C7（2026-08-25）：降质到下限仍超限 → toast 明示用户换小图（原静默 return）
          showToast(t('editor.photoTooLarge'), 'error')
          return
        }
        setField('basics.photo', dataUrl)
        setField('basics.photoWidth', width)
        setField('basics.photoHeight', height)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex items-center gap-3">
      {resume.basics.photo ? (
        <img
          src={resume.basics.photo}
          alt=""
          className="rounded object-cover"
          style={{ width: Math.min(resume.basics.photoWidth ?? 48, 96), height: Math.min(resume.basics.photoHeight ?? 64, 128), objectFit: 'cover' }}
        />
      ) : null}
      <label className="inline-flex cursor-pointer select-none items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border/40">
        {t('editor.field.photoPick')}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pickPhoto(f)
            e.target.value = ''
          }}
        />
      </label>
      {resume.basics.photo ? (
        <>
          <PhotoSlider
            labelKey="editor.photo.width"
            value={resume.basics.photoWidth ?? 110}
            onCommit={(v) => setField('basics.photoWidth', v)}
          />
          <PhotoSlider
            labelKey="editor.photo.height"
            value={resume.basics.photoHeight ?? 110}
            onCommit={(v) => setField('basics.photoHeight', v)}
          />
          <Button size="sm" variant="ghost" onClick={() => setField('basics.photo', '')}>
            {t('editor.action.remove')}
          </Button>
        </>
      ) : null}
    </div>
  )
}

/** 姓名与职业模块（中文名必显 + 职业固定框） */
export function IdentityBlock(): React.JSX.Element {
  const { t } = useTranslation()
  const setField = useResumeStore((s) => s.setField)
  const resume = useResumeStore((s) => s.resume)
  return (
    <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
      <FieldRow label={t('editor.field.name')}>
        <TextField value={getString(resume.basics.name)} onCommit={(v) => setField('basics.name', v)} />
      </FieldRow>
      <FieldRow label={t('editor.field.jobTitle')}>
        <TextField value={getString(resume.basics.headline)} placeholder={t('editor.field.headline')} onCommit={(v) => setField('basics.headline', v)} />
      </FieldRow>
    </div>
  )
}
