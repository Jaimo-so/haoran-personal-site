'use client'

import dynamic from 'next/dynamic'

const InlineArticleEditor = dynamic(
  () => import('@/components/InlineArticleEditor').then(m => ({ default: m.InlineArticleEditor })),
  {
    ssr: false,
    loading: () => <div className="prose prose-lg max-w-none" />,
  }
)

export function InlineArticleEditorClient(props: {
  slug: string
  title: string
  html: string
  category?: string | null
  coverImage?: string | null
  password?: string | null
  publishedAt?: number
  viewCount?: number
  content?: string
  onExitReading?: () => void
}) {
  return <InlineArticleEditor {...props} />
}
