'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface InputModalProps {
  open: boolean
  title: string
  placeholder?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function InputModal({ open, title, placeholder, onConfirm, onCancel }: InputModalProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // 延迟聚焦，等待动画
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed) {
      setValue('')
      onConfirm(trimmed)
    }
  }, [value, onConfirm])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md rounded-xl bg-[var(--editor-panel)] p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-[var(--editor-ink)] mb-3">{title}</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          className="flex flex-col gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder ?? '请输入链接'}
            className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-accent)]/20 transition"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setValue('')
                onCancel()
              }}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--editor-line)] text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] hover:opacity-90 transition disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
