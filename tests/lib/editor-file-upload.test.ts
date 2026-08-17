import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildEditorImageFilename,
  buildUploadPlaceholderText,
  copyEditorImage,
  createUploadPlaceholderMarker,
  insertGeneratedImageAfterNode,
  insertGeneratedImageAtPosition,
  insertUploadedFileIntoEditor,
  removeUploadPlaceholder,
  replaceImageNodeAtPosition,
  uploadEditorFile,
} from '@/lib/editor-file-upload'

function createFile(name: string, type: string, content = 'test') {
  return new File([content], name, {
    type,
    lastModified: 1710000000000,
  })
}

type FakeEvent = {
  lengthComputable?: boolean
  loaded?: number
  total?: number
}
type FakeEventHandler = (event?: FakeEvent) => void
type ListenerMap = Record<string, FakeEventHandler[]>

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = []

  withCredentials = false
  timeout = 0
  status = 0
  responseText = ''
  uploadListeners: ListenerMap = {}
  listeners: ListenerMap = {}
  upload = {
    addEventListener: (type: string, handler: FakeEventHandler) => {
      this.uploadListeners[type] ||= []
      this.uploadListeners[type]!.push(handler)
    },
  }

  constructor() {
    FakeXMLHttpRequest.instances.push(this)
  }

  addEventListener(type: string, handler: FakeEventHandler) {
    this.listeners[type] ||= []
    this.listeners[type]!.push(handler)
  }

  open = vi.fn()
  send = vi.fn()

  emit(type: string, event?: FakeEvent) {
    for (const handler of this.listeners[type] || []) {
      handler(event)
    }
  }

  emitUpload(type: string, event?: FakeEvent) {
    for (const handler of this.uploadListeners[type] || []) {
      handler(event)
    }
  }
}

describe('editor-file-upload helpers', () => {
  beforeEach(() => {
    FakeXMLHttpRequest.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('builds readable upload placeholders for media and generic files', () => {
    expect(buildUploadPlaceholderText(createFile('clip.mp4', 'video/mp4'), 'marker')).toBe('📤 视频上传中... [marker]')
    expect(buildUploadPlaceholderText(createFile('voice.mp3', 'audio/mpeg'), 'marker')).toBe('📤 音频上传中... [marker]')
    expect(buildUploadPlaceholderText(createFile('book.epub', 'application/epub+zip'), 'marker')).toBe('📤 book.epub 上传中... [marker]')
  })

  it('creates timestamped placeholder markers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-21T12:34:56Z'))

    expect(createUploadPlaceholderMarker()).toBe(`⏳upload-${Date.now()}`)

    vi.useRealTimers()
  })

  it('builds stable filenames for editor image downloads', () => {
    expect(buildEditorImageFilename('/api/images/abc123?format=webp', '封面 主视觉')).toBe('封面-主视觉.webp')
    expect(buildEditorImageFilename('https://example.com/files/photo.jpeg', '')).toBe('photo.jpeg')
  })

  it('copies image blobs to clipboard when the browser supports image clipboard writes', async () => {
    const write = vi.fn().mockResolvedValue(undefined)
    const imageBlob = new Blob(['image-bytes'], { type: 'image/webp' })

    vi.stubGlobal('navigator', {
      clipboard: { write },
    })
    vi.stubGlobal('window', {
      ClipboardItem: class ClipboardItem {
        items: Record<string, Blob>

        constructor(items: Record<string, Blob>) {
          this.items = items
        }
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => imageBlob,
    }))

    await copyEditorImage('/api/images/copied.webp')

    expect(write).toHaveBeenCalledTimes(1)
  })

  it('throws a readable error when image clipboard is unsupported', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', {})

    await expect(copyEditorImage('/api/images/copied.webp')).rejects.toThrow('当前浏览器不支持复制图片')
  })

  it('uploads files, reports progress, and returns the uploaded metadata on success', async () => {
    const progress = vi.fn()
    const promise = uploadEditorFile(createFile('cover.png', 'image/png'), progress)

    const xhr = FakeXMLHttpRequest.instances[0]
    expect(xhr).toBeDefined()

    xhr.emitUpload('progress', { lengthComputable: true, loaded: 50, total: 100 })
    xhr.status = 200
    xhr.responseText = JSON.stringify({
      success: true,
      url: '/uploads/cover.png',
      type: 'image/png',
      name: 'cover.png',
    })
    xhr.emit('load')

    await expect(promise).resolves.toEqual({
      url: '/uploads/cover.png',
      type: 'image/png',
      name: 'cover.png',
    })
    expect(progress).toHaveBeenCalledWith(50)
  })

  it('maps common upload failures to user-facing messages', async () => {
    const tooLarge = uploadEditorFile(createFile('movie.mp4', 'video/mp4'))
    const tooLargeXhr = FakeXMLHttpRequest.instances[0]
    tooLargeXhr.status = 413
    tooLargeXhr.emit('load')
    await expect(tooLarge).rejects.toThrow('文件太大，最大支持 100MB')

    const timedOut = uploadEditorFile(createFile('audio.mp3', 'audio/mpeg'))
    const timeoutXhr = FakeXMLHttpRequest.instances[1]
    timeoutXhr.emit('timeout')
    await expect(timedOut).rejects.toThrow('上传超时')
  })

  it('removes upload placeholders when the marker is found', () => {
    const dispatch = vi.fn()
    const deleteMock = vi.fn(() => 'deleted-transaction')
    const editor = {
      state: {
        doc: {
          descendants: (callback: (node: { isBlock: boolean; textContent: string; nodeSize: number }, pos: number) => boolean | void) => {
            callback({ isBlock: true, textContent: '📤 上传中 [marker-1]', nodeSize: 6 }, 12)
          },
        },
        tr: {
          delete: deleteMock,
        },
      },
      view: {
        dispatch,
      },
    } as never

    expect(removeUploadPlaceholder(editor, 'marker-1')).toBe(true)
    expect(deleteMock).toHaveBeenCalledWith(12, 18)
    expect(dispatch).toHaveBeenCalledWith('deleted-transaction')
  })

  it('inserts uploaded files using the right editor command path', () => {
    const run = vi.fn()
    const setVideo = vi.fn(() => ({ run }))
    const setAudio = vi.fn(() => ({ run }))
    const insertContent = vi.fn(() => ({ run }))
    const focus = vi.fn(() => ({
      setVideo,
      setAudio,
      insertContent,
    }))
    const chain = vi.fn(() => ({ focus }))
    const editor = { chain } as never

    insertUploadedFileIntoEditor(editor, createFile('clip.mp4', 'video/mp4'), {
      url: '/uploads/clip.mp4',
      type: 'video/mp4',
      name: 'clip.mp4',
    })
    expect(setVideo).toHaveBeenCalledWith({ src: '/uploads/clip.mp4' })

    insertUploadedFileIntoEditor(editor, createFile('voice.mp3', 'audio/mpeg'), {
      url: '/uploads/voice.mp3',
      type: 'audio/mpeg',
      name: 'voice.mp3',
    })
    expect(setAudio).toHaveBeenCalledWith({ src: '/uploads/voice.mp3' })

    insertUploadedFileIntoEditor(editor, createFile('book.epub', 'application/epub+zip'), {
      url: '/uploads/book.epub',
      type: 'application/epub+zip',
      name: 'book.epub',
    })
    expect(insertContent).toHaveBeenCalledWith('<p><a href="/uploads/book.epub" target="_blank" rel="noopener">📎 book.epub</a></p>')
  })

  it('inserts generated images at a given position and appends a trailing paragraph', () => {
    const run = vi.fn()
    const insertContent = vi.fn(() => ({ run }))
    const setTextSelection = vi.fn(() => ({ insertContent, run }))
    const focus = vi.fn(() => ({ setTextSelection, insertContent, run }))
    const chain = vi.fn(() => ({ focus }))
    const editor = { chain } as never

    insertGeneratedImageAtPosition(editor, '/images/generated.webp', '封面图', 24)

    expect(setTextSelection).toHaveBeenCalledWith(24)
    expect(insertContent).toHaveBeenCalledWith([
      { type: 'image', attrs: { src: '/images/generated.webp', alt: '封面图' } },
      { type: 'paragraph' },
    ])
  })

  it('inserts generated images after the current image node', () => {
    const run = vi.fn()
    const insertContent = vi.fn(() => ({ run }))
    const setTextSelection = vi.fn(() => ({ insertContent, run }))
    const focus = vi.fn(() => ({ setTextSelection, insertContent, run }))
    const chain = vi.fn(() => ({ focus }))
    const editor = {
      chain,
      state: {
        doc: {
          nodeAt: vi.fn(() => ({ nodeSize: 5 })),
        },
      },
    } as never

    insertGeneratedImageAfterNode(editor, '/images/next.webp', '新图', 24)

    expect(setTextSelection).toHaveBeenCalledWith(29)
  })

  it('replaces an image node while preserving existing layout attrs', () => {
    const replaceWith = vi.fn(() => ({
      scrollIntoView: vi.fn(() => 'next-transaction'),
    }))
    const dispatch = vi.fn()
    const create = vi.fn((attrs) => ({ type: 'image', attrs }))
    const editor = {
      state: {
        doc: {
          nodeAt: vi.fn(() => ({
            nodeSize: 3,
            type: { name: 'image' },
            attrs: { width: 420, align: 'left', src: '/images/original.webp', alt: '旧图' },
          })),
        },
        schema: {
          nodes: {
            image: { create },
          },
        },
        tr: {
          replaceWith,
        },
      },
      view: {
        dispatch,
      },
    } as never

    expect(replaceImageNodeAtPosition(editor, '/images/replaced.webp', '新图', 12)).toBe(true)
    expect(create).toHaveBeenCalledWith({
      width: 420,
      align: 'left',
      src: '/images/replaced.webp',
      alt: '新图',
    })
    expect(replaceWith).toHaveBeenCalledWith(12, 15, {
      type: 'image',
      attrs: {
        width: 420,
        align: 'left',
        src: '/images/replaced.webp',
        alt: '新图',
      },
    })
    expect(dispatch).toHaveBeenCalledWith('next-transaction')
  })
})
