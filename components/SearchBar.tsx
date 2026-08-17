'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'

interface SearchResult {
  slug: string
  title: string
  description: string | null
  category: string | null
  published_at: number
  password: boolean
}

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      document.body.style.overflow = 'hidden'
    } else {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
        const data = (await res.json()) as { results?: SearchResult[] }
        setResults(data.results || [])
        setSelectedIndex(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (results.length > 0 && results[selectedIndex]) {
      router.push(`/${results[selectedIndex].slug}`)
      setIsOpen(false)
    } else if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setIsOpen(false)
    }
  }

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    }
  }

  const formatDate = (ts: number) => {
    const date = new Date(ts * 1000)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors"
        title="搜索 (⌘K)"
        aria-label="搜索"
      >
        <Search className="w-[18px] h-[18px]" />
      </button>

      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[100]"
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}
        >
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => setIsOpen(false)} />

          {/* 搜索面板 */}
          <div className="relative mx-auto mt-[12vh] sm:mt-[18vh] w-[92vw] max-w-[560px]">
            <div className="bg-white rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] border border-black/[0.06] overflow-hidden">

              {/* 输入区 */}
              <form onSubmit={handleSubmit} onKeyDown={handleKeyNav}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <Search className="w-5 h-5 text-[var(--editor-accent)] flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索文章..."
                    className="flex-1 text-base bg-transparent outline-none placeholder:text-[var(--stone-gray)]/60 text-[var(--editor-ink)]"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {loading ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-[var(--editor-accent)] flex-shrink-0">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-[var(--stone-gray)] bg-[var(--editor-soft)] border border-[var(--editor-line)] rounded font-mono">
                      ESC
                    </kbd>
                  )}
                </div>
              </form>

              {/* 分割线 */}
              {(results.length > 0 || (query.trim() && !loading)) && (
                <div className="border-t border-[var(--editor-line)]" />
              )}

              {/* 搜索结果 */}
              {results.length > 0 && (
                <div className="max-h-[50vh] overflow-y-auto py-2">
                  {results.map((result, index) => (
                    <Link
                      key={result.slug}
                      href={`/${result.slug}`}
                      onClick={() => setIsOpen(false)}
                      className={`block mx-2 px-3 py-2.5 rounded-lg transition-colors ${
                        index === selectedIndex
                          ? 'bg-[var(--editor-accent)]/[0.06]'
                          : 'hover:bg-[var(--editor-panel)]'
                      }`}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-[var(--editor-ink)] flex-1 line-clamp-1">
                          {result.title}
                        </h3>
                        <span className="text-[11px] text-[var(--stone-gray)] tabular-nums flex-shrink-0">
                          {formatDate(result.published_at)}
                        </span>
                      </div>
                      {result.description && (
                        <p className="text-xs text-[var(--editor-muted)] line-clamp-1 leading-relaxed">
                          {result.description}
                        </p>
                      )}
                      {result.category && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-[var(--editor-accent)]/8 text-[var(--editor-accent)]">
                          {result.category}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* 无结果 */}
              {query.trim() && results.length === 0 && !loading && (
                <div className="px-5 py-10 text-center">
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--editor-soft)] flex items-center justify-center">
                    <Search className="w-5 h-5 text-[var(--stone-gray)]" />
                  </div>
                  <p className="text-sm text-[var(--editor-muted)]">没有找到相关文章</p>
                  <p className="text-xs text-[var(--stone-gray)] mt-1">试试其他关键词</p>
                </div>
              )}

              {/* 底部快捷键提示 */}
              {results.length > 0 && (
                <div className="flex items-center gap-4 px-5 py-2.5 border-t border-[var(--editor-line)] bg-[var(--editor-panel)]/50">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--stone-gray)]">
                    <kbd className="px-1 py-0.5 bg-white border border-[var(--editor-line)] rounded text-[10px] font-mono">↑↓</kbd>
                    <span>选择</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--stone-gray)]">
                    <kbd className="px-1 py-0.5 bg-white border border-[var(--editor-line)] rounded text-[10px] font-mono">↵</kbd>
                    <span>打开</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--stone-gray)]">
                    <kbd className="px-1 py-0.5 bg-white border border-[var(--editor-line)] rounded text-[10px] font-mono">esc</kbd>
                    <span>关闭</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
