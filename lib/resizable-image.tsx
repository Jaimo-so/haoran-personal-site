'use client'

import { useToast } from '@/components/Toast'
import { mergeAttributes } from '@tiptap/core'
import Image, { type ImageOptions } from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { AlignCenter, AlignLeft, Copy, Crop, Download, ImagePlus, MoreHorizontal, WandSparkles } from 'lucide-react'
import { UploadImagesPlugin } from 'novel'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { copyEditorImage, downloadEditorImage } from './editor-file-upload'

export type EditorImageAlignment = 'left' | 'center'

export interface EditorImageActionTarget {
  alt: string
  pos: number | null
  src: string
}

export interface ResizableImageActionHandlers {
  onOpenCrop?: (target: EditorImageActionTarget) => void
  onOpenReferenceImage?: (target: EditorImageActionTarget) => void
  onSetCover?: (target: EditorImageActionTarget) => void
}

declare module '@tiptap/extension-image' {
  interface ImageOptions {
    imageActions: ResizableImageActionHandlers
  }
}

type ResizableImageNode = {
  attrs: {
    align?: EditorImageAlignment
    alt?: string
    src: string
    title?: string
    width?: number | string | null
  }
}

const CONTEXT_MENU_WIDTH = 220

function normalizeAlignment(value: unknown): EditorImageAlignment {
  return value === 'left' ? 'left' : 'center'
}

function buildWidthStyle(width: number | string | null | undefined) {
  if (!width) return ''
  return typeof width === 'number' ? `${width}px` : String(width)
}

function buildImageStyle(width: number | string | null | undefined, align: EditorImageAlignment) {
  const styles = ['display: block', 'max-width: 100%']
  const widthStyle = buildWidthStyle(width)

  if (widthStyle) {
    styles.push(`width: ${widthStyle}`)
  }

  if (align === 'left') {
    styles.push('margin-left: 0', 'margin-right: auto')
  } else {
    styles.push('margin-left: auto', 'margin-right: auto')
  }

  return styles.join('; ')
}

function clampMenuPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y }

  return {
    x: Math.max(12, Math.min(x, window.innerWidth - CONTEXT_MENU_WIDTH - 12)),
    y: Math.max(12, Math.min(y, window.innerHeight - 280)),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResizableImageView(props: any) {
  const {
    editor,
    extension,
    getPos,
    node,
    selected,
    updateAttributes,
  } = props as {
    editor: {
      commands: {
        setNodeSelection?: (pos: number) => void
      }
    }
    extension: {
      options?: {
        imageActions?: ResizableImageActionHandlers
      }
    }
    getPos?: (() => number) | boolean
    node: ResizableImageNode
    selected: boolean
    updateAttributes: (attrs: Record<string, unknown>) => void
  }

  const imgRef = useRef<HTMLImageElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [resizing, setResizing] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const align = normalizeAlignment(node.attrs.align)
  const imageActions = extension.options?.imageActions
  const toast = useToast()

  const imageTarget = useMemo<EditorImageActionTarget>(() => {
    const position = typeof getPos === 'function' ? getPos() : null
    return {
      src: node.attrs.src,
      alt: node.attrs.alt || node.attrs.title || '',
      pos: Number.isFinite(position) ? Number(position) : null,
    }
  }, [getPos, node.attrs.alt, node.attrs.src, node.attrs.title])

  const closeMenu = useCallback(() => {
    setMenuPosition(null)
  }, [])

  const openMenu = useCallback((clientX: number, clientY: number) => {
    if (typeof getPos === 'function') {
      const pos = getPos()
      if (Number.isFinite(pos) && typeof editor.commands.setNodeSelection === 'function') {
        editor.commands.setNodeSelection(Number(pos))
      }
    }

    setMenuPosition(clampMenuPosition(clientX, clientY))
  }, [editor.commands, getPos])

  useEffect(() => {
    if (!menuPosition) return

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      closeMenu()
    }

    const handleWindowChange = () => closeMenu()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)
    window.addEventListener('contextmenu', handleWindowChange)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
      window.removeEventListener('contextmenu', handleWindowChange)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, menuPosition])

  const handleMouseDown = useCallback((event: React.MouseEvent, direction: 'right' | 'left') => {
    event.preventDefault()
    event.stopPropagation()
    setResizing(true)

    const startX = event.clientX
    const startWidth = imgRef.current?.offsetWidth || 300

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = direction === 'right'
        ? moveEvent.clientX - startX
        : startX - moveEvent.clientX
      const newWidth = Math.max(100, startWidth + diff)
      updateAttributes({ width: newWidth })
    }

    const handleMouseUp = () => {
      setResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateAttributes])

  const menu = menuPosition
    ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[80] min-w-[220px] overflow-hidden rounded-2xl border border-[var(--editor-line)] bg-white p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              downloadEditorImage(imageTarget.src, imageTarget.alt || 'image')
              closeMenu()
            }}
            className="editor-image-menu-item"
          >
            <Download className="h-4 w-4" />
            <span>下载图片</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await copyEditorImage(imageTarget.src)
                toast.success('已复制图片')
              } catch (error) {
                toast.error(error instanceof Error ? error.message : '复制图片失败')
              } finally {
                closeMenu()
              }
            }}
            className="editor-image-menu-item"
          >
            <Copy className="h-4 w-4" />
            <span>复制图片</span>
          </button>
          <button
            type="button"
            onClick={() => {
              imageActions?.onSetCover?.(imageTarget)
              closeMenu()
            }}
            className="editor-image-menu-item"
          >
            <ImagePlus className="h-4 w-4" />
            <span>设为封面</span>
          </button>
          <div className="my-1 h-px bg-[var(--editor-line)]" />
          <button
            type="button"
            onClick={() => {
              updateAttributes({ align: 'left' })
              closeMenu()
            }}
            className={`editor-image-menu-item ${align === 'left' ? 'editor-image-menu-item-active' : ''}`}
          >
            <AlignLeft className="h-4 w-4" />
            <span>左对齐</span>
          </button>
          <button
            type="button"
            onClick={() => {
              updateAttributes({ align: 'center' })
              closeMenu()
            }}
            className={`editor-image-menu-item ${align === 'center' ? 'editor-image-menu-item-active' : ''}`}
          >
            <AlignCenter className="h-4 w-4" />
            <span>居中对齐</span>
          </button>
          <div className="my-1 h-px bg-[var(--editor-line)]" />
          <button
            type="button"
            onClick={() => {
              imageActions?.onOpenReferenceImage?.(imageTarget)
              closeMenu()
            }}
            className="editor-image-menu-item"
          >
            <WandSparkles className="h-4 w-4" />
            <span>参考生图</span>
          </button>
          <button
            type="button"
            onClick={() => {
              imageActions?.onOpenCrop?.(imageTarget)
              closeMenu()
            }}
            className="editor-image-menu-item"
          >
            <Crop className="h-4 w-4" />
            <span>裁剪图片</span>
          </button>
        </div>,
        document.body,
      )
    : null

  return (
    <NodeViewWrapper
      className="resizable-image-wrapper"
      style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'center' }}
      onContextMenu={(event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        openMenu(event.clientX, event.clientY)
      }}
    >
      <div
        className={`resizable-image ${selected ? 'selected' : ''} ${resizing ? 'resizing' : ''}`}
        style={{ position: 'relative', display: 'inline-block', width: buildWidthStyle(node.attrs.width) || undefined, maxWidth: '100%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ''}
          title={node.attrs.title || ''}
          style={{ width: '100%', display: 'block' }}
          draggable={false}
        />

        {selected ? (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const rect = event.currentTarget.getBoundingClientRect()
              openMenu(rect.left, rect.bottom + 8)
            }}
            className="absolute -right-2 -top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--editor-line)] bg-white text-[var(--editor-muted)] shadow-sm transition hover:text-[var(--editor-ink)]"
            aria-label="打开图片菜单"
            title="打开图片菜单"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        ) : null}

        {selected && (
          <>
            <div
              className="resize-handle resize-handle-left"
              onMouseDown={(event) => handleMouseDown(event, 'left')}
            />
            <div
              className="resize-handle resize-handle-right"
              onMouseDown={(event) => handleMouseDown(event, 'right')}
            />
          </>
        )}
      </div>
      {menu}
    </NodeViewWrapper>
  )
}

export const ResizableImage = Image.extend({
  addOptions() {
    const parentOptions = this.parent?.() as ImageOptions | undefined

    return {
      inline: parentOptions?.inline ?? false,
      allowBase64: parentOptions?.allowBase64 ?? false,
      HTMLAttributes: parentOptions?.HTMLAttributes ?? {},
      resize: parentOptions?.resize ?? false,
      imageActions: {} as ResizableImageActionHandlers,
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width') || element.style.width || null,
      },
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) => {
          const attr = element.getAttribute('data-align')
          if (attr === 'left') return 'left'

          const style = element.getAttribute('style') || ''
          return /margin-right:\s*auto/i.test(style) && /margin-left:\s*0/i.test(style)
            ? 'left'
            : 'center'
        },
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    const {
      align,
      width,
      ...rest
    } = HTMLAttributes as Record<string, unknown> & {
      align?: EditorImageAlignment
      width?: number | string | null
    }

    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, rest, {
        width: width ? String(width) : undefined,
        'data-align': normalizeAlignment(align),
        style: buildImageStyle(width, normalizeAlignment(align)),
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },

  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: 'opacity-40 rounded-lg border border-[var(--editor-line)]',
      }),
    ]
  },
})
