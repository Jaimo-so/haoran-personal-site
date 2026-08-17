'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { resolveMenuPlacement, type MenuPlacement } from '@/lib/menu-placement'

interface DropdownOption {
  value: string
  label: string
  title?: string
  searchText?: string
}

interface DropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  menuPlacement?: MenuPlacement | 'auto'
}

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = '请选择',
  className = '',
  disabled = false,
  menuPlacement = 'auto',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [resolvedPlacement, setResolvedPlacement] = useState<MenuPlacement>('bottom')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  const filteredOptions = options.filter(opt =>
    `${opt.label} ${opt.searchText || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // 自动聚焦搜索框
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleToggle = () => {
    if (disabled) return

    if (!isOpen && dropdownRef.current) {
      const searchHeight = options.length > 5 ? 57 : 0
      const listHeight = Math.min(Math.max(options.length, 1) * 40, 240)
      setResolvedPlacement(resolveMenuPlacement(
        dropdownRef.current,
        searchHeight + listHeight + 10,
        menuPlacement,
      ))
    }

    setIsOpen((current) => !current)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* 触发按钮 */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          w-full px-3 py-2 rounded-lg border text-sm text-left
          flex items-center justify-between gap-2
          transition-colors
          ${disabled
            ? 'bg-[var(--editor-soft)] text-[var(--stone-gray)] cursor-not-allowed'
            : 'bg-[var(--background)] border-[var(--editor-line)] text-[var(--editor-ink)] hover:border-[var(--editor-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)]/20'
          }
        `}
      >
        <span
          className={selectedOption ? '' : 'text-[var(--editor-muted)]'}
          title={selectedOption?.title}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--stone-gray)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className={`absolute z-50 w-full overflow-hidden rounded-lg border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-lg ${
            resolvedPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {/* 搜索框 */}
          {options.length > 5 && (
            <div className="p-2 border-b border-[var(--editor-line)]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                className="w-full px-3 py-1.5 text-sm rounded border border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--editor-accent)]/20"
              />
            </div>
          )}

          {/* 选项列表 */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[var(--editor-muted)] text-center">
                无匹配结果
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  title={option.title}
                  className={`
                    w-full px-3 py-2 text-sm text-left
                    flex items-center justify-between gap-2
                    transition-colors
                    ${option.value === value
                      ? 'bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                      : 'text-[var(--editor-ink)] hover:bg-[var(--editor-soft)]'
                    }
                  `}
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <Check className="w-4 h-4 text-[var(--editor-accent)]" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
