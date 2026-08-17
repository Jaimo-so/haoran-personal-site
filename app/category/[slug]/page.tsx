import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostsByCategory, getPostsCountByCategory, getPublicCategories } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Pagination } from '@/components/Pagination'
import { getSiteHeaderData } from '@/lib/site'
import { getSiteUrl } from '@/lib/site-config'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

export const dynamicParams = true
export const revalidate = 3600

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  try {
    const env = await getAppCloudflareEnv()
    if (!env?.DB) return {}

    const categories = await getPublicCategories(env.DB)
    const category = categories.find((item) => item.slug === slug)
    if (!category) return {}

    return {
      title: `${category.name}`,
      alternates: {
        canonical: `${BASE_URL}/category/${slug}`,
      },
    }
  } catch {
    return {}
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)

  const env = await getAppCloudflareEnv()
  if (!env?.DB) notFound()

  const categories = await getPublicCategories(env.DB)
  const category = categories.find((item) => item.slug === slug)
  if (!category) notFound()

  const [posts, totalCount, headerData] = await Promise.all([
    getPostsByCategory(env.DB, category.name, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE),
    getPostsCountByCategory(env.DB, category.name),
    getSiteHeaderData(env.DB),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="min-h-full flex flex-col bg-[var(--background)]">
      <SiteHeader
        initialTheme={headerData.defaultTheme}
        navLinks={headerData.navLinks}
        categories={headerData.categories}
        activeCategorySlug={slug}
      />

      <main className="page-main flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 border-b border-[var(--editor-line)] pb-6">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--stone-gray)] mb-3">
            分类
          </div>
          <h1 className="article-display-title text-3xl sm:text-4xl font-bold text-[var(--editor-ink)] leading-tight">
            {category.name}
          </h1>
          <p className="mt-3 text-sm text-[var(--editor-muted)]">
            共 {totalCount} 篇文章
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[var(--editor-muted)] mb-2">这个分类下还没有公开文章</p>
            <Link
              href="/"
              className="text-sm text-[var(--editor-accent)] hover:underline underline-offset-2"
            >
              返回首页
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {posts.map((post, index) => (
                <article
                  key={post.slug}
                  className="group border-t border-[var(--editor-line)] first:border-t-0"
                  style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both` }}
                >
                  <Link
                    href={`/${post.slug}`}
                    className="block py-6 sm:py-7 transition-all duration-200 hover:bg-[var(--editor-panel)] border-l-2 border-l-transparent hover:border-l-[var(--editor-accent)] pl-4"
                  >
                    <h2 className="text-xl sm:text-2xl font-bold text-[var(--editor-ink)] leading-snug mb-2 group-hover:text-[var(--editor-accent)] transition-colors duration-200">
                      {post.title}
                    </h2>
                    {post.description ? (
                      <p className="text-sm text-[var(--editor-muted)] leading-relaxed line-clamp-2 mb-2.5">
                        {post.description}
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 text-xs text-[var(--stone-gray)]">
                      <time>{formatDate(post.published_at)}</time>
                      <span aria-hidden>·</span>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15">
                        {category.name}
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={`/category/${slug}`}
            />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
