'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useEffect, useRef } from 'react'
import katex from 'katex'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (options: { latex?: string; displayMode?: boolean }) => ReturnType
    }
  }
}

// ── React 组件：数学公式渲染 ──
function MathComponent(props: ReactNodeViewProps) {
  const { node, updateAttributes, selected } = props
  const latex = (node.attrs.latex as string) || ''
  const displayMode = (node.attrs.displayMode as boolean) ?? false
  const [editing, setEditing] = useState(!latex)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const renderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editing && latex && renderRef.current) {
      try {
        katex.render(latex, renderRef.current, {
          displayMode,
          throwOnError: false,
          output: 'html',
        })
      } catch {
        renderRef.current.textContent = latex
      }
    }
  }, [latex, displayMode, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (editing) {
    return (
      <NodeViewWrapper className="math-node-editing" data-type="math">
        <div className="math-editor-container">
          <label className="math-editor-label">
            {displayMode ? '块级公式 (LaTeX)' : '行内公式 (LaTeX)'}
          </label>
          <textarea
            ref={inputRef}
            defaultValue={latex}
            placeholder="E = mc^2"
            rows={displayMode ? 3 : 1}
            className="math-editor-input"
            onBlur={(e) => {
              const val = e.target.value.trim()
              if (val) {
                updateAttributes({ latex: val })
                setEditing(false)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                const val = (e.target as HTMLTextAreaElement).value.trim()
                if (val) {
                  updateAttributes({ latex: val })
                  setEditing(false)
                }
              }
              if (e.key === 'Escape') {
                setEditing(false)
              }
            }}
          />
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      className={`math-node-rendered ${selected ? 'math-selected' : ''}`}
      data-type="math"
      onClick={() => setEditing(true)}
      title="点击编辑公式"
    >
      <div ref={renderRef} className={displayMode ? 'math-display' : 'math-inline'} />
    </NodeViewWrapper>
  )
}

// ── Tiptap Node 扩展 ──
export const MathNode = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      latex: { default: '' },
      displayMode: { default: true },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-math-latex]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const latex = HTMLAttributes.latex || ''
    const displayMode = HTMLAttributes.displayMode !== false
    let rendered = ''
    try {
      rendered = katex.renderToString(latex, { displayMode, throwOnError: false })
    } catch {
      rendered = `<code>${latex}</code>`
    }
    return [
      'div',
      mergeAttributes(
        { 'data-math-latex': latex, 'data-display-mode': String(displayMode), class: 'math-block-wrapper' },
        HTMLAttributes
      ),
      rendered,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent)
  },

  addCommands() {
    return {
      setMathBlock:
        (options: { latex?: string; displayMode?: boolean }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { latex: options.latex ?? '', displayMode: options.displayMode ?? true },
          })
        },
    }
  },
})
