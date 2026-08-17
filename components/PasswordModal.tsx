'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useToast } from './Toast'
import { generatePassword } from '@/lib/password'

interface PasswordModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  currentPassword: string | null
  articleUrl: string
  onSuccess: () => void
}

export function PasswordModal({
  isOpen,
  onClose,
  slug,
  currentPassword,
  articleUrl,
  onSuccess,
}: PasswordModalProps) {
  const [password, setPassword] = useState(currentPassword || '')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<'url' | 'password' | null>(null)
  const toast = useToast()

  const isEncrypted = !!currentPassword

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleToggleEncryption = async () => {
    setLoading(true)
    try {
      const newPassword = isEncrypted ? null : generatePassword()

      const response = await fetch(`/api/admin/posts/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })

      if (!response.ok) {
        throw new Error('密码设置失败')
      }

      if (newPassword) {
        setPassword(newPassword)
        toast.success('已启用密码保护')
      } else {
        setPassword('')
        toast.success('已取消密码保护')
        onClose()
      }

      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'url' | 'password') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('复制失败')
    }
  }

  const fullUrl = password
    ? `${articleUrl}?pwd=${encodeURIComponent(password)}`
    : articleUrl

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-[var(--editor-panel)] rounded-lg shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <h3 className="text-lg font-semibold text-[var(--editor-ink)]">
            密码保护
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--stone-gray)] hover:text-[var(--editor-ink)] transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          {isEncrypted ? (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--editor-muted)] mb-2">
                  访问密码
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={password}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-[var(--editor-line)] bg-[var(--editor-soft)] text-[var(--editor-ink)]"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(password, 'password')}
                    className="px-3 py-2 text-sm rounded-md border border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-colors"
                  >
                    {copied === 'password' ? '✓' : '复制'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--editor-muted)] mb-2">
                  分享链接（含密码）
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fullUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-xs rounded-md border border-[var(--editor-line)] bg-[var(--editor-soft)] text-[var(--editor-muted)] font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fullUrl, 'url')}
                    className="px-3 py-2 text-sm rounded-md border border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-colors"
                  >
                    {copied === 'url' ? '✓' : '复制'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--stone-gray)]">
                  链接中已包含密码，可直接访问
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleEncryption}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
              >
                {loading ? '处理中...' : '取消密码保护'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--editor-muted)]">
                启用密码保护后，文章将不会在首页、RSS 和搜索结果中显示，只能通过直接链接+密码访问。
              </p>
              <button
                type="button"
                onClick={handleToggleEncryption}
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-semibold bg-[var(--editor-accent)] text-white rounded-lg hover:brightness-105 transition-all disabled:opacity-50"
              >
                {loading ? '处理中...' : '启用密码保护'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
