import Link from 'next/link'

interface PaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
}

export function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  const href = (page: number) =>
    page === 1 ? basePath : `${basePath}${basePath.includes('?') ? '&' : '?'}page=${page}`

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-12" aria-label="分页导航">
      {currentPage > 1 && (
        <Link
          href={href(currentPage - 1)}
          className="px-2.5 sm:px-3 py-2 text-sm rounded-lg text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-all duration-150"
        >
          ← <span className="hidden xs:inline">上一页</span>
        </Link>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="px-2 text-[var(--stone-gray)]">
            ...
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            className={`min-w-[2rem] sm:min-w-[2.25rem] px-2 sm:px-3 py-2 text-sm text-center rounded-lg transition-all duration-150 ${
              p === currentPage
                ? 'bg-[var(--editor-ink)] text-[var(--editor-panel)] font-semibold shadow-sm'
                : 'text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-soft)]'
            }`}
          >
            {p}
          </Link>
        )
      )}

      {currentPage < totalPages && (
        <Link
          href={href(currentPage + 1)}
          className="px-2.5 sm:px-3 py-2 text-sm rounded-lg text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-all duration-150"
        >
          <span className="hidden xs:inline">下一页</span> →
        </Link>
      )}
    </nav>
  )
}

