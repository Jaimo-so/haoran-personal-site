'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Pagination } from '@/components/Pagination'
import { PERSONAL_SITE, PERSONAL_TOOLKIT } from '@/lib/personal-site'
import type { HomeProps } from '@/components/HomeClient'

function formatDate(ts: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts * 1000))
}

const focusAreas = [
  {
    index: '01',
    title: 'AI 产品拆解',
    description: '从用户问题、交互路径和商业价值出发，理解一个 AI 产品为什么成立。',
  },
  {
    index: '02',
    title: '原型与实验',
    description: '把想法变成可验证的原型，用真实反馈校准需求判断与产品方案。',
  },
  {
    index: '03',
    title: '学习与复盘',
    description: '记录模型能力、行业认知与求职实践，沉淀可复用的方法和判断。',
  },
]

export function HomeVariantA({
  initialTheme,
  posts,
  categories,
  navLinks,
  currentPage,
  totalPages,
}: HomeProps) {
  const router = useRouter()
  const githubLink = navLinks.find((link) => link.label.toLowerCase() === 'github')
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  return (
    <div className="theme-home-refined flex min-h-full flex-col bg-[var(--background)]">
      <SiteHeader
        initialTheme={initialTheme}
        navLinks={navLinks}
        categories={categories}
      />

      <main className="refined-home-main mx-auto w-full max-w-5xl flex-1 px-5 pb-24 sm:px-8 lg:px-10">
        <section id="about" className="border-b border-[var(--border-warm)] py-20 sm:py-28">
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--editor-accent)]/30 bg-[var(--editor-accent)]/5 px-3 py-1.5 text-sm font-medium text-[var(--editor-accent)]">
            <span className="size-1.5 rounded-full bg-[var(--editor-accent)]" aria-hidden="true" />
            {PERSONAL_SITE.role}
          </p>
          <h1 className="max-w-4xl text-balance font-serif text-4xl font-medium leading-[1.16] text-[var(--editor-ink)] sm:text-6xl">
            {PERSONAL_SITE.headline}
          </h1>
          <div className="mt-9 flex max-w-3xl flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xl text-pretty text-base leading-8 text-[var(--editor-muted)] sm:text-lg">
              {PERSONAL_SITE.introduction}
            </p>
            <a
              href="#work"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[var(--editor-ink)] px-5 py-3 text-sm font-medium text-[var(--background)] transition-opacity duration-150 hover:opacity-80 sm:self-auto"
            >
              查看我的项目
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        <section id="work" className="py-20 sm:py-24">
          <div className="mb-6 flex items-baseline justify-between rounded-2xl border border-[var(--border-warm)] bg-[var(--editor-panel)] px-6 py-5 sm:px-8">
            <h2 className="text-balance font-serif text-2xl font-medium text-[var(--editor-ink)] sm:text-3xl">
              我的项目
            </h2>
            <span className="text-sm tabular-nums text-[var(--stone-gray)]">Selected projects</span>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border-warm)] bg-[var(--border-warm)] md:grid-cols-3">
            {focusAreas.map((item) => (
              <article key={item.index} className="bg-[var(--editor-panel)] p-7 sm:p-8">
                <span className="text-sm tabular-nums text-[var(--editor-accent)]">{item.index}</span>
                <h3 className="mt-12 text-balance font-serif text-xl font-medium text-[var(--editor-ink)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-pretty text-sm leading-7 text-[var(--editor-muted)]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="writing" className="border-t border-[var(--border-warm)] py-20 sm:py-24">
          <div className="mb-6 rounded-2xl border border-[var(--border-warm)] bg-[var(--editor-panel)] px-6 py-5 sm:px-8">
            <h2 className="text-balance font-serif text-2xl font-medium text-[var(--editor-ink)] sm:text-3xl">
              最近思考
            </h2>
          </div>

          {posts.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--editor-panel)] px-6 py-14 text-center">
              <p className="text-pretty text-sm leading-7 text-[var(--editor-muted)]">第一篇文章正在准备中。</p>
              <a href="#about" className="mt-4 inline-block text-sm text-[var(--editor-accent)] hover:underline">
                先认识我
              </a>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {posts.map((post) => (
                  <article
                    key={post.slug}
                    className="overflow-hidden rounded-2xl border border-[var(--border-warm)] bg-[var(--editor-panel)]"
                  >
                    <Link
                      href={`/${post.slug}`}
                      aria-busy={pendingSlug === post.slug}
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                          event.preventDefault()
                          setPendingSlug(post.slug)
                          window.setTimeout(() => router.push(`/${post.slug}`), 160)
                        }
                      }}
                      className="group grid gap-3 px-6 py-7 sm:grid-cols-[140px_1fr_auto] sm:items-start sm:gap-7 sm:px-8"
                    >
                      <time className="pt-1 text-xs tabular-nums text-[var(--stone-gray)]">
                        {formatDate(post.published_at)}
                      </time>
                      <div>
                        <h3 className="text-balance font-serif text-xl font-medium leading-8 text-[var(--editor-ink)] group-hover:text-[var(--editor-accent)]">
                          {post.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--editor-accent)]">
                          {post.category && <span>{post.category}</span>}
                          {post.is_pinned === 1 && <span>置顶</span>}
                        </div>
                        {post.description && (
                          <p className="mt-2 line-clamp-2 text-pretty text-sm leading-7 text-[var(--editor-muted)]">
                            {post.description}
                          </p>
                        )}
                      </div>
                      <ArrowUpRight className="mt-1 hidden size-4 text-[var(--stone-gray)] group-hover:text-[var(--editor-accent)] sm:block" aria-hidden="true" />
                    </Link>
                  </article>
                ))}
              </div>
              <div className="pt-8">
                <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/" />
              </div>
            </>
          )}
        </section>

        <section id="toolkit" className="border-t border-[var(--border-warm)] py-20 sm:py-24">
          <div className="mb-6 flex items-baseline justify-between rounded-2xl border border-[var(--border-warm)] bg-[var(--editor-panel)] px-6 py-5 sm:px-8">
            <h2 className="text-balance font-serif text-2xl font-medium text-[var(--editor-ink)] sm:text-3xl">
              我的 AI 工具箱
            </h2>
            <span className="text-sm text-[var(--stone-gray)]">How I work</span>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border-warm)] bg-[var(--border-warm)] md:grid-cols-3">
            {PERSONAL_TOOLKIT.map((item) => (
              <article key={item.index} className="bg-[var(--editor-panel)] p-7 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm tabular-nums text-[var(--editor-accent)]">{item.index}</span>
                  <span className="text-right text-xs text-[var(--stone-gray)]">{item.tools}</span>
                </div>
                <h3 className="mt-12 text-balance font-serif text-xl font-medium text-[var(--editor-ink)]">
                  {item.title}
                </h3>
                <p className="mt-3 text-pretty text-sm leading-7 text-[var(--editor-muted)]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="border-t border-[var(--border-warm)] py-20 sm:py-24">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 text-sm text-[var(--editor-accent)]">2027 Campus Recruitment</p>
              <h2 className="text-balance font-serif text-3xl font-medium leading-tight text-[var(--editor-ink)] sm:text-4xl">
                正在寻找 AI 产品经理机会，期待与你交流。
              </h2>
              <p className="mt-5 text-pretty text-sm leading-7 text-[var(--editor-muted)] sm:text-base">
                如果你关注生成式 AI、用户体验或产品增长，欢迎通过以下方式了解更多。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--editor-ink)] px-5 py-3 text-sm font-medium text-[var(--background)] transition-opacity duration-150 hover:opacity-80"
              >
                了解更多
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Link>
              {githubLink && (
                <a
                  href={githubLink.url}
                  target={githubLink.openInNewTab ? '_blank' : undefined}
                  rel={githubLink.openInNewTab ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-warm)] px-5 py-3 text-sm font-medium text-[var(--editor-ink)] transition-colors duration-150 hover:border-[var(--editor-ink)]"
                >
                  GitHub
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      {pendingSlug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/80 px-6"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-center gap-3 rounded-full border border-[var(--border-warm)] bg-[var(--background)] px-5 py-3 shadow-sm">
            <span
              className="size-4 animate-spin rounded-full border-2 border-[var(--border-warm)] border-t-[var(--editor-accent)] motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-[var(--editor-ink)]">正在打开笔记…</span>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  )
}
