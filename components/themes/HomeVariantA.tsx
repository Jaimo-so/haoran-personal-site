'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Pagination } from '@/components/Pagination'
import { getProjectLinks } from '@/lib/project-links'
import type { HomeProps } from '@/components/HomeClient'
import './portfolio.css'

function GithubIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.9a3.4 3.4 0 0 0-.9-2.7c3-.3 6.2-1.5 6.2-6.9A5.4 5.4 0 0 0 18.8 4a5 5 0 0 0-.1-3s-1.2-.4-3.9 1.5a13.4 13.4 0 0 0-7 0C5.1.6 3.9 1 3.9 1a5 5 0 0 0-.1 3A5.4 5.4 0 0 0 2.3 8c0 5.4 3.2 6.6 6.2 6.9a3.4 3.4 0 0 0-.9 2.7v3.9" /></svg>
}

const coverWords: Record<string, [string, string]> = {
  'AI 产品拆解': ['AI 产品', '拆解。'],
  '原型与实验': ['原型', '与实验。'],
  '学习与复盘': ['学习', '与复盘。'],
  'Jaimo Flow': ['Jaimo', 'Flow.'],
  'prompt-studio': ['prompt', 'studio_'],
  'AI 发布 Skill': ['AI', '发布 Skill'],
}

function Cover({ name, index, kind, category }: { name: string; index: number; kind: 'project' | 'tool'; category?: string }) {
  const cover = useRef<HTMLDivElement>(null)
  const art = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = cover.current
    const artwork = art.current
    if (!element || !artwork) return
    // The stretched title link sits above the cover; its events reach the card.
    const surface = kind === 'project' ? element.closest<HTMLElement>('.project-item') : element
    if (!surface) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let bounds: DOMRect | null = null
    let frame = 0
    function reset() {
      bounds = null
      cancelAnimationFrame(frame)
      frame = 0
      artwork!.style.transform = ''
    }
    function enter(event: globalThis.PointerEvent) {
      if (event.pointerType === 'mouse' && !preference.matches) bounds = element!.getBoundingClientRect()
    }
    function move(event: globalThis.PointerEvent) {
      if (!bounds || event.pointerType !== 'mouse' || preference.matches) return
      const x = (Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) - .5) * 10
      const y = (Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) - .5) * 8
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        artwork!.style.transform = `translate3d(${x}px, ${y}px, 0)`
        frame = 0
      })
    }
    surface.addEventListener('pointerenter', enter)
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerleave', reset)
    surface.addEventListener('pointercancel', reset)
    preference.addEventListener('change', reset)
    return () => {
      surface.removeEventListener('pointerenter', enter)
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', reset)
      surface.removeEventListener('pointercancel', reset)
      preference.removeEventListener('change', reset)
      reset()
    }
  }, [kind])
  const words = coverWords[name]
  const palette = kind === 'project' ? `project-palette-${index % 3}` : ['sage', 'clay', 'forest'][index % 3]
  return (
    <div className={`project-cover ${palette}`} aria-hidden="true" ref={cover}>
      <span className="cover-kicker">{String(index + 1).padStart(2, '0')} / {kind === 'project' ? 'SELECTED PROJECT' : 'MY TOOLKIT'}</span>
      <div className="cover-orbit" />
      <div className="cover-art" ref={art}>
        <span className={`cover-word${words ? '' : ' custom-cover-word'}`}>{words ? <>{words[0]}<br /><em>{words[1]}</em></> : name}</span>
        <span className="cover-symbol">{(kind === 'project' ? ['↗', '＋', '↻'] : ['↗', '⌘', '✳'])[index % 3]}</span>
      </div>
      <div className="cover-bottom"><span>{category || name}</span><span>{String(index + 1).padStart(2, '0')}</span></div>
    </div>
  )
}

function ProjectDescription({ description, name }: { description: string; name: string }) {
  const id = useId()
  const paragraph = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const element = paragraph.current
    if (!element) return
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight)
      setOverflows(element.scrollHeight > lineHeight * 3 + 1)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [description])

  return <>
    <p id={id} ref={paragraph} className="project-description" data-expanded={expanded}>{description}</p>
    {overflows && <button type="button" className="project-description-toggle" aria-expanded={expanded} aria-controls={id}
      aria-label={`${expanded ? '收起' : '展开'}${name}的介绍`} onClick={() => setExpanded(!expanded)}>
      {expanded ? '收起介绍' : '展开介绍'}<span aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>}
  </>
}

function ProjectDestination({ href, name }: { href: string; name: string }) {
  const label = 'GitHub'
  const className = 'project-action repo'
  return href ? (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${name}：${label}（新窗口）`}>
      <GithubIcon /><span>{label}</span><ArrowUpRight aria-hidden="true" size={12} />
    </a>
  ) : (
    <button className={`${className} unavailable`} type="button" disabled title={`暂未提供${label}地址`}>
      <GithubIcon /><span>{label}</span><span className="pending-dot" aria-hidden="true" />
    </button>
  )
}

export function HomeVariantA({ initialTheme, posts, categories, navLinks, currentPage, totalPages, managedTools, managedProjects, personalContent }: HomeProps) {
  const router = useRouter()
  const githubLink = navLinks.find((link) => link.label.toLowerCase() === 'github')
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const animations = new Set<Animation>()
    const seen = new Set<Element>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting || preference.matches || seen.has(target)) return
        seen.add(target)
        const animation = target.animate([{ opacity: 0, transform: 'translate3d(0,20px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], {
          duration: 650, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'backwards',
        })
        animations.add(animation)
        animation.onfinish = () => animations.delete(animation)
        observer.unobserve(target)
      })
    }, { threshold: .12 })
    const observe = () => root.current?.querySelectorAll('.reveal').forEach((element) => { if (!seen.has(element)) observer.observe(element) })
    function onPreferenceChange() {
      if (preference.matches) { observer.disconnect(); animations.forEach((animation) => animation.cancel()); animations.clear() }
      else observe()
    }
    if (!preference.matches) observe()
    preference.addEventListener('change', onPreferenceChange)
    return () => { observer.disconnect(); animations.forEach((animation) => animation.cancel()); preference.removeEventListener('change', onPreferenceChange) }
  }, [posts, managedProjects, managedTools])

  return (
    <div className="portfolio-home theme-home-refined flex min-h-full flex-col" ref={root}>
      <SiteHeader initialTheme={initialTheme} navLinks={navLinks} categories={categories} showProgress />
      <main className="main">
        <section className="hero" id="about">
          <div className="hero-content">
            <div className="badge">{personalContent.hero.role}</div>
            <h1>{personalContent.hero.headline.replaceAll('，', '，\n').split('\n').filter(Boolean).map((line, index) => <span className="phrase" key={`${line}-${index}`}>{line}</span>)}</h1>
            <div className="hero-bottom"><p>{personalContent.hero.introduction}</p><a className="button" href="#work">查看我的项目 <ArrowUpRight size={16} aria-hidden="true" /></a></div>
          </div>
          <div className="hero-portrait">
            <Image className="hero-ip" src="/images/haoran-ip.png" alt="个人 IP 形象：戴着黑框眼镜、身穿浅蓝色套装的可爱男孩" width={1202} height={1308} preload />
          </div>
        </section>

        <section id="work" className="section gallery-section projects-section">
          <div className="gallery-heading reveal"><div><span className="eyebrow">SELECTED PROJECTS</span><h2>我的项目<span className="section-count">{String(managedProjects.length).padStart(2, '0')}</span></h2></div><p>从产品拆解，到原型实践与复盘。</p></div>
          {managedProjects.length === 0 ? <p className="empty-state">项目正在整理中，敬请期待。</p> : (
            <div className="project-gallery">{managedProjects.map((item, index) => {
              const links = getProjectLinks(item)
              const cardHref = links.website || links.github
              return <article className="project-item reveal" key={item.id}>
                <Cover name={item.name} index={index} kind="project" />
                <div className="project-caption"><h3>{cardHref ? (
                  <a className="project-card-link" href={cardHref} target="_blank" rel="noopener noreferrer"
                    aria-label={`${item.name}：${links.website ? '访问网站' : 'GitHub'}（新窗口）`}>{item.name}</a>
                ) : item.name}</h3><ProjectDescription description={item.description} name={item.name} /></div>
                <div className="project-actions project-destinations">
                  <ProjectDestination href={links.github} name={item.name} />
                </div>
              </article>
            })}</div>
          )}
        </section>

        <section id="writing" className="section">
          <div className="section-heading reveal"><h2>最近思考</h2></div>
          {posts.length === 0 ? <div className="empty-state"><p>第一篇文章正在准备中。</p><a href="#about">先认识我</a></div> : <>
            <div className="posts">{posts.map((post, index) => (
              <Link className="post reveal" key={post.slug} href={`/${post.slug}`} aria-busy={pendingSlug === post.slug}
                onClick={(event) => {
                  if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault(); setPendingSlug(post.slug); router.push(`/${post.slug}`)
                  }
                }}>
                <div className="post-date"><span className="post-index">{String(index + 1).padStart(2, '0')}</span><time dateTime={new Date(post.published_at * 1000).toISOString()}>{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(post.published_at * 1000))}</time></div>
                <div className="post-main"><h3>{post.title}</h3>{post.description && <p className="description">{post.description}</p>}
                  <div className="post-footer"><span className="category">{post.category}{post.is_pinned === 1 && ' · 置顶'}</span><span className="read-link">阅读全文 <ArrowUpRight size={16} aria-hidden="true" /></span></div>
                </div>
              </Link>
            ))}</div>
            <div className="pt-8"><Pagination currentPage={currentPage} totalPages={totalPages} basePath="/" /></div>
          </>}
        </section>

        <section id="toolkit" className="section gallery-section toolkit-section">
          <div className="gallery-heading reveal"><div><span className="eyebrow">MY TOOLKIT</span><h2>我的 AI 工具箱<span className="section-count">{String(managedTools.length).padStart(2, '0')}</span></h2></div><p>研究、构建与发布时，我使用的工具。</p></div>
          {managedTools.length === 0 ? <p className="empty-state">新的工具正在整理中。</p> : <div className="project-gallery">{managedTools.map((item, index) => (
            <a className="project-item tool-entry reveal" key={item.id} href={item.link_url} target="_blank" rel="noopener noreferrer" aria-label={`打开 ${item.name}（新窗口）`}>
              <Cover name={item.name} index={index} kind="tool" category={item.category} />
              <div className="project-caption"><h3>{item.name}</h3><p>{item.description}</p></div>
            </a>
          ))}</div>}
        </section>

        <section id="contact" className="contact reveal"><div><small>{personalContent.contact.eyebrow}</small><h2>{personalContent.contact.headline}</h2><p>{personalContent.contact.description}</p></div><div className="contact-actions"><Link className="button" href="/about">了解更多 <ArrowUpRight size={16} aria-hidden="true" /></Link>{githubLink && <a className="button secondary" href={githubLink.url} target={githubLink.openInNewTab ? '_blank' : undefined} rel={githubLink.openInNewTab ? 'noopener noreferrer' : undefined}>GitHub <ArrowUpRight size={16} aria-hidden="true" /></a>}</div></section>
      </main>
      {pendingSlug && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--background)]/80 px-6" role="status" aria-live="polite"><div className="flex items-center gap-3 rounded-full border border-[var(--border-warm)] bg-[var(--background)] px-5 py-3 shadow-sm"><span className="size-4 animate-spin rounded-full border-2 border-[var(--border-warm)] border-t-[var(--editor-accent)] motion-reduce:animate-none" aria-hidden="true" /><span className="text-sm font-medium text-[var(--editor-ink)]">正在打开笔记…</span></div></div>}
      <SiteFooter />
    </div>
  )
}
