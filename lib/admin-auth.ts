// 管理后台鉴权工具
// 密码存储在服务端，不暴露给客户端

import { nanoid } from 'nanoid'
import { NextRequest } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'

interface AdminAuthConfig {
  password: string
  salt: string
}

async function getAdminAuthConfig(): Promise<AdminAuthConfig> {
  let envPassword = ''
  let envSalt = ''

  try {
    const env = await getAppCloudflareEnv()
    envPassword = env?.ADMIN_PASSWORD?.trim() || ''
    envSalt = env?.ADMIN_TOKEN_SALT?.trim() || ''
  } catch {}

  return {
    password: envPassword || process.env.ADMIN_PASSWORD?.trim() || '',
    salt: envSalt || process.env.ADMIN_TOKEN_SALT?.trim() || '',
  }
}

export async function getAdminAuthConfigError(): Promise<string | null> {
  const { password, salt } = await getAdminAuthConfig()
  const missing: string[] = []

  if (!password) missing.push('ADMIN_PASSWORD')
  if (!salt) missing.push('ADMIN_TOKEN_SALT')

  if (missing.length === 0) return null
  return `管理员鉴权未配置完成：缺少 ${missing.join('、')}`
}

export async function isAdminAuthConfigured(): Promise<boolean> {
  return (await getAdminAuthConfigError()) === null
}

export const COOKIE_NAME = 'qmblog_admin'
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 天

/**
 * 生成会话 token（SHA-256 of password+salt）
 * 同一实例永远返回相同值，可安全用于 cookie 比对
 */
export async function getSessionToken(): Promise<string> {
  const { password, salt } = await getAdminAuthConfig()
  if (!password || !salt) return ''

  const encoder = new TextEncoder()
  const data = encoder.encode(`${password}:${salt}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** 校验密码是否正确 */
export async function verifyPassword(password: string): Promise<boolean> {
  const config = await getAdminAuthConfig()
  return Boolean(config.password) && password === config.password
}

/** 从请求 cookie 中校验 admin 会话 */
export async function isAdminAuthenticated(
  cookieValue: string | undefined
): Promise<boolean> {
  if (!cookieValue) return false
  const expected = await getSessionToken()
  return Boolean(expected) && cookieValue === expected
}

// ── API Token 认证 ──

/** 生成 API Token（qm_ 前缀 + 32 位 nanoid） */
export function generateApiToken(): string {
  return `qm_${nanoid(32)}`
}

interface ApiTokenRow {
  id: number
  is_active: number
}

/** 验证 API Token（查询数据库，更新 last_used_at） */
export async function verifyApiToken(db: D1Database, token: string): Promise<boolean> {
  if (!token || !token.startsWith('qm_')) return false
  try {
    const row = await db
      .prepare('SELECT id, is_active FROM api_tokens WHERE token = ?')
      .bind(token)
      .first<ApiTokenRow>()
    if (!row || !row.is_active) return false
    // 异步更新 last_used_at，不阻塞认证
    db.prepare("UPDATE api_tokens SET last_used_at = strftime('%s', 'now') WHERE id = ?")
      .bind(row.id)
      .run()
      .catch(() => {})
    return true
  } catch {
    return false
  }
}

/**
 * 统一认证：Cookie OR Bearer Token
 * 优先检查 Bearer Token，降级到 Cookie
 */
export async function authenticateRequest(
  req: NextRequest,
  db?: D1Database
): Promise<boolean> {
  // 1. 先检查 Bearer Token
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ') && db) {
    const token = authHeader.slice(7)
    return await verifyApiToken(db, token)
  }
  // 2. 降级到 Cookie
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value
  return await isAdminAuthenticated(cookieValue)
}
