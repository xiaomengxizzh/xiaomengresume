/**
 * TiptapField —— F2 富文本控件（§3.4）
 * Tiptap v3 + StarterKit（加粗/斜体/列表）+ Link。绑定 RichText 字段：
 * 编辑时输出 Tiptap JSON（{type:'doc',content}），读入时 JSON 优先、HTML 降级。
 * F3 统一撤销栈（2026-08-08 修复 P1）：禁用 Tiptap 内部 UndoRedo，Ctrl+Z/Y 全部走
 * store 50 步栈，消除双栈双向污染（详见 useEditor 注释）。
 */
import { useEffect, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import type { RichText } from '@shared/schema/resume'

interface TiptapFieldProps {
  value: RichText | undefined
  onChange: (v: RichText) => void
  className?: string
  /** M3 F7/F8：编辑器实例上抛（选区读取/语法 Mark/替换需要；可选，向后兼容） */
  onEditorReady?: (editor: Editor) => void
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

export function TiptapField({ value, onChange, onEditorReady }: TiptapFieldProps): React.JSX.Element {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)

  const editor = useEditor({
    extensions: [
      // F3 统一撤销栈（2026-08-08 修复 P1）：禁用 Tiptap 内部 UndoRedo。
      // 原实现：Tiptap 内部 undo 触发 onUpdate → setField → history.record 把
      // 「撤销前的状态」压入 store 栈；store 撤销后的 setContent 又进 Tiptap 内部栈——
      // 双栈双向污染致撤销行为不可预测。统一走 store 栈后撤销/重做语义单一、可预测。
      StarterKit.configure({ undoRedo: false }),
      Link.configure({ openOnClick: false, autolink: true })
    ],
    content: value ?? { type: 'doc', content: [] },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      onChange({ type: 'doc', content: json.content ?? [] })
    }
  })

  // M3 F7/F8：编辑器实例上抛（父组件读选区/语法 Mark/替换；幂等，StrictMode 安全）
  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor)
  }, [editor, onEditorReady])

  // 外部 value 变化（撤销/重做/加载/HTML 降级快照）→ 同步编辑器。
  // P1/P2 修复：移除 isFocused 拦截——统一撤销栈后 store undo 在 Tiptap 聚焦时也必须
  // 更新编辑器（原守卫导致聚焦时撤销无效）；用户输入产生的 value 变化 current===incoming
  // 天然跳过 setContent，不会打断打字。HTML 字符串分支原直接 return（撤销回 HTML 字符串
  // 快照时编辑器不更新，继续输入会把错误内容写回 store），现以 HTML 解析同步。
  useEffect(() => {
    if (!editor) return
    if (typeof value === 'string') {
      const currentHtml = editor.getHTML()
      if (currentHtml !== value) {
        editor.commands.setContent(value, { emitUpdate: false })
      }
      return
    }
    const current = JSON.stringify(editor.getJSON().content ?? [])
    const incoming = JSON.stringify(value?.content ?? [])
    if (current !== incoming) {
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
