'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { refreshAdminSession, useAdminSession } from '@/lib/admin-session-client'
import { PERSONAL_SITE } from '@/lib/personal-site'

export function SiteFooter() {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { authenticated: isAdmin } = useAdminSession()

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setPassword('')
      setError('')
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        await refreshAdminSession()
        setOpen(false)
      } else {
        setError('密码错误')
        setPassword('')
        inputRef.current?.focus()
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <footer className="border-t border-[var(--editor-line)] mt-auto">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 flex items-center justify-center gap-2 text-xs text-[var(--stone-gray)]">
          <span>© {new Date().getFullYear()}</span>
          <span>·</span>
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className="hover:text-[var(--editor-ink)] transition-colors duration-150 underline-offset-2 hover:underline"
              >
                {PERSONAL_SITE.siteName}
              </Link>
              <span>·</span>
              <Link
                href="/editor?new=1"
                title="写新文章"
                className="inline-flex items-center gap-1 hover:text-[var(--editor-accent)] transition-colors duration-150"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>新文章</span>
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="hover:text-[var(--editor-ink)] transition-colors duration-150 underline-offset-2 hover:underline"
            >
              {PERSONAL_SITE.siteName}
            </button>
          )}
        </div>
      </footer>

      {/* 密码弹窗 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--editor-ink)]/30 px-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-[var(--editor-panel)] rounded-xl shadow-xl p-4 sm:p-6 w-full max-w-[90vw] sm:max-w-xs border border-[var(--editor-line)]">
            <h2 className="text-sm font-semibold text-[var(--editor-ink)] mb-4">进入管理后台</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                ref={inputRef}
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--editor-line)] bg-white px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-accent)]/15 transition-all duration-150"
              />
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex-1 rounded-lg bg-[var(--editor-accent)] py-2.5 text-sm font-semibold text-white hover:brightness-105 transition-all duration-150 disabled:opacity-50"
                >
                  {loading ? '验证中…' : '登录'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[var(--editor-line)] px-4 py-2.5 text-sm text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] transition-all duration-150"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
