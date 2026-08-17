import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import type { Theme } from '@/lib/appearance'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData, type SiteNavLink } from '@/lib/site'

export const metadata = {
  title: '关于',
  description: '关于 HaoRan：一名 2027 届本科生、AI Builder 与 AI 产品经理求职者。',
}

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'default'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const headerData = await getSiteHeaderData(env.DB)
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
    }
  } catch {}

  return (
    <div className="flex min-h-full flex-col bg-[var(--background)]">
      <SiteHeader initialTheme={defaultTheme} navLinks={navLinks} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24 sm:px-8 lg:px-10">
        <header className="border-b border-[var(--editor-line)] py-16 sm:py-20">
          <h1 className="text-balance text-4xl font-semibold text-[var(--editor-accent)] sm:text-5xl">
            关于
          </h1>
        </header>

        <article className="max-w-4xl py-16 sm:py-20">
          <h2 className="text-balance text-2xl font-semibold text-[var(--editor-ink)] sm:text-3xl">
            我是谁
          </h2>

          <div className="mt-10 space-y-7 text-pretty text-lg leading-9 text-[var(--editor-ink)] sm:text-xl sm:leading-10">
            <p>
              我是 HaoRan，一名 2027 届本科生，也是一名{' '}
              <span className="border-b border-[var(--editor-accent)] pb-0.5 text-[var(--editor-accent)]">
                AI Builder
              </span>
              。
            </p>

            <p className="font-semibold">
              一个方向：成为真正理解用户、技术与商业的 AI 产品经理。
            </p>

            <p>
              我关注生成式 AI、用户体验与产品增长，也在持续记录产品拆解、原型实验和学习复盘。
            </p>

            <p>
              我更愿意用“构建”来理解产品：先找到值得解决的问题，再把模型能力转化为清晰的交互和可验证的方案。
            </p>

            <div className="space-y-7 pt-2">
              <p>
                <strong className="font-semibold">产品视角。</strong>
                从用户任务、使用场景和价值链路出发，判断一个 AI 产品为什么成立。
              </p>
              <p>
                <strong className="font-semibold">构建视角。</strong>
                用原型、实验和真实反馈推进想法，持续校准需求判断与产品方案。
              </p>
              <p>
                <strong className="font-semibold">成长视角。</strong>
                通过写作沉淀方法与判断，让每一次学习都能成为下一次实践的起点。
              </p>
            </div>
          </div>
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}
