'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { Modal } from '@/components/Modal'

interface StatusToggleProps {
  slug: string
  currentStatus: 'draft' | 'published'
}

export function StatusToggle({ slug, currentStatus }: StatusToggleProps) {
  const [status, setStatus] = useState(currentStatus)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const newStatus = status === 'draft' ? 'published' : 'draft'

  const handleToggle = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/admin/posts/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('状态更新失败')
      }

      setStatus(newStatus)
      toast.success(newStatus === 'published' ? '文章已发布' : '已改为草稿')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '状态更新失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={loading}
        className="text-xs text-[var(--editor-muted)] hover:text-[var(--editor-accent)] transition-colors disabled:opacity-50"
        title={status === 'draft' ? '发布文章' : '改为草稿'}
      >
        {loading ? '...' : status === 'draft' ? '发布' : '取消发布'}
      </button>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleToggle}
        title={newStatus === 'published' ? '发布文章' : '改为草稿'}
        description={newStatus === 'published' ? '确定要发布这篇文章吗？' : '确定要将这篇文章改为草稿吗？'}
        confirmText="确认"
        type="info"
      />
    </>
  )
}
