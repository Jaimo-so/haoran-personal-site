import { getCategories } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { CategoryManager } from './CategoryManager'

export const metadata = { title: '分类管理' }

export default async function CategoriesPage() {
  const env = await getAppCloudflareEnv()
  let categories: Awaited<ReturnType<typeof getCategories>> = []

  if (env?.DB) {
    try {
      categories = await getCategories(env.DB)
    } catch (error) {
      console.error('Categories fetch error:', error)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--editor-ink)]">分类管理</h1>
        <p className="text-sm text-[var(--editor-muted)] mt-0.5">
          共 {categories.length} 个分类
        </p>
      </div>
      <CategoryManager initialCategories={categories} />
    </div>
  )
}

