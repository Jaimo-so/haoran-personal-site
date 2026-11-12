import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import type { Theme } from '@/lib/appearance'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData, type SiteNavLink } from '@/lib/site'
import { DEFAULT_PERSONAL_CONTENT, getPersonalContent } from '@/lib/personal-content'

export const metadata = {
  title: '关于',
  description: '关于 HaoRan：一名 2027 届本科生、AI Builder 与 AI 产品经理求职者。',
}

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'default'
  let personalContent = structuredClone(DEFAULT_PERSONAL_CONTENT)

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, content] = await Promise.all([
        getSiteHeaderData(env.DB),
        getPersonalContent(env.DB),
      ])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      personalContent = content
    }
  } catch {}

  return (
    <div className="theme-home-refined public-grid-background public-article-page flex min-h-full flex-col bg-[var(--background)]">
      <SiteHeader initialTheme={defaultTheme} navLinks={navLinks} showProgress />

      <main className="page-main mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <article className="public-article-card rounded-2xl border border-[var(--border-warm)] bg-[var(--background)] px-6 py-8 sm:px-10 sm:py-10">
          <header className="mb-10 border-b border-[var(--editor-line)] pb-8 sm:mb-12 sm:pb-10">
            <h1 className="article-display-title text-3xl font-bold leading-tight text-[var(--editor-ink)] sm:text-4xl">
              关于
            </h1>
          </header>
          <div
            id="about-content"
            className="rich-content text-[1.06rem] leading-[1.9] sm:text-lg"
            dangerouslySetInnerHTML={{ __html: personalContent.about.html }}
          />
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
