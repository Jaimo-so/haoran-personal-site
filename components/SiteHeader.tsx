'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { SearchEntry } from './SearchEntry'
import { type Theme } from '@/lib/appearance'
import { PERSONAL_NAV_LINKS, PERSONAL_SITE } from '@/lib/personal-site'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'

export type NavLink = SiteNavLink

interface SiteHeaderProps {
  navLinks?: NavLink[]
  categories?: SiteCategoryLink[]
  activeCategorySlug?: string | null
  stickyOnMobile?: boolean
  initialTheme?: Theme
}

const defaultNavLinks: NavLink[] = [...PERSONAL_NAV_LINKS]

export function SiteHeader({
  navLinks,
  stickyOnMobile = true,
}: SiteHeaderProps) {
  const links = navLinks && navLinks.length > 0 ? navLinks : defaultNavLinks
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const renderLink = (link: NavLink, onClick?: () => void) => {
    const className = "text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors duration-150"

    if (link.openInNewTab || link.url.startsWith('http')) {
      return (
        <a
          key={link.label}
          href={link.url}
          target={link.openInNewTab ? '_blank' : undefined}
          rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
          className={className}
          onClick={onClick}
        >
          {link.label}
        </a>
      )
    }

    return (
      <Link
        key={link.label}
        href={link.url}
        className={className}
        onClick={onClick}
      >
        {link.label}
      </Link>
    )
  }

  const renderLogo = () => {
    return (
      <Link
        href="/"
        className="flex-shrink-0 font-serif text-lg font-medium text-[var(--editor-ink)] transition-colors duration-150 hover:text-[var(--editor-accent)]"
        style={{ fontFamily: 'var(--logo-font, Georgia, "Noto Serif SC", serif)' }}
      >
        {PERSONAL_SITE.siteName}
      </Link>
    )
  }

  return (
    <header className={`site-header ${stickyOnMobile ? 'sticky' : 'sm:sticky'} top-0 z-40 border-b border-[var(--editor-line)] bg-[var(--background)]/95 backdrop-blur-sm`}>
      <div className="site-header-inner mx-auto max-w-5xl px-5 sm:px-8 lg:px-10">
        <div className="h-14 flex items-center justify-between gap-4">
          {renderLogo()}

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-3 text-sm flex-shrink-0">
            {links.map(link => renderLink(link))}
            <SearchEntry />
          </nav>

          {/* Mobile: search icon + hamburger */}
          <div className="sm:hidden flex items-center gap-1">
            <SearchEntry />
            <button
              className="p-2 text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && <div className="border-t border-[var(--editor-line)] sm:hidden">
        <div className="bg-[var(--background)]">
          <nav className="flex flex-col text-sm">
            {links.map(link => (
              <div key={link.label} className="px-4 py-3 border-b border-[var(--editor-line)]">
                {renderLink(link, () => setMobileMenuOpen(false))}
              </div>
            ))}
          </nav>
        </div>
      </div>}
    </header>
  )
}
