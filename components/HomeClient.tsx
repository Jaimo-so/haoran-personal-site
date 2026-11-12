'use client'

import { type Theme } from '@/lib/appearance'
import type { PostWithTags } from '@/lib/db'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import type { ManagedProject } from '@/lib/managed-projects'
import type { ManagedTool } from '@/lib/managed-tools'
import type { PersonalContent } from '@/lib/personal-content'
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
  managedTools: ManagedTool[]
  managedProjects: ManagedProject[]
  personalContent: PersonalContent
}

export function HomeClient(props: HomeProps) {
  return <HomeVariantA {...props} initialTheme="refined" />
}
