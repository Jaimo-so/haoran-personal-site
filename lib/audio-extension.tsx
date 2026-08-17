import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audio: {
      setAudio: (options: { src: string; title?: string }) => ReturnType
    }
  }
}

interface AudioNodeAttrs {
  src: string
  title?: string
}

function AudioComponent({ node }: NodeViewProps) {
  const { src } = node.attrs
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    // 预加载元数据
    if (audioRef.current) {
      audioRef.current.load()
    }
  }, [src])

  return (
    <NodeViewWrapper className="audio-wrapper">
      <div className="my-4">
        <audio
          ref={audioRef}
          controls
          src={src}
          className="w-full max-w-full"
          preload="metadata"
        >
          您的浏览器不支持音频播放
        </audio>
      </div>
    </NodeViewWrapper>
  )
}

export const AudioNode = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,

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
        tag: 'audio[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'audio',
      mergeAttributes(HTMLAttributes, { controls: '' }),
      '您的浏览器不支持音频播放',
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioComponent)
  },

  addCommands() {
    return {
      setAudio:
        (options: AudioNodeAttrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})
