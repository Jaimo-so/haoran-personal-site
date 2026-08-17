'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/Toast'
import { normalizeBaseUrl } from '@/lib/ai-provider-profiles'

interface BridgeConfig {
  enabled: boolean
  base_url: string
  token_masked: string
  configured: boolean
}

interface BridgeAccount {
  id: string
  name: string
}

const EMPTY_CONFIG: BridgeConfig = {
  enabled: false,
  base_url: '',
  token_masked: '',
  configured: false,
}

export function WeChatBridgeManager() {
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [refreshingAccounts, setRefreshingAccounts] = useState(false)

  const [config, setConfig] = useState<BridgeConfig>(EMPTY_CONFIG)
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [accounts, setAccounts] = useState<BridgeAccount[]>([])
  const [testMessage, setTestMessage] = useState('')

  const loadAccounts = async () => {
    setRefreshingAccounts(true)
    try {
      const res = await fetch('/api/admin/wechat-bridge/accounts')
      const data = await res.json().catch(() => ({})) as { accounts?: BridgeAccount[]; error?: string }
      if (!res.ok) throw new Error(data.error || '加载公众号账号失败')
      setAccounts(data.accounts || [])
    } catch (error) {
      setAccounts([])
      toast.error(error instanceof Error ? error.message : '加载公众号账号失败')
    } finally {
      setRefreshingAccounts(false)
    }
  }

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/wechat-bridge')
      const data = await res.json().catch(() => ({})) as { config?: BridgeConfig; error?: string }
      if (!res.ok) throw new Error(data.error || '加载 bridge 配置失败')

      const nextConfig = data.config || EMPTY_CONFIG
      setConfig(nextConfig)
      setBaseUrl(nextConfig.base_url || '')
      setToken('')

      if (nextConfig.enabled && nextConfig.configured) {
        await loadAccounts()
      } else {
        setAccounts([])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载 bridge 配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setTestMessage('')

    try {
      const payload = {
        enabled: config.enabled,
        base_url: normalizeBaseUrl(baseUrl),
        token: token.trim(),
      }

      const res = await fetch('/api/admin/wechat-bridge', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({})) as { config?: BridgeConfig; error?: string }
      if (!res.ok) throw new Error(data.error || '保存 bridge 配置失败')

      const nextConfig = data.config || EMPTY_CONFIG
      setConfig(nextConfig)
      setBaseUrl(nextConfig.base_url || '')
      setToken('')
      toast.success('Bridge 配置已保存')

      if (nextConfig.enabled && nextConfig.configured) {
        await loadAccounts()
      } else {
        setAccounts([])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存 bridge 配置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestMessage('')

    try {
      const res = await fetch('/api/admin/wechat-bridge/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: normalizeBaseUrl(baseUrl),
          token: token.trim(),
        }),
      })
      const data = await res.json().catch(() => ({})) as {
        success?: boolean
        accounts?: BridgeAccount[]
        error?: string
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bridge 连接测试失败')
      }

      const nextAccounts = data.accounts || []
      setAccounts(nextAccounts)
      setTestMessage(`连接成功，可用公众号 ${nextAccounts.length} 个`)
      toast.success('Bridge 连接正常')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bridge 连接测试失败'
      setTestMessage(message)
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5 text-sm text-[var(--editor-muted)]">
        正在加载 WeChat bridge 配置…
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-[var(--editor-ink)]">Bridge 连接</h3>
            <p className="text-sm text-[var(--editor-muted)]">
              `qmblog` 只保存 bridge 地址和鉴权 token。多个公众号的 `AppID/Secret` 全部保存在 VPS bridge 上。
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-[var(--editor-ink)]">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => setConfig(prev => ({ ...prev, enabled: event.target.checked }))}
              className="h-4 w-4 rounded border-[var(--editor-line)]"
            />
            启用 bridge
          </label>
        </div>

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
              Bridge Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://bridge.example.com"
              className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-[var(--stone-gray)]">
              Bridge Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={config.token_masked ? `已保存：${config.token_masked}；留空表示不修改` : '输入 bridge token'}
              className="w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)]"
            />
            <p className="text-xs text-[var(--editor-muted)]">
              这里不保存公众号密钥。后续新增公众号，只需要更新 VPS 上的 bridge 账号清单。
            </p>
          </div>
        </div>

        {testMessage && (
          <div className="mt-4 rounded-xl border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-muted)]">
            {testMessage}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-lg border border-[var(--editor-line)] px-3 py-2 text-sm text-[var(--editor-ink)] transition hover:bg-[var(--editor-soft)] disabled:opacity-50"
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[var(--editor-accent)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--editor-ink)]">可用公众号</h3>
            <p className="mt-1 text-sm text-[var(--editor-muted)]">
              这里展示 bridge 当前可切换的公众号账号列表。
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadAccounts()}
            disabled={refreshingAccounts || !config.enabled || !config.configured}
            className="rounded-lg border border-[var(--editor-line)] px-3 py-2 text-sm text-[var(--editor-ink)] transition hover:bg-[var(--editor-soft)] disabled:opacity-50"
          >
            {refreshingAccounts ? '刷新中…' : '刷新列表'}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--editor-line)] bg-[var(--background)]">
          {accounts.length > 0 ? (
            <ul className="divide-y divide-[var(--editor-line)]">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--editor-ink)]">{account.name}</div>
                    <div className="mt-1 text-xs text-[var(--editor-muted)]">{account.id}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-sm text-[var(--editor-muted)]">
              {config.enabled && config.configured
                ? 'Bridge 已连接，但还没有返回可用公众号账号。'
                : '先保存可用的 bridge 配置，再从 bridge 拉取公众号列表。'}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
