import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isAdminAuthenticated, COOKIE_NAME } from '@/lib/admin-auth'
import Link from 'next/link'
import { LogoutButton } from './LogoutButton'
import { PenLine, ExternalLink } from 'lucide-react'
import { AdminFooter } from '@/components/AdminFooter'

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!(await isAdminAuthenticated(token))) {
    redirect('/admin/login')
  }

  const navCls = 'px-3 py-2 rounded-lg text-sm text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-all duration-150 whitespace-nowrap'

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <header className="sticky top-0 z-40 bg-[var(--editor-panel)] border-b border-[var(--editor-line)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/"
              className="text-lg tracking-tight text-[var(--editor-ink)] hover:text-[var(--editor-accent)] transition-colors duration-200"
              style={{ fontFamily: 'Georgia, "Noto Serif SC", serif', fontWeight: 500 }}
            >
              HaoRan
            </Link>
            <span className="text-[var(--editor-line)] hidden sm:inline">/</span>
            <span className="text-[var(--stone-gray)] hidden sm:inline">管理后台</span>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            <Link href="/admin/posts" className={navCls}>文章</Link>
            <Link href="/admin/categories" className={navCls}>分类</Link>
            <Link href="/admin/settings" className={navCls}>设置</Link>
            <div className="w-px h-4 bg-[var(--editor-line)] mx-2 hidden md:block" />
            <Link
              href="/editor"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--editor-accent)] text-white rounded-lg text-sm font-medium hover:brightness-105 transition-all whitespace-nowrap"
            >
              <PenLine className="w-4 h-4" />
              <span className="hidden md:inline">写文章</span>
            </Link>
            <Link
              href="/"
              className={`${navCls} hidden md:inline-flex items-center gap-1`}
              title="查看博客"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-8 flex-1">{children}</main>

      <AdminFooter />
    </div>
  )
}
