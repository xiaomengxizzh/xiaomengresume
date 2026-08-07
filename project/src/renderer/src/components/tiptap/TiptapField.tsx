/**
 * TiptapField —— F2 富文本控件（§3.4）
 * Tiptap v3 + StarterKit（加粗/斜体/列表）+ Link。绑定 RichText 字段：
 * 编辑时输出 Tiptap JSON（{type:'doc',content}），读入时 JSON 优先、HTML 降级。
 * 内部 undo 隔离（F3 §4.1）：Ctrl+Z 在编辑器聚焦时交回 Tiptap 内部栈（快捷键 hook 处理）。
 */
import { useEffect, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import type { RichText } from '@shared/schema/resume'

interface TiptapFieldProps {
  value: RichText | undefined
  onChange: (v: RichText) => void
  className?: string
}

function ToolBtn({
  active = false,
  onMouseDown,
  title,
  children
}: {
  active?: boolean
  onMouseDown: () => void
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault()
        onMouseDown()
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded text-[13px] transition-colors ${active ? 'bg-foreground/15 text-foreground' : 'text-foreground/60 hover:bg-foreground/10'}`}
    >
      {children}
    </button>
  )
}

export function TiptapField({ value, onChange }: TiptapFieldProps): React.JSX.Element {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true })
    ],
    content: value ?? { type: 'doc', content: [] },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      onChange({ type: 'doc', content: json.content ?? [] })
    }
  })

  // 外部 value 变化（撤销/重做/加载）→ 同步编辑器（聚焦时不打断输入）
  useEffect(() => {
    if (!editor) return
    if (typeof value === 'string') {
      // HTML 降级：仅初始渲染
      return
    }
    const current = JSON.stringify(editor.getJSON().content ?? [])
    const incoming = JSON.stringify(value?.content ?? [])
    if (current !== incoming && !editor.isFocused) {
      editor.commands.setContent(value ?? { type: 'doc', content: [] }, { emitUpdate: false })
    }
  }, [value, editor])

  const applyLink = (): void => {
    if (!editor) return
    const url = linkUrl.trim()
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setLinkOpen(false)
    setLinkUrl('')
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-0.5 border-b border-border/70 px-1.5 py-1">
        <ToolBtn
          title="B"
          active={editor?.isActive('bold')}
          onMouseDown={() => editor?.chain().focus().toggleBold().run()}
        >
          <b>B</b>
        </ToolBtn>
        <ToolBtn
          title="I"
          active={editor?.isActive('italic')}
          onMouseDown={() => editor?.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </ToolBtn>
        <ToolBtn
          title="•"
          active={editor?.isActive('bulletList')}
          onMouseDown={() => editor?.chain().focus().toggleBulletList().run()}
        >
          •≡
        </ToolBtn>
        <ToolBtn
          title="1."
          active={editor?.isActive('orderedList')}
          onMouseDown={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          1≡
        </ToolBtn>
        <ToolBtn
          title="🔗"
          active={editor?.isActive('link')}
          onMouseDown={() => setLinkOpen((v) => !v)}
        >
          🔗
        </ToolBtn>
      </div>
      {linkOpen ? (
        <div className="flex items-center gap-1 border-b border-border/70 px-2 py-1">
          <input
            className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-0.5 text-xs outline-none focus:border-foreground/50"
            placeholder="https://…"
            value={linkUrl}
            autoFocus
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyLink()
              if (e.key === 'Escape') setLinkOpen(false)
            }}
          />
          <button type="button" className="text-xs text-foreground/70 hover:text-foreground" onClick={applyLink}>
            ✓
          </button>
        </div>
      ) : null}
      <EditorContent editor={editor} className="tiptap-content px-3 py-2 text-sm" />
    </div>
  )
}
