'use client'

import { useCallback, useState, type MouseEvent, type ReactNode } from 'react'
import { InlineArticleEditorClient } from '@/components/InlineArticleEditorClient'
import { useAdminSession } from '@/lib/admin-session-client'

interface FrontPostAdminBoundaryProps {
  slug: string
  title: string
  html: string
  category?: string | null
  coverImage?: string | null
  password?: string | null
  publishedAt?: number
  viewCount?: number
  content?: string
  children: ReactNode
}

export function FrontPostAdminBoundary({
  slug,
  title,
  html,
  category,
  coverImage,
  password,
  publishedAt,
  viewCount,
  content,
  children,
}: FrontPostAdminBoundaryProps) {
  const { authenticated } = useAdminSession()
  const [editing, setEditing] = useState(false)

  const handleReadModeClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!authenticated || editing) return
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest('a, button, input, textarea, select, summary, label, video, audio')) return

    const trigger = target.closest<HTMLElement>('[data-admin-edit-trigger]')
    if (!trigger) return

    event.preventDefault()
    setEditing(true)
  }, [authenticated, editing])

  if (authenticated && editing) {
    return (
      <section>
        <InlineArticleEditorClient
          slug={slug}
          title={title}
          html={html}
          category={category}
          coverImage={coverImage}
          password={password}
          publishedAt={publishedAt}
          viewCount={viewCount}
          content={content}
          onExitReading={() => setEditing(false)}
        />
      </section>
    )
  }

  return (
    <div
      onClickCapture={handleReadModeClick}
      data-admin-inline-entry={authenticated ? 'true' : undefined}
    >
      {children}
    </div>
  )
}
