'use client'

import { type Theme } from '@/lib/appearance'
import type { PostWithTags } from '@/lib/db'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import { HomeVariantA } from '@/components/themes/HomeVariantA'

export type { Theme }

export interface HomeProps {
  initialTheme: Theme
  posts: PostWithTags[]
  categories: SiteCategoryLink[]
  navLinks: SiteNavLink[]
  currentPage: number
  totalPages: number
  categorySlugMap: Record<string, string>
}

export function HomeClient(props: HomeProps) {
  return <HomeVariantA {...props} initialTheme="refined" />
}
