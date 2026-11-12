'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'
import {
  EditorContent,
  type EditorInstance,
  EditorRoot,
  useEditor,
} from 'novel'
import { buildEditorProps, createEditorExtensions } from '@/lib/editor-extensions'

const toolbarButton = 'inline-flex size-9 items-center justify-center rounded-lg text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)] focus-visible:outline-2 focus-visible:outline-[var(--editor-accent)] disabled:cursor-not-allowed disabled:opacity-35'
const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] }

function normalizeLink(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function AboutToolbar({ characters }: { characters: number }) {
  const { editor } = useEditor()

  function setLink() {
    if (!editor) return
    const current = editor.getAttributes('link').href as string | undefined
    const next = window.prompt('请输入链接地址', current || 'https://')
    if (next === null) return
    if (!next.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalizeLink(next.trim()) }).run()
  }

  const button = (label: string, action: () => void, icon: React.ReactNode, active = false, disabled = false) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!editor || disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
      className={`${toolbarButton} ${active ? 'bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] hover:bg-[var(--editor-accent)] hover:text-[var(--editor-accent-ink)]' : ''}`}
    >
      {icon}
    </button>
  )

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-1 border-b border-[var(--editor-line)] bg-[var(--editor-panel)]/95 px-3 py-2 backdrop-blur">
      {button('二级标题', () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), <Heading2 className="size-4" />, editor?.isActive('heading', { level: 2 }))}
      {button('三级标题', () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), <Heading3 className="size-4" />, editor?.isActive('heading', { level: 3 }))}
      <span className="mx-1 h-5 w-px bg-[var(--editor-line)]" aria-hidden="true" />
      {button('加粗', () => editor?.chain().focus().toggleBold().run(), <Bold className="size-4" />, editor?.isActive('bold'))}
      {button('斜体', () => editor?.chain().focus().toggleItalic().run(), <Italic className="size-4" />, editor?.isActive('italic'))}
      {button('下划线', () => editor?.chain().focus().toggleUnderline().run(), <UnderlineIcon className="size-4" />, editor?.isActive('underline'))}
      {button('删除线', () => editor?.chain().focus().toggleStrike().run(), <Strikethrough className="size-4" />, editor?.isActive('strike'))}
      {button('链接', setLink, <Link2 className="size-4" />, editor?.isActive('link'))}
      <span className="mx-1 h-5 w-px bg-[var(--editor-line)]" aria-hidden="true" />
      {button('无序列表', () => editor?.chain().focus().toggleBulletList().run(), <List className="size-4" />, editor?.isActive('bulletList'))}
      {button('有序列表', () => editor?.chain().focus().toggleOrderedList().run(), <ListOrdered className="size-4" />, editor?.isActive('orderedList'))}
      {button('引用', () => editor?.chain().focus().toggleBlockquote().run(), <Quote className="size-4" />, editor?.isActive('blockquote'))}
      {button('清除格式', () => editor?.chain().focus().clearNodes().unsetAllMarks().run(), <RemoveFormatting className="size-4" />)}
      <span className="mx-1 h-5 w-px bg-[var(--editor-line)]" aria-hidden="true" />
      {button('撤销', () => editor?.chain().focus().undo().run(), <Undo2 className="size-4" />, false, !editor?.can().undo())}
      {button('重做', () => editor?.chain().focus().redo().run(), <Redo2 className="size-4" />, false, !editor?.can().redo())}
      <span className="ml-auto px-2 text-xs tabular-nums text-[var(--stone-gray)]">{characters.toLocaleString()} 字</span>
    </div>
  )
}

function SyncExternalContent({ value, onCharacters }: { value: string; onCharacters: (count: number) => void }) {
  const { editor } = useEditor()
  useEffect(() => {
    if (!editor || editor.getHTML() === value) return
    editor.commands.setContent(value, false)
    onCharacters(editor.getText().length)
  }, [editor, onCharacters, value])
  return null
}

export function AboutRichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [characters, setCharacters] = useState(0)
  const extensions = useMemo(() => createEditorExtensions(), [])

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-[var(--background)]">
      <EditorRoot>
        <EditorContent
          initialContent={EMPTY_DOCUMENT}
          // Novel owns a nested Tiptap version, so its extension list must stay together.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extensions={extensions as any}
          immediatelyRender={false}
          editorProps={buildEditorProps(undefined, undefined, 'about-editor-prose')}
          slotBefore={<AboutToolbar characters={characters} />}
          onCreate={({ editor }: { editor: EditorInstance }) => {
            editor.commands.setContent(value, false)
            setCharacters(editor.getText().length)
          }}
          onUpdate={({ editor }: { editor: EditorInstance }) => {
            setCharacters(editor.getText().length)
            onChange(editor.getHTML())
          }}
        >
          <SyncExternalContent value={value} onCharacters={setCharacters} />
        </EditorContent>
      </EditorRoot>
    </div>
  )
}
