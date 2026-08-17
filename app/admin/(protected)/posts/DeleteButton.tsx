'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { Modal } from '@/components/Modal'

export function DeleteButton({ slug, title, status }: { slug: string; title: string; status: string }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPermanentModal, setShowPermanentModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const isDeleted = status === 'deleted'

  const handleSoftDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deleted' }),
      })
      if (res.ok) {
        toast.success('文章已删除（可恢复）')
        router.refresh()
      } else {
        toast.error('删除失败，请重试')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      })
      if (res.ok) {
        toast.success('文章已恢复为草稿')
        router.refresh()
      } else {
        toast.error('恢复失败，请重试')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handlePermanentDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${slug}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('文章已永久删除')
        router.refresh()
      } else {
        toast.error('删除失败，请重试')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (isDeleted) {
    return (
      <>
        <button
          type="button"
          onClick={handleRestore}
          disabled={loading}
          className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          {loading ? '恢复中...' : '恢复'}
        </button>
        <button
          type="button"
          onClick={() => setShowPermanentModal(true)}
          disabled={loading}
          className="text-xs text-rose-500 hover:text-rose-700 hover:underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          永久删除
        </button>

        <Modal
          isOpen={showPermanentModal}
          onClose={() => setShowPermanentModal(false)}
          onConfirm={handlePermanentDelete}
          title="永久删除"
          description={`确定要永久删除「${title}」吗？此操作不可恢复！`}
          confirmText="永久删除"
          type="danger"
        />
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDeleteModal(true)}
        disabled={loading}
        className="text-xs text-rose-500 hover:text-rose-700 hover:underline underline-offset-2 transition-colors disabled:opacity-50"
      >
        删除
      </button>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleSoftDelete}
        title="删除文章"
        description={`确定要删除「${title}」吗？删除后可以在已删除列表中恢复。`}
        confirmText="删除"
        type="warning"
      />
    </>
  )
}
