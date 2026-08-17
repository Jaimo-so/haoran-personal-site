import { getPostBySlug } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { isAdminAuthenticated, COOKIE_NAME } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NovelEditorClient } from '@/components/NovelEditorClient'

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; slug?: string; new?: string }>
}) {
  // 鉴权：只有登录的管理员才能访问编辑器
  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value
  const isAuthenticated = await isAdminAuthenticated(cookieValue)

  if (!isAuthenticated) {
    const params = await searchParams
    const editSlug = params.edit ?? params.slug
    const editParam = editSlug ? `?edit=${editSlug}` : params.new === '1' ? '?new=1' : ''
    redirect(`/admin/login?redirect_to=${encodeURIComponent(`/editor${editParam}`)}`)
  }

  const params = await searchParams
  const edit = params.edit ?? params.slug
  const isNew = params.new === '1'

  let initialData: {
    slug: string
    title: string
    html: string
    category?: string
    status?: 'draft' | 'published' | 'deleted'
    password?: string | null
    is_hidden?: number
    tags?: string[]
    description?: string | null
    cover_image?: string | null
    published_at?: number
  } | undefined

  if (edit) {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const post = await getPostBySlug(env.DB, edit)
      if (post) {
        initialData = {
          slug: post.slug,
          title: post.title,
          html: post.html,
          category: post.category || undefined,
          status: post.status,
          password: post.password,
          is_hidden: post.is_hidden,
          tags: post.tags,
          description: post.description,
          cover_image: post.cover_image,
          published_at: post.published_at,
        }
      }
    }
  }

  return <NovelEditorClient initialData={initialData} skipDraftRestore={isNew} />
}
