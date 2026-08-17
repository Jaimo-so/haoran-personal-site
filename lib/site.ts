import { normalizeTheme, type Theme } from '@/lib/appearance'
import { getPublicCategories, getSetting } from '@/lib/db'

export interface SiteNavLink {
  label: string
  url: string
  openInNewTab: boolean
}

export interface SiteCategoryLink {
  name: string
  slug: string
}

export async function getSiteHeaderData(db: D1Database): Promise<{
  navLinks: SiteNavLink[]
  categories: SiteCategoryLink[]
  defaultTheme: Theme
}> {
  let navLinks: SiteNavLink[] = []
  let categories: SiteCategoryLink[] = []
  let defaultTheme: Theme = 'default'

  try {
    const [navJson, categoryRows, themeValue] = await Promise.all([
      getSetting(db, 'nav_links'),
      getPublicCategories(db),
      getSetting(db, 'default_theme'),
    ])

    if (navJson) {
      try {
        const parsed = JSON.parse(navJson)
        if (Array.isArray(parsed)) {
          navLinks = parsed.map((link: SiteNavLink) => (
            link.label === '关于' ? { ...link, url: '/about', openInNewTab: false } : link
          ))
        }
      } catch {}
    }

    categories = categoryRows
      .filter((category) => category.slug && category.name && category.name !== '未分类')
      .map((category) => ({
        name: category.name,
        slug: category.slug,
      }))

    defaultTheme = normalizeTheme(themeValue)
  } catch {
    // Keep graceful fallback behavior for public pages
  }

  return { navLinks, categories, defaultTheme }
}
