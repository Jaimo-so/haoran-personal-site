'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe, Lock, Eye, Link2 } from 'lucide-react'

export type PublishStatus = 'public' | 'draft' | 'encrypted' | 'unlisted'

interface PublishStatusDropdownProps {
  value: PublishStatus
  onChange: (status: PublishStatus) => void
  disabled?: boolean
}

const STATUS_CONFIG = {
  public: {
    label: '公开访问',
    icon: Globe,
    description: '所有人可见，出现在首页和搜索',
  },
  draft: {
    label: '草稿自见',
    icon: Eye,
    description: '仅自己可见，不会发布',
  },
  encrypted: {
    label: '加密访问',
    icon: Lock,
    description: '需要密码才能查看',
  },
  unlisted: {
    label: '链接访问',
    icon: Link2,
    description: '不在首页显示，但可通过链接访问',
  },
}

export function PublishStatusDropdown({ value, onChange, disabled }: PublishStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const currentConfig = STATUS_CONFIG[value]
  const Icon = currentConfig.icon

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--editor-line)] bg-[var(--background)] text-sm text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon className="w-4 h-4" />
        <span>{currentConfig.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-lg overflow-hidden z-50">
          {(Object.entries(STATUS_CONFIG) as [PublishStatus, typeof STATUS_CONFIG[PublishStatus]][]).map(
            ([status, config]) => {
              const StatusIcon = config.icon
              const isActive = status === value

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    onChange(status)
                    setOpen(false)
                  }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--editor-soft)] transition-colors ${
                    isActive ? 'bg-[var(--editor-accent)]/5' : ''
                  }`}
                >
                  <StatusIcon
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      isActive ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-muted)]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        isActive ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-ink)]'
                      }`}
                    >
                      {config.label}
                    </div>
                    <div className="text-xs text-[var(--editor-muted)] mt-0.5">
                      {config.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-[var(--editor-accent)] mt-1.5 shrink-0" />
                  )}
                </button>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}
