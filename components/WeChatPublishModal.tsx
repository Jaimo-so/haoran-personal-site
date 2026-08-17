'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '@/components/Toast'
import {
  buildWechatBridgeArticleExport,
  buildWechatBridgeCoverImageUrl,
  extractFirstWechatBridgeCoverImageUrl,
} from '@/lib/wechat-copy'
import {
  WECHAT_DEFAULT_AUTHOR,
  WECHAT_DEFAULT_NEED_OPEN_COMMENT,
  WECHAT_DEFAULT_ONLY_FANS_CAN_COMMENT,
} from '@/lib/wechat-publish-defaults'

interface BridgeAccount {
  id: string
  name: string
}

interface WeChatPublishModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  html: string
  defaultDigest?: string
  defaultSourceUrl?: string
  defaultCoverImageUrl?: string
}

export function WeChatPublishModal({
  isOpen,
  onClose,
  title,
  html,
  defaultDigest = '',
  defaultSourceUrl = '',
  defaultCoverImageUrl = '',
}: WeChatPublishModalProps) {
  const toast = useToast()

  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<BridgeAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [author, setAuthor] = useState(WECHAT_DEFAULT_AUTHOR)
  const [digest, setDigest] = useState(defaultDigest)
  const [sourceUrl, setSourceUrl] = useState(defaultSourceUrl)
  const [coverImageUrl, setCoverImageUrl] = useState(defaultCoverImageUrl)
  const [publishNow, setPublishNow] = useState(false)
  const [needOpenComment, setNeedOpenComment] = useState(WECHAT_DEFAULT_NEED_OPEN_COMMENT)
  const [onlyFansCanComment, setOnlyFansCanComment] = useState(WECHAT_DEFAULT_ONLY_FANS_CAN_COMMENT)
  const [loadError, setLoadError] = useState('')

  const loadAccounts = async () => {
    setLoadingAccounts(true)
    setLoadError('')

    try {
      const res = await fetch('/api/admin/wechat-bridge/accounts')
      const data = await res.json().catch(() => ({})) as { accounts?: BridgeAccount[]; error?: string }
      if (!res.ok) throw new Error(data.error || '加载公众号账号失败')

      const nextAccounts = data.accounts || []
      setAccounts(nextAccounts)
      setSelectedAccountId((current) => {
        if (current && nextAccounts.some(account => account.id === current)) {
          return current
        }
        return nextAccounts[0]?.id || ''
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载公众号账号失败'
      setAccounts([])
      setSelectedAccountId('')
      setLoadError(message)
    } finally {
      setLoadingAccounts(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return

    setAuthor(WECHAT_DEFAULT_AUTHOR)
    setDigest(defaultDigest)
    setSourceUrl(defaultSourceUrl)
    setCoverImageUrl(defaultCoverImageUrl)
    setPublishNow(false)
    setNeedOpenComment(WECHAT_DEFAULT_NEED_OPEN_COMMENT)
    setOnlyFansCanComment(WECHAT_DEFAULT_ONLY_FANS_CAN_COMMENT)
    void loadAccounts()
  }, [isOpen, defaultDigest, defaultSourceUrl, defaultCoverImageUrl])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!selectedAccountId) {
      toast.error('请先选择公众号账号')
      return
    }

    setSubmitting(true)

    try {
      const { normalizedTitle, exportedHtml } = buildWechatBridgeArticleExport(title, html)
      const finalCoverUrl =
        buildWechatBridgeCoverImageUrl(coverImageUrl) ||
        buildWechatBridgeCoverImageUrl(defaultCoverImageUrl) ||
        extractFirstWechatBridgeCoverImageUrl(exportedHtml)

      const res = await fetch('/api/admin/wechat-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: selectedAccountId,
          title: normalizedTitle,
          content_html: exportedHtml,
          author: author.trim(),
          digest: digest.trim(),
          content_source_url: sourceUrl.trim(),
          cover_image_url: finalCoverUrl,
          publish_now: publishNow,
          need_open_comment: needOpenComment,
          only_fans_can_comment: needOpenComment && onlyFansCanComment,
        }),
      })

      const data = await res.json().catch(() => ({})) as {
        error?: string
        media_id?: string
        publish_id?: string
      }
      if (!res.ok) throw new Error(data.error || '提交公众号发布失败')

      toast.success(publishNow ? '公众号发布任务已提交' : '公众号草稿已创建')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '提交公众号发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose()
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--editor-line)] px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--editor-ink)]">发布到公众号</h3>
            <p className="mt-1 text-sm text-[var(--editor-muted)]">
              文章会先提交到 bridge，再由 bridge 选择目标公众号创建草稿或直接发布。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1 text-[var(--editor-muted)] transition hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
                公众号账号
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  disabled={loadingAccounts || accounts.length === 0}
                  className="flex-1 rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
                >
                  {accounts.length === 0 && <option value="">暂无可用账号</option>}
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {account.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void loadAccounts()}
                  disabled={loadingAccounts}
                  className="rounded-lg border border-[var(--editor-line)] px-3 py-2 text-sm text-[var(--editor-ink)] transition hover:bg-[var(--editor-soft)] disabled:opacity-50"
                >
                  {loadingAccounts ? '刷新中…' : '刷新'}
                </button>
              </div>
              {loadError && <p className="text-xs text-rose-600">{loadError}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
                作者
              </label>
              <input
                type="text"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder={WECHAT_DEFAULT_AUTHOR}
                className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
                原文链接
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="选填"
                className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
                摘要
              </label>
              <textarea
                value={digest}
                onChange={(event) => setDigest(event.target.value)}
                rows={3}
                placeholder="默认使用文章描述，选填"
                className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
                封面图 URL
              </label>
              <input
                type="url"
                value={coverImageUrl}
                onChange={(event) => setCoverImageUrl(event.target.value)}
                placeholder="留空时会自动使用默认封面"
                className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
              />
              <p className="text-xs text-[var(--editor-muted)]">
                同域 `/api/images/...` 链接会自动转换成适合微信封面上传的 JPG 版本；留空时会自动使用默认封面。
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-4 py-3">
            <label className="flex items-center gap-2 text-sm text-[var(--editor-ink)]">
              <input
                type="checkbox"
                checked={publishNow}
                onChange={(event) => setPublishNow(event.target.checked)}
                className="h-4 w-4 rounded border-[var(--editor-line)]"
              />
              创建草稿后立即提交发布
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--editor-ink)]">
              <input
                type="checkbox"
                checked={needOpenComment}
                onChange={(event) => {
                  setNeedOpenComment(event.target.checked)
                  if (!event.target.checked) setOnlyFansCanComment(false)
                }}
                className="h-4 w-4 rounded border-[var(--editor-line)]"
              />
              开启评论
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--editor-ink)]">
              <input
                type="checkbox"
                checked={onlyFansCanComment}
                onChange={(event) => setOnlyFansCanComment(event.target.checked)}
                disabled={!needOpenComment}
                className="h-4 w-4 rounded border-[var(--editor-line)]"
              />
              仅粉丝可评论
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--editor-line)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-[var(--editor-line)] px-3 py-2 text-sm text-[var(--editor-ink)] transition hover:bg-[var(--editor-soft)] disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || loadingAccounts || accounts.length === 0}
            className="rounded-lg bg-[var(--editor-accent)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {submitting ? '提交中…' : publishNow ? '提交发布' : '创建草稿'}
          </button>
        </div>
      </div>
    </div>
  )
}
