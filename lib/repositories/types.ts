export interface Post {
  id: number
  slug: string
  title: string
  content: string
  html: string
  description: string | null
  category: string | null
  tags: string | null
  status: 'draft' | 'published' | 'deleted'
  password: string | null
  is_pinned: number
  is_hidden: number
  cover_image: string | null
  deleted_at: number | null
  published_at: number
  updated_at: number
  view_count: number
}

export interface PostWithTags extends Omit<Post, 'tags'> {
  tags: string[]
}

export interface CountRow {
  count: number
}

export interface StatsRow {
  total_posts: number
  total_views: number
}

export interface CategoryRow {
  name: string
  slug: string
  post_count: number
}

export interface SettingRow {
  value: string
}

export interface PostCategoryRow {
  category: string | null
  deleted_at?: number | null
}

export interface PostAiSnapshotRow {
  id: number
  title: string
  content: string
  category: string | null
  description: string | null
  tags: string | null
  deleted_at: number | null
}

export function isPubliclyAccessiblePost(
  post: Pick<Post, 'status' | 'deleted_at'> | null | undefined,
): boolean {
  return Boolean(
    post &&
    post.status === 'published' &&
    post.deleted_at == null,
  )
}

export function isSearchIndexablePost(
  post: Pick<Post, 'status' | 'password' | 'is_hidden' | 'deleted_at'> | null | undefined,
): boolean {
  return Boolean(
    post &&
    post.status === 'published' &&
    post.password == null &&
    post.is_hidden === 0 &&
    post.deleted_at == null,
  )
}
