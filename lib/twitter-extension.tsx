'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useCallback } from 'react'
import { extractTweetId, renderTweetEmbed } from '@/lib/twitter-widgets'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    twitter: {
      setTweet: (options: { src: string }) => ReturnType
    }
  }
}

// ── React 组件：渲染推文 ──
function TweetComponent(props: ReactNodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const src = props.node.attrs.src as string
  const tweetId = extractTweetId(src)

  const renderTweet = useCallback(async () => {
    if (!tweetId || !containerRef.current) return
    await renderTweetEmbed(containerRef.current, src)
  }, [tweetId, src])

  useEffect(() => { renderTweet() }, [renderTweet])

  return (
    <NodeViewWrapper data-type="twitter" className="twitter-node-view">
      <div ref={containerRef} style={{ minHeight: 100 }}>
        {!tweetId && (
          <p style={{ color: '#999', fontSize: 14 }}>
            无效的推文链接：<a href={src} target="_blank" rel="noopener noreferrer">{src}</a>
          </p>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ── Tiptap Node 扩展 ──
export const TwitterNode = Node.create({
  name: 'twitter',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-twitter-src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-twitter-src': HTMLAttributes.src }, HTMLAttributes),
      ['a', { href: HTMLAttributes.src, target: '_blank', rel: 'noopener noreferrer' }, HTMLAttributes.src],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TweetComponent)
  },

  addCommands() {
    return {
      setTweet:
        (options: { src: string }) =>
        ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { src: options.src },
        })
      },
    }
  },
})
