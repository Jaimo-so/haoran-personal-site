export interface AIProviderProfileRow {
  id: number
  name: string
  provider: string
  provider_name: string
  provider_type: string
  provider_category: string
  api_key_url: string
  base_url: string
  model: string
  temperature: number
  max_tokens: number
  api_key_masked: string
  is_default: number
  created_at: number
  updated_at: number
}

const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 2000
const ENCRYPTION_PREFIX = 'enc:v1'
const DEFAULT_PROFILE_NAME = '默认配置'

interface DefaultActionSeed {
  action_key: string
  label: string
  description: string
  prompt: string
  temperature: number
  sort_order: number
}

const DEFAULT_ACTIONS: DefaultActionSeed[] = [
  {
    action_key: 'improve',
    label: '润色',
    description: '让表达更顺更自然',
    prompt: '你是专业的中文写作助手。对下面的文字进行润色，让表达更顺畅自然，保持原意、语气和信息密度不变，直接返回润色后的文字，不要解释。',
    temperature: 0.6,
    sort_order: 10,
  },
  {
    action_key: 'shorten',
    label: '缩写',
    description: '压缩成更短版本',
    prompt: '你是专业的中文写作助手。在不丢失核心意思的前提下，把下面的文字压缩得更简短精炼，直接返回结果，不要解释。',
    temperature: 0.6,
    sort_order: 20,
  },
  {
    action_key: 'expand',
    label: '扩写',
    description: '补充为更完整表述',
    prompt: '你是专业的中文写作助手。对下面的文字进行扩写，让表达更完整自然，保持原有风格和语气，直接返回结果，不要解释。',
    temperature: 0.6,
    sort_order: 30,
  },
  {
    action_key: 'summarize',
    label: '总结',
    description: '提炼为清晰摘要',
    prompt: '你是专业的中文写作助手。把下面的文字总结为简洁清晰的摘要，直接返回结果，不要解释。',
    temperature: 0.6,
    sort_order: 40,
  },
  {
    action_key: 'translate_zh',
    label: '译成中文',
    description: '翻成简体中文',
    prompt: '你是专业翻译。把下面的内容翻译成简体中文，保持原文风格，直接返回翻译结果，不要解释。',
    temperature: 0.2,
    sort_order: 50,
  },
  {
    action_key: 'translate_en',
    label: '译成英文',
    description: '翻成自然英文',
    prompt: '你是专业翻译。把下面的内容翻译成自然流畅的英文，保持原文风格，直接返回翻译结果，不要解释。',
    temperature: 0.2,
    sort_order: 60,
  },
]

const keyCache = new Map<string, Promise<CryptoKey>>()

function toBase64(bytes: Uint8Array): string {
  const BufferCtor = (globalThis as unknown as {
    Buffer?: {
      from: (input: Uint8Array | string, encoding?: string) => { toString: (encoding?: string) => string }
    }
  }).Buffer

  if (BufferCtor) {
    return BufferCtor.from(bytes).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(input: string): Uint8Array {
  const BufferCtor = (globalThis as unknown as {
    Buffer?: {
      from: (input: Uint8Array | string, encoding?: string) => Uint8Array
    }
  }).Buffer

  if (BufferCtor) {
    return new Uint8Array(BufferCtor.from(input, 'base64'))
  }
  const binary = atob(input)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const normalized = secret.trim() || 'qmblog-ai-config'
  const cached = keyCache.get(normalized)
  if (cached) return cached

  const promise = (async () => {
    const encoded = new TextEncoder().encode(normalized)
    const digest = await crypto.subtle.digest('SHA-256', encoded)
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  })()

  keyCache.set(normalized, promise)
  return promise
}

export function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, '')
}

export function isWorkersAiBaseUrl(input: string): boolean {
  const normalized = normalizeBaseUrl(input || '')
  return /api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/ai(?:\/|$)/i.test(normalized)
}

export function buildWorkersAiRunUrl(baseUrl: string, model: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  const apiRoot = /\/ai\/v1$/i.test(normalized)
    ? normalized.replace(/\/ai\/v1$/i, '/ai')
    : normalized
  return `${apiRoot}/run/${model.trim()}`
}

export function clampTemperature(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TEMPERATURE
  return Math.max(0, Math.min(2, Number(value)))
}

export function clampMaxTokens(value: number): number {
  if (!Number.isFinite(value) || Number(value) <= 0) return DEFAULT_MAX_TOKENS
  return Math.max(1, Math.min(32768, Math.floor(Number(value))))
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`
}

export function resolveAiConfigSecret(env?: Record<string, unknown>): string {
  const envSecret = typeof env?.AI_CONFIG_ENCRYPTION_SECRET === 'string'
    ? env.AI_CONFIG_ENCRYPTION_SECRET
    : ''
  const envSalt = typeof env?.ADMIN_TOKEN_SALT === 'string'
    ? env.ADMIN_TOKEN_SALT
    : ''

  return (
    envSecret ||
    process.env.AI_CONFIG_ENCRYPTION_SECRET ||
    envSalt ||
    process.env.ADMIN_TOKEN_SALT ||
    'qmblog-ai-config-secret'
  )
}

export async function encryptApiKey(apiKey: string, secret: string): Promise<string> {
  const normalized = apiKey.trim()
  if (!normalized) return ''

  const key = await deriveAesKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const payload = new TextEncoder().encode(normalized)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload)
  const cipherBytes = new Uint8Array(encrypted)

  return `${ENCRYPTION_PREFIX}:${toBase64(iv)}:${toBase64(cipherBytes)}`
}

export async function decryptApiKey(value: string, secret: string): Promise<string> {
  const normalized = (value || '').trim()
  if (!normalized) return ''

  if (!normalized.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalized
  }

  const parts = normalized.split(':')
  if (parts.length !== 4) return ''

  try {
    const key = await deriveAesKey(secret)
    const iv = new Uint8Array(fromBase64(parts[2]))
    const cipherBytes = new Uint8Array(fromBase64(parts[3]))
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return ''
  }
}

export async function ensureAiProviderProfilesTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_provider_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'custom',
      provider_name TEXT NOT NULL DEFAULT '',
      provider_type TEXT NOT NULL DEFAULT 'openai_compatible',
      provider_category TEXT NOT NULL DEFAULT '',
      api_key_url TEXT NOT NULL DEFAULT '',
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 0.7,
      max_tokens INTEGER NOT NULL DEFAULT 2000,
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      api_key_masked TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `).run()
}

async function ensureAiActionsTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_key TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      temperature REAL DEFAULT 0.6,
      sort_order INTEGER DEFAULT 0,
      is_enabled INTEGER DEFAULT 1,
      is_builtin INTEGER DEFAULT 1,
      profile_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `).run()

  const tableInfo = await db.prepare('PRAGMA table_info(ai_actions)').all<{ name: string }>()
  const hasProfileId = (tableInfo.results || []).some(col => col.name === 'profile_id')
  if (!hasProfileId) {
    await db.prepare('ALTER TABLE ai_actions ADD COLUMN profile_id INTEGER').run()
  }

  const countRow = await db.prepare('SELECT COUNT(*) as count FROM ai_actions').first<{ count: number }>()
  if ((countRow?.count ?? 0) > 0) return

  for (const seed of DEFAULT_ACTIONS) {
    await db.prepare(
      'INSERT INTO ai_actions (action_key, label, description, prompt, temperature, sort_order, is_builtin) VALUES (?, ?, ?, ?, ?, ?, 1)'
    ).bind(
      seed.action_key,
      seed.label,
      seed.description,
      seed.prompt,
      seed.temperature,
      seed.sort_order,
    ).run()
  }
}

export async function ensureDefaultProfileId(db: D1Database): Promise<number | null> {
  const defaultRow = await db.prepare('SELECT id FROM ai_provider_profiles WHERE is_default = 1 ORDER BY id ASC LIMIT 1').first<{ id: number }>()
  if (defaultRow?.id) return defaultRow.id

  const firstRow = await db.prepare('SELECT id FROM ai_provider_profiles ORDER BY id ASC LIMIT 1').first<{ id: number }>()
  if (!firstRow?.id) return null

  await db.prepare('UPDATE ai_provider_profiles SET is_default = 0').run()
  await db.prepare("UPDATE ai_provider_profiles SET is_default = 1, updated_at = strftime('%s', 'now') WHERE id = ?")
    .bind(firstRow.id)
    .run()

  return firstRow.id
}

async function migrateLegacyConfigIfNeeded(db: D1Database, secret: string): Promise<void> {
  const profileCount = await db.prepare('SELECT COUNT(*) as count FROM ai_provider_profiles').first<{ count: number }>()
  if ((profileCount?.count ?? 0) > 0) return

  const [cfgRow, keyRow] = await Promise.all([
    db.prepare("SELECT value FROM site_settings WHERE key = 'ai_provider_config'").first<{ value: string }>(),
    db.prepare("SELECT value FROM site_settings WHERE key = 'ai_provider_api_key'").first<{ value: string }>(),
  ])

  if (!cfgRow?.value) return

  let cfg: {
    provider?: string
    provider_name?: string
    provider_type?: string
    provider_category?: string
    api_key_url?: string
    base_url?: string
    model?: string
    temperature?: number
    max_tokens?: number
    api_key_masked?: string
  } | null = null

  try {
    cfg = JSON.parse(cfgRow.value)
  } catch {
    cfg = null
  }

  if (!cfg?.base_url || !cfg?.model) return

  const rawKey = (keyRow?.value || '').trim()
  const encryptedKey = rawKey ? await encryptApiKey(rawKey, secret) : ''
  const masked = rawKey ? maskApiKey(rawKey) : (cfg.api_key_masked || '')

  await db.prepare(`
    INSERT INTO ai_provider_profiles (
      name, provider, provider_name, provider_type, provider_category, api_key_url,
      base_url, model, temperature, max_tokens,
      api_key_encrypted, api_key_masked, is_default, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, strftime('%s', 'now'), strftime('%s', 'now'))
  `).bind(
    DEFAULT_PROFILE_NAME,
    cfg.provider || 'custom',
    cfg.provider_name || '',
    cfg.provider_type || 'openai_compatible',
    cfg.provider_category || '',
    cfg.api_key_url || '',
    normalizeBaseUrl(cfg.base_url),
    cfg.model,
    clampTemperature(Number(cfg.temperature)),
    clampMaxTokens(Number(cfg.max_tokens)),
    encryptedKey,
    masked,
  ).run()
}

export async function ensureAiConfigInfrastructure(db: D1Database, secret: string): Promise<void> {
  await ensureAiProviderProfilesTable(db)
  await ensureAiActionsTable(db)
  await migrateLegacyConfigIfNeeded(db, secret)

  const defaultProfileId = await ensureDefaultProfileId(db)
  if (defaultProfileId) {
    await db.prepare('UPDATE ai_actions SET profile_id = ? WHERE profile_id IS NULL').bind(defaultProfileId).run()
  }
}

export async function resolveAiProfileConfig(
  db: D1Database,
  secret: string,
  profileId?: number,
): Promise<{
  id: number
  name: string
  provider: string
  provider_name: string
  provider_type: string
  provider_category: string
  api_key_url: string
  base_url: string
  model: string
  temperature: number
  max_tokens: number
  api_key: string
  api_key_masked: string
  is_default: number
} | null> {
  await ensureAiConfigInfrastructure(db, secret)

  const selected = Number.isFinite(profileId) && Number(profileId) > 0
    ? await db.prepare(`
        SELECT *
        FROM ai_provider_profiles
        WHERE id = ?
        LIMIT 1
      `).bind(Number(profileId)).first<AIProviderProfileRow & { api_key_encrypted: string }>()
    : await db.prepare(`
        SELECT *
        FROM ai_provider_profiles
        ORDER BY is_default DESC, id ASC
        LIMIT 1
      `).first<AIProviderProfileRow & { api_key_encrypted: string }>()

  if (!selected?.base_url || !selected.model) return null

  const apiKey = await decryptApiKey(selected.api_key_encrypted || '', secret)
  if (!apiKey) return null

  return {
    id: selected.id,
    name: selected.name,
    provider: selected.provider,
    provider_name: selected.provider_name,
    provider_type: selected.provider_type,
    provider_category: selected.provider_category,
    api_key_url: selected.api_key_url,
    base_url: normalizeBaseUrl(selected.base_url),
    model: selected.model,
    temperature: clampTemperature(Number(selected.temperature)),
    max_tokens: clampMaxTokens(Number(selected.max_tokens)),
    api_key: apiKey,
    api_key_masked: selected.api_key_masked,
    is_default: selected.is_default,
  }
}

export function mapProfileRow(row: AIProviderProfileRow): AIProviderProfileRow {
  return {
    ...row,
    temperature: clampTemperature(Number(row.temperature)),
    max_tokens: clampMaxTokens(Number(row.max_tokens)),
  }
}
