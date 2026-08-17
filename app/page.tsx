import { getPosts, getPostsCount } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { type Theme } from '@/lib/appearance'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { HomeClient } from '@/components/HomeClient'
import { getSiteUrl } from '@/lib/site-config'
import { PERSONAL_SITE } from '@/lib/personal-site'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

// Cloudflare Workers 缓存策略
export const revalidate = 3600 // 1小时缓存
export const dynamicParams = true

export const metadata = {
  alternates: {
    canonical: BASE_URL,
  },
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)

  let posts: Awaited<ReturnType<typeof getPosts>> = []
  let totalCount = 0
  let navLinks: SiteNavLink[] = []
  let categories: SiteCategoryLink[] = []
  let defaultTheme: Theme = 'refined'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const headerData = await getSiteHeaderData(env.DB)
      ;[posts, totalCount] = await Promise.all([
        getPosts(env.DB, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE),
        getPostsCount(env.DB),
      ])
      navLinks = headerData.navLinks
      categories = headerData.categories
      defaultTheme = headerData.defaultTheme
    }
  } catch (e) {
    console.error('Homepage: failed to fetch posts', e)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const categorySlugMap: Record<string, string> = Object.fromEntries(
    categories.map((cat) => [cat.name, cat.slug])
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: PERSONAL_SITE.siteName,
            url: BASE_URL,
            description: PERSONAL_SITE.description,
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/search?q={search_term_string}` },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: PERSONAL_SITE.ownerName,
            url: BASE_URL,
            logo: { '@type': 'ImageObject', url: `${BASE_URL}/icon-512.png` },
          }),
        }}
      />
      <HomeClient
        initialTheme={defaultTheme}
        posts={posts}
        categories={categories}
        navLinks={navLinks}
        currentPage={currentPage}
        totalPages={totalPages}
        categorySlugMap={categorySlugMap}
      />
    </>
  )
}
