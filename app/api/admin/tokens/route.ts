import { NextRequest, NextResponse } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { isAdminAuthenticated, COOKIE_NAME, generateApiToken } from '@/lib/admin-auth'

// 确保 api_tokens 表存在
async function ensureTokensTable(db: D1Database) {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        last_used_at INTEGER,
        is_active INTEGER DEFAULT 1
      )
    `).run()
  } catch { /* table already exists */ }
}

// Token 管理只允许 Cookie 认证（后台管理操作）
async function requireCookieAuth(req: NextRequest): Promise<boolean> {
  const cookieValue = req.cookies.get(COOKIE_NAME)?.value
  return await isAdminAuthenticated(cookieValue)
}

// GET: 列出所有 Token（不返回完整 token，只返回前缀）
export async function GET(req: NextRequest) {
  if (!(await requireCookieAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = await getAppCloudflareEnv()
  if (!env?.DB) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 500 })
  }

  await ensureTokensTable(env.DB)

  const { results } = await env.DB
    .prepare(`SELECT id, name, created_at, last_used_at, is_active,
              substr(token, 1, 10) || '...' as token_preview
              FROM api_tokens ORDER BY created_at DESC`)
    .all()

  return NextResponse.json({ tokens: results })
}

// POST: 创建新 Token
export async function POST(req: NextRequest) {
  if (!(await requireCookieAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = await getAppCloudflareEnv()
  if (!env?.DB) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 500 })
  }

  await ensureTokensTable(env.DB)

  const { name } = (await req.json()) as { name?: string }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: '请输入 Token 名称' }, { status: 400 })
  }

  const token = generateApiToken()

  await env.DB
    .prepare('INSERT INTO api_tokens (token, name) VALUES (?, ?)')
    .bind(token, name.trim())
    .run()

  // 创建时返回完整 token（仅此一次）
  return NextResponse.json({ success: true, token, name: name.trim() })
}

// DELETE: 删除 Token
export async function DELETE(req: NextRequest) {
  if (!(await requireCookieAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const env = await getAppCloudflareEnv()
  if (!env?.DB) {
    return NextResponse.json({ error: '数据库未配置' }, { status: 500 })
  }

  const { id } = (await req.json()) as { id?: number | string }
  if (!id) {
    return NextResponse.json({ error: '缺少 Token ID' }, { status: 400 })
  }

  await env.DB
    .prepare('DELETE FROM api_tokens WHERE id = ?')
    .bind(id)
    .run()

  return NextResponse.json({ success: true })
}
