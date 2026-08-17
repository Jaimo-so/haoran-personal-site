import { searchPosts } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import type { Theme } from '@/lib/appearance'

export const metadata = {
  title: '搜索结果',
  robots: { index: false, follow: true },
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() || ''

  let posts: Awaited<ReturnType<typeof searchPosts>> = []
  let navLinks: SiteNavLink[] = []
  let categories: SiteCategoryLink[] = []
  let defaultTheme: Theme = 'default'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const headerData = await getSiteHeaderData(env.DB)
      navLinks = headerData.navLinks
      categories = headerData.categories
      defaultTheme = headerData.defaultTheme

      if (query) {
        posts = await searchPosts(env.DB, query, 100)
      }
    }
  } catch (e) {
    console.error('Search page error:', e)
  }

  const categorySlugMap = new Map(categories.map((category) => [category.name, category.slug]))

  return (
    <div className="min-h-full flex flex-col bg-[var(--background)]">
      <SiteHeader
        initialTheme={defaultTheme}
        navLinks={navLinks}
        categories={categories}
      />

      <main className="page-main flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--editor-ink)] mb-2">
            搜索结果
          </h1>
          {query ? (
            <p className="text-sm text-[var(--editor-muted)]">
              关键词 &quot;{query}&quot; 找到 {posts.length} 篇文章
            </p>
          ) : (
            <p className="text-sm text-[var(--editor-muted)]">
              请输入搜索关键词
            </p>
          )}
        </div>

        {query && posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--editor-soft)] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--stone-gray)]">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <p className="text-[var(--editor-muted)] mb-2">未找到相关文章</p>
            <p className="text-sm text-[var(--stone-gray)]">试试其他关键词</p>
          </div>
        ) : query ? (
          <div className="space-y-0">
            {posts.map((post, index) => (
              <article
                key={post.slug}
                className="group border-t border-[var(--editor-line)] first:border-t-0"
                style={{
                  animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both`
                }}
              >
                <Link
                  href={`/${post.slug}`}
                  className="block py-6 sm:py-7 relative transition-colors duration-200 hover:bg-[var(--editor-panel)]"
                >
                  <div className="absolute left-0 top-6 bottom-6 w-1 bg-[var(--editor-accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                  <div className="pl-0 group-hover:pl-5 transition-[padding] duration-200">
                    <h2
                      className="text-lg sm:text-xl font-medium text-[var(--editor-ink)] leading-snug mb-2 group-hover:text-[var(--editor-accent)] transition-colors duration-200 flex items-center gap-2"
                      style={{ fontFamily: 'Georgia, "Noto Serif SC", serif' }}
                    >
                      {post.title}
                      {post.password && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--editor-muted)] flex-shrink-0">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                      )}
                      {post.is_pinned === 1 && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--editor-accent)] flex-shrink-0">
                          <line x1="12" y1="17" x2="12" y2="22"></line>
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                        </svg>
                      )}
                    </h2>
                    {post.description && (
                      <p className="text-sm text-[var(--editor-muted)] leading-relaxed line-clamp-2 mb-2.5">
                        {post.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[var(--stone-gray)]">
                      <time>{formatDate(post.published_at)}</time>
                      {post.category && (
                        <>
                          <span aria-hidden>·</span>
                          {(() => {
                            const categorySlug = post.category ? categorySlugMap.get(post.category) : null
                            return categorySlug ? (
                              <Link
                                href={`/category/${categorySlug}`}
                                className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/12 transition-colors"
                              >
                                {post.category}
                              </Link>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15">
                                {post.category}
                              </span>
                            )
                          })()}
                          </>
                        )}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}
