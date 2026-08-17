import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import type { EditorInstance } from 'novel'
import markdownit from 'markdown-it'

const markdownParser = markdownit({
  html: false,
  linkify: true,
})

function resolveRange(editor: EditorInstance, range?: { from: number; to: number } | null) {
  const maxPos = Math.max(1, editor.state.doc.content.size)
  const clamp = (pos: number) => Math.min(Math.max(1, pos), maxPos)

  if (range) {
    const from = clamp(range.from)
    const to = clamp(range.to)
    return from <= to ? { from, to } : { from: to, to: from }
  }

  const { from, to } = editor.state.selection
  return { from: clamp(from), to: clamp(to) }
}

function createMarkdownSlice(editor: EditorInstance, markdown: string) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = markdownParser.render(markdown.trim())
  return PMDOMParser.fromSchema(editor.state.schema).parseSlice(wrapper)
}

export function renderMarkdownToHtml(markdown: string) {
  return markdownParser.render(markdown.trim())
}

export function replaceEditorRangeWithMarkdown(
  editor: EditorInstance,
  markdown: string,
  range?: { from: number; to: number } | null,
) {
  const normalized = markdown.trim()
  if (!normalized) return false

  const nextRange = resolveRange(editor, range)
  const slice = createMarkdownSlice(editor, normalized)
  const selection = TextSelection.create(editor.view.state.doc, nextRange.from, nextRange.to)

  editor.commands.focus()
  const tr = editor.view.state.tr.setSelection(selection).replaceSelection(slice).scrollIntoView()
  editor.view.dispatch(tr)
  return true
}
