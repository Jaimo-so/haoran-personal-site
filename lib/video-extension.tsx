import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useRef, useState } from 'react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; title?: string }) => ReturnType
    }
  }
}

interface VideoNodeAttrs {
  src: string
  title?: string
}

function VideoComponent({ node }: NodeViewProps) {
  const { src, title } = node.attrs
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  return (
    <NodeViewWrapper className="video-wrapper">
      <div className="my-4 relative">
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--editor-panel)] rounded-lg">
            <span className="text-sm text-[var(--editor-muted)]">加载视频中...</span>
          </div>
        )}
        {hasError ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-sm text-red-600">视频加载失败</p>
            <p className="text-xs text-red-500 mt-1">{src}</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5"
            x-webkit-airplay="true"
            className="w-full max-w-full rounded-lg shadow-sm"
            style={{ maxHeight: '600px' }}
            preload="metadata"
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false)
              setHasError(true)
            }}
          >
            您的浏览器不支持视频播放
          </video>
        )}
        {title && !hasError && (
          <p className="mt-2 text-sm text-[var(--editor-muted)] text-center">
            {title}
          </p>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: (attributes) => ({ src: attributes.src }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('title'),
        renderHTML: (attributes) =>
          attributes.title ? { title: attributes.title } : {},
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'video[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: '',
        playsinline: '',
        'webkit-playsinline': 'true',
        'x5-playsinline': 'true',
        'x5-video-player-type': 'h5',
        'x-webkit-airplay': 'true',
        preload: 'metadata',
        style: 'max-width:100%;max-height:600px',
      }),
      '您的浏览器不支持视频播放',
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoComponent)
  },

  addCommands() {
    return {
      setVideo:
        (options: VideoNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})
