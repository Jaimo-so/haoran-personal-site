import { getSetting, setSetting } from '@/lib/db'
import {
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
  normalizeBaseUrl,
  resolveAiConfigSecret,
} from '@/lib/ai-provider-profiles'

const WECHAT_BRIDGE_SETTING_KEY = 'wechat_bridge_config'

interface StoredWechatBridgeConfig {
  enabled?: boolean
  base_url?: string
  token_encrypted?: string
  token_masked?: string
}

export interface WechatBridgePublicConfig {
  enabled: boolean
  base_url: string
  token_masked: string
  configured: boolean
}

export interface WechatBridgeConfig extends WechatBridgePublicConfig {
  token: string
}

export interface WechatBridgeAccount {
  id: string
  name: string
}

function parseStoredConfig(raw: string | null): StoredWechatBridgeConfig {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as StoredWechatBridgeConfig
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function buildPublicConfig(stored: StoredWechatBridgeConfig, token: string): WechatBridgePublicConfig {
  const baseUrl = normalizeBaseUrl(stored.base_url || '')
  const enabled = Boolean(stored.enabled)
  const hasToken = Boolean(token.trim() || stored.token_encrypted?.trim())

  return {
    enabled,
    base_url: baseUrl,
    token_masked: (stored.token_masked || '').trim(),
    configured: Boolean(baseUrl && hasToken),
  }
}

export async function getWechatBridgeConfig(
  db: D1Database,
  env?: Record<string, unknown>,
): Promise<WechatBridgeConfig> {
  const stored = parseStoredConfig(await getSetting(db, WECHAT_BRIDGE_SETTING_KEY))
  const secret = resolveAiConfigSecret(env)
  const token = stored.token_encrypted
    ? await decryptApiKey(stored.token_encrypted, secret)
    : ''

  return {
    ...buildPublicConfig(stored, token),
    token,
  }
}

export async function getWechatBridgePublicConfig(
  db: D1Database,
  env?: Record<string, unknown>,
): Promise<WechatBridgePublicConfig> {
  const config = await getWechatBridgeConfig(db, env)
  return {
    enabled: config.enabled,
    base_url: config.base_url,
    token_masked: config.token_masked,
    configured: config.configured,
  }
}

export async function saveWechatBridgeConfig(
  db: D1Database,
  env: Record<string, unknown> | undefined,
  input: {
    enabled?: boolean
    base_url?: string
    token?: string
  },
): Promise<WechatBridgePublicConfig> {
  const existing = parseStoredConfig(await getSetting(db, WECHAT_BRIDGE_SETTING_KEY))
  const secret = resolveAiConfigSecret(env)
  const normalizedBaseUrl =
    input.base_url !== undefined
      ? normalizeBaseUrl(input.base_url)
      : normalizeBaseUrl(existing.base_url || '')
  const nextToken = (input.token || '').trim()

  const stored: StoredWechatBridgeConfig = {
    enabled: input.enabled ?? Boolean(existing.enabled),
    base_url: normalizedBaseUrl,
    token_encrypted: existing.token_encrypted || '',
    token_masked: existing.token_masked || '',
  }

  if (nextToken) {
    stored.token_encrypted = await encryptApiKey(nextToken, secret)
    stored.token_masked = maskApiKey(nextToken)
  }

  await setSetting(db, WECHAT_BRIDGE_SETTING_KEY, JSON.stringify(stored))

  return buildPublicConfig(stored, nextToken || '')
}

export function assertWechatBridgeReady(config: WechatBridgeConfig): WechatBridgeConfig {
  if (!config.enabled) {
    throw new Error('WeChat bridge 未启用')
  }
  if (!config.base_url || !config.token) {
    throw new Error('WeChat bridge 未配置完成')
  }
  return config
}

function buildBridgeUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBaseUrl}${normalizedPath}`
}

function pickBridgeErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const data = payload as { error?: unknown; message?: unknown }
    if (typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim()
    }
    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim()
    }
  }

  return fallback
}

export async function fetchWechatBridgeJson<T>(
  config: Pick<WechatBridgeConfig, 'base_url' | 'token'>,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${config.token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')

  const response = await fetch(buildBridgeUrl(config.base_url, path), {
    ...init,
    headers,
    signal: init.signal ?? (typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(20000) : undefined),
  })

  const rawText = await response.text().catch(() => '')
  let payload: unknown = null

  if (rawText) {
    try {
      payload = JSON.parse(rawText)
    } catch {
      payload = rawText
    }
  }

  if (!response.ok) {
    const fallback = typeof payload === 'string' && payload.trim()
      ? payload.trim()
      : `Bridge request failed: HTTP ${response.status}`
    throw new Error(pickBridgeErrorMessage(payload, fallback))
  }

  return (payload ?? {}) as T
}
