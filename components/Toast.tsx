'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X } from 'lucide-react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'], duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const toast: Toast = { id, message, type, duration }

    setToasts(prev => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const value: ToastContextValue = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const accentColor = {
    success: 'var(--editor-accent)',
    error: '#c65b5b',
    warning: '#b8873a',
    info: 'var(--stone-gray)',
  }[toast.type]

  return (
    <div
      className="pointer-events-auto flex min-w-[220px] max-w-sm items-start gap-3 rounded-xl border px-3.5 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur-md animate-in slide-in-from-right-full duration-300"
      style={{
        background: 'color-mix(in srgb, var(--editor-panel) 94%, transparent)',
        borderColor: 'var(--editor-line)',
        color: 'var(--editor-ink)',
      }}
    >
      <span
        className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full"
        style={{ background: accentColor }}
        aria-hidden="true"
      />
      <p className="flex-1 text-sm leading-6">{toast.message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 rounded p-0.5 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
        aria-label="关闭"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
