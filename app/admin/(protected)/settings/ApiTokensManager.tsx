'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/Toast'

interface Token {
  id: number
  name: string
  token_preview: string
  created_at: number
  last_used_at: number | null
  is_active: number
}

interface TokensResponse {
  tokens: Token[]
}

interface CreateTokenResponse {
  token: string
}

export function ApiTokensManager() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const toast = useToast()

  const loadTokens = async () => {
    try {
      const res = await fetch('/api/admin/tokens')
      if (res.ok) {
        const data = (await res.json()) as TokensResponse
        setTokens(data.tokens)
      }
    } catch {}
  }

  useEffect(() => { loadTokens() }, [])

  const createToken = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error('创建失败')
      const data = (await res.json()) as CreateTokenResponse
      setNewToken(data.token)
      setNewName('')
      toast.success('Token 已创建')
      loadTokens()
    } catch {
      toast.error('创建 Token 失败')
    } finally {
      setCreating(false)
    }
  }

  const deleteToken = async (id: number, name: string) => {
    if (!confirm(`确定删除 Token "${name}"？`)) return
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('删除失败')
      toast.success('Token 已删除')
      loadTokens()
    } catch {
      toast.error('删除失败')
    }
  }

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const formatDate = (ts: number | null) => {
    if (!ts) return '从未'
    return new Date(ts * 1000).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--editor-muted)]">
        API Token 用于 Obsidian 插件、Chrome 插件、Claude Skill 等外部工具调用博客接口。
      </p>

      {/* 新 Token 提示（只显示一次） */}
      {newToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-medium text-amber-800">
            Token 已创建！请立即复制保存，此后不再显示完整 Token。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-[var(--background)] border border-amber-200 rounded px-3 py-2 break-all font-mono text-[var(--editor-ink)]">
              {newToken}
            </code>
            <button
              onClick={() => copyToken(newToken)}
              className="shrink-0 px-3 py-2 text-sm bg-[var(--editor-accent)] text-white rounded-lg hover:brightness-105"
            >
              复制
            </button>
          </div>
          <button
            onClick={() => setNewToken(null)}
            className="text-xs text-amber-600 hover:underline"
          >
            我已保存，关闭此提示
          </button>
        </div>
      )}

      {/* 创建新 Token */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createToken()}
          placeholder="Token 用途，如 Obsidian插件"
          className="flex-1 px-3 py-2 text-sm border border-[var(--editor-line)] rounded-lg bg-[var(--background)] text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)]
                     focus:outline-none focus:border-[var(--editor-accent)]"
        />
        <button
          onClick={createToken}
          disabled={creating || !newName.trim()}
          className="px-4 py-2 text-sm bg-[var(--editor-accent)] text-white rounded-lg font-medium
                     hover:brightness-105 disabled:opacity-50"
        >
            {creating ? '创建中...' : '生成 Token'}
          </button>
        </div>

      {/* Token 列表 */}
      {tokens.length === 0 ? (
        <p className="text-sm text-[var(--stone-gray)] text-center py-8">
          暂无 API Token
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-3 bg-[var(--editor-panel)] border border-[var(--editor-line)] rounded-lg"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--editor-ink)]">
                    {t.name}
                  </span>
                  <code className="text-xs text-[var(--stone-gray)] font-mono">
                    {t.token_preview}
                  </code>
                </div>
                <div className="text-xs text-[var(--stone-gray)] mt-0.5">
                  创建于 {formatDate(t.created_at)} · 最后使用 {formatDate(t.last_used_at)}
                </div>
              </div>
              <button
                onClick={() => deleteToken(t.id, t.name)}
                className="text-xs text-rose-500 hover:text-rose-700 shrink-0 ml-4"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
