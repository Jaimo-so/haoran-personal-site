'use client'

import { useEffect, useState, useRef } from 'react'
import { resolveMenuPlacement, type MenuPlacement } from '@/lib/menu-placement'

interface Category {
  name: string
  slug: string
}

interface CategorySelectorProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

interface CategoriesResponse {
  categories?: Category[]
}

export function CategorySelector({ value, onChange, className = '' }: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>('bottom')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => r.json() as Promise<Category[] | CategoriesResponse>)
      .then((data: Category[] | CategoriesResponse) => {
        const cats = Array.isArray(data) ? data : data?.categories
        if (Array.isArray(cats)) setCategories(cats)
      })
      .catch(() => {})
  }, [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // 键盘操作
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const allCategories = [
    { name: '未分类', slug: 'uncategorized' },
    ...categories.filter((c) => c.name !== '未分类'),
  ]

  const handleToggle = () => {
    if (!open && ref.current) {
      const listHeight = Math.min(Math.max(allCategories.length, 1) * 40 + 10, 240)
      setMenuPlacement(resolveMenuPlacement(ref.current, listHeight))
    }
    setOpen((current) => !current)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className="h-9 min-w-[120px] text-sm font-medium rounded-lg border border-[var(--editor-line)] bg-[var(--editor-soft)] text-[var(--editor-ink)] pl-3 pr-8 outline-none cursor-pointer hover:bg-[var(--border-warm)] focus:ring-1 focus:ring-[var(--editor-accent)] transition-colors text-left relative"
      >
        <span className="truncate block">{value || '未分类'}</span>
        <svg
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4.5 6 7.5 9 4.5" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-50 w-full min-w-[160px] rounded-lg border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-lg py-1 max-h-60 overflow-y-auto ${
          menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {allCategories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => {
                onChange(cat.name)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                cat.name === value
                  ? 'bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium'
                  : 'text-[var(--editor-ink)] hover:bg-[var(--editor-soft)]'
              }`}
            >
              {cat.name}
            </button>
          ))}
          {allCategories.length === 1 && (
            <div className="px-3 py-2 text-xs text-[var(--stone-gray)]">
              暂无其他分类
            </div>
          )}
        </div>
      )}
    </div>
  )
}
