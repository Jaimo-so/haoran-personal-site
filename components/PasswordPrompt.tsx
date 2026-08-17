'use client'

import { useState } from 'react'

interface PasswordPromptProps {
  error?: string
}

export function PasswordPrompt({ error }: PasswordPromptProps) {
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim()) {
      const url = new URL(window.location.href)
      url.searchParams.set('pwd', password.trim())
      window.location.href = url.toString()
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--editor-panel)] rounded-xl border border-[var(--editor-line)] p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--editor-accent)]/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--editor-accent)]">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--editor-ink)] mb-2">
              此文章已加密
            </h2>
            <p className="text-sm text-[var(--editor-muted)]">
              请输入密码查看内容
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)] focus:border-transparent transition"
              />
              {error && (
                <p className="mt-2 text-sm text-rose-600">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!password.trim()}
              className="w-full px-4 py-3 rounded-lg bg-[var(--editor-accent)] text-white font-medium hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              解锁文章
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
