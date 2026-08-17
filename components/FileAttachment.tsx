interface FileAttachmentProps {
  url: string
  name: string
  size?: number
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const iconMap: Record<string, string> = {
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    pdf: '📄',
    txt: '📝',
    epub: '📚',
    mobi: '📚',
    azw: '📚',
    azw3: '📚',
  }

  return iconMap[ext] || '📎'
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''

  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileAttachment({ url, name, size }: FileAttachmentProps) {
  const icon = getFileIcon(name)
  const sizeText = formatFileSize(size)

  return (
    <a
      href={url}
      download={name}
      className="
        inline-flex items-center gap-3 px-4 py-3
        bg-[var(--editor-panel)] border border-[var(--editor-line)]
        rounded-lg hover:border-[var(--editor-accent)]
        transition-all duration-200
        group cursor-pointer
        max-w-md
      "
    >
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--editor-ink)] truncate group-hover:text-[var(--editor-accent)] transition-colors">
          {name}
        </p>
        {sizeText && (
          <p className="text-xs text-[var(--editor-muted)] mt-0.5">
            {sizeText}
          </p>
        )}
      </div>
      <svg
        className="w-4 h-4 text-[var(--stone-gray)] group-hover:text-[var(--editor-accent)] transition-colors flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  )
}
