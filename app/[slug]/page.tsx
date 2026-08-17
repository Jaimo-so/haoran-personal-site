import { getPostBySlug, incrementViewCount, isPubliclyAccessiblePost, isSearchIndexablePost } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { verifyPassword } from '@/lib/password'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { PasswordPrompt } from '@/components/PasswordPrompt'
import { DownloadMarkdown } from '@/components/DownloadMarkdown'
import { TwitterEmbedsEnhancer } from '@/components/TwitterEmbedsEnhancer'
import { getSiteHeaderData } from '@/lib/site'
import { getRelatedPosts } from '@/lib/related-content'
import { getPublicContentCacheNamespace } from '@/lib/cache'
import { getSiteUrl } from '@/lib/site-config'
import { resolvePostCoverImage } from '@/lib/default-cover-images'
import { PERSONAL_SITE } from '@/lib/personal-site'

// Cloudflare Workers 缓存策略
export const revalidate = 86400 // 24小时缓存
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const baseUrl = getSiteUrl()
  try {
    const env = await getAppCloudflareEnv()
    const { slug } = await params

    if (!env?.DB) return {}

    const post = await getPostBySlug(env.DB, slug, getPublicContentCacheNamespace(env)).catch(() => null)
    if (!post || !isPubliclyAccessiblePost(post)) return {}
    const searchIndexable = isSearchIndexablePost(post)

    const ogImage = resolvePostCoverImage(post, { baseUrl })

    // Password-protected articles should not expose metadata to crawlers.
    if (post.password) {
      return {
        title: post.title,
        robots: { index: false, follow: false },
      }
    }

    return {
      title: post.title,
      description: post.description,
      robots: searchIndexable ? undefined : { index: false, follow: false },
      authors: [{ name: PERSONAL_SITE.ownerName }],
      alternates: {
        canonical: `${baseUrl}/${post.slug}`,
      },
      openGraph: {
        title: post.title,
        description: post.description,
        type: 'article',
        publishedTime: new Date(post.published_at * 1000).toISOString(),
        modifiedTime: new Date(post.updated_at * 1000).toISOString(),
        authors: [PERSONAL_SITE.ownerName],
        images: [{ url: ogImage }],
      },
      twitter: {
        card: 'summary_large_image' as const,
        title: post.title,
        description: post.description || undefined,
        images: [ogImage],
      },
    }
  } catch {
    return {}
  }
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ pwd?: string }>
}) {
  const { slug } = await params
  const { pwd } = await searchParams

  let env: Awaited<ReturnType<typeof getAppCloudflareEnv>> | undefined
  try {
    env = await getAppCloudflareEnv()
  } catch {
    notFound()
  }
  if (!env?.DB) notFound()
  const db = env!.DB

  const post = await getPostBySlug(db, slug, getPublicContentCacheNamespace(env)).catch(() => null)
  if (!post) notFound()
  if (!isPubliclyAccessiblePost(post)) notFound()

  const headerData = await getSiteHeaderData(db)
  const categorySlugMap = new Map(headerData.categories.map((category) => [category.name, category.slug]))
  const activeCategorySlug = headerData.categories.find((category) => category.name === post.category)?.slug ?? null

  // 密码保护逻辑保持公开路径纯粹，由前台管理员增强层在客户端接管编辑能力
  let passwordError: string | undefined
  const needsPassword = Boolean(post.password)

  if (needsPassword) {
    if (!pwd) {
      return (
        <div className="theme-home-refined public-grid-background min-h-screen bg-[var(--background)] flex flex-col">
          <SiteHeader
            initialTheme={headerData.defaultTheme}
            navLinks={headerData.navLinks}
            categories={headerData.categories}
            activeCategorySlug={activeCategorySlug}
            stickyOnMobile={false}
          />
          <main className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12">
            <PasswordPrompt />
          </main>
          <SiteFooter />
        </div>
      )
    }

    const isValid = await verifyPassword(pwd, post.password!)
    if (!isValid) {
      passwordError = '密码错误，请重试'
      return (
        <div className="theme-home-refined public-grid-background min-h-screen bg-[var(--background)] flex flex-col">
          <SiteHeader
            initialTheme={headerData.defaultTheme}
            navLinks={headerData.navLinks}
            categories={headerData.categories}
            activeCategorySlug={activeCategorySlug}
            stickyOnMobile={false}
          />
          <main className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12">
            <PasswordPrompt error={passwordError} />
          </main>
          <SiteFooter />
        </div>
      )
    }
  }

  // 异步增加阅读计数，不阻塞渲染
  void incrementViewCount(db, slug).catch(console.error)

  // 阅读时间估算（中文按 400 字/分钟）
  const textLength = post.content?.length || 0
  const readingMinutes = Math.max(1, Math.ceil(textLength / 400))
  const searchIndexable = isSearchIndexablePost(post)
  const related = !post.password
    ? await getRelatedPosts(db, env, post, 3).catch(() => ({ strategy: 'fts' as const, source: 'rules' as const, results: [] }))
    : { strategy: 'fts' as const, source: 'rules' as const, results: [] }
  const contentContainerId = `post-content-${post.slug}`

  return (
    <div className="theme-home-refined public-grid-background min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader
        initialTheme={headerData.defaultTheme}
        navLinks={headerData.navLinks}
        categories={headerData.categories}
        activeCategorySlug={activeCategorySlug}
        stickyOnMobile={false}
      />

      <main className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12">
        {searchIndexable && (() => {
          const baseUrl = getSiteUrl()
          const ogImage = resolvePostCoverImage(post, { baseUrl })
          const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description || '',
            image: ogImage,
            author: { '@type': 'Person', name: PERSONAL_SITE.ownerName, url: baseUrl },
            publisher: { '@type': 'Person', name: PERSONAL_SITE.ownerName, url: baseUrl },
            datePublished: new Date(post.published_at * 1000).toISOString(),
            dateModified: new Date(post.updated_at * 1000).toISOString(),
            mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/${post.slug}` },
            url: `${baseUrl}/${post.slug}`,
          }
          const breadcrumbLd = {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '首页', item: baseUrl },
              ...(post.category && activeCategorySlug
                ? [{ '@type': 'ListItem', position: 2, name: post.category, item: `${baseUrl}/category/${activeCategorySlug}` }]
                : []),
              { '@type': 'ListItem', position: post.category ? 3 : 2, name: post.title, item: `${baseUrl}/${post.slug}` },
            ],
          }
          return (
            <>
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            </>
          )
        })()}
          <article className="rounded-2xl border border-[var(--border-warm)] bg-[var(--background)] px-6 py-8 sm:px-10 sm:py-10">
            <header className="mb-10 sm:mb-12">
              <h1
                className="article-display-title text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--editor-ink)] leading-snug mb-4 sm:mb-5"
              >
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--stone-gray)]">
                {post.category && (
                  <>
                    {activeCategorySlug ? (
                      <Link
                        href={`/category/${activeCategorySlug}`}
                        className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/12 transition-colors"
                      >
                        {post.category}
                      </Link>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15">
                        {post.category}
                      </span>
                    )}
                    <span aria-hidden>·</span>
                  </>
                )}
                <time>
                  {new Date(post.published_at * 1000).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
                <span aria-hidden>·</span>
                <span>{post.view_count} 次阅读</span>
                <span aria-hidden>·</span>
                <span>约 {readingMinutes} 分钟</span>
                <DownloadMarkdown title={post.title} html={post.html} />
              </div>
            </header>

            <div
              id={contentContainerId}
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: post.html }}
            />
            <TwitterEmbedsEnhancer containerId={contentContainerId} html={post.html} />

            {related.results.length > 0 && (
              <section className="mt-14 sm:mt-16 border-t border-[var(--editor-line)] pt-8 sm:pt-10">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-[var(--editor-ink)]">继续阅读</h2>
                    <p className="text-xs text-[var(--stone-gray)] mt-1">
                      {related.source === 'vectorize' ? '基于向量召回' : '基于全文检索与主题相似度'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {related.results.map((item) => {
                    const itemCategorySlug = item.category ? categorySlugMap.get(item.category) : null
                    return (
                      <Link
                        key={item.slug}
                        href={`/${item.slug}`}
                        className="group rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]/55 p-4 transition-colors hover:border-[var(--editor-accent)]/35 hover:bg-[var(--editor-panel)]"
                      >
                        <div className="text-xs text-[var(--stone-gray)] mb-3 flex items-center gap-2 flex-wrap">
                          {item.category && (
                            itemCategorySlug ? (
                              <span className="rounded-full border border-[var(--editor-accent)]/15 bg-[var(--editor-accent)]/8 px-2 py-0.5 text-[var(--editor-accent)]">
                                {item.category}
                              </span>
                            ) : (
                              <span>{item.category}</span>
                            )
                          )}
                          <time>
                            {new Date(item.published_at * 1000).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </time>
                        </div>
                        <h3 className="text-base font-semibold leading-snug text-[var(--editor-ink)] group-hover:text-[var(--editor-accent)] transition-colors">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--editor-muted)]">
                            {item.description}
                          </p>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </article>
      </main>

      <SiteFooter />
    </div>
  )
}
