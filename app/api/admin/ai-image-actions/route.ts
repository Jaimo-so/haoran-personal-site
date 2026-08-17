import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import {
  ensureAiImageConfigInfrastructure,
  ensureDefaultImageProfileId,
  type AIImageActionRow,
} from '@/lib/ai-image-config'
import {
  deriveLegacyQualityFromResolution,
  deriveLegacySizeFromAspectRatio,
  inferAspectRatioFromLegacySize,
  inferResolutionFromLegacyQuality,
  normalizeAiImageAspectRatio,
  normalizeAiImageResolution,
} from '@/lib/ai-image-options'

export async function GET(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  await ensureAiImageConfigInfrastructure(db)

  const { results } = await db.prepare(`
    SELECT id, action_key, label, description, prompt, aspect_ratio, resolution, size, quality, profile_id, sort_order, is_enabled, is_builtin,
           created_at, updated_at
    FROM ai_image_actions
    ORDER BY sort_order ASC
  `).all<AIImageActionRow>()

  return NextResponse.json({ actions: results })
}

export async function POST(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  await ensureAiImageConfigInfrastructure(db)

  const body = (await req.json()) as {
    action_key?: string
    label?: string
    description?: string
    prompt?: string
    aspect_ratio?: string
    resolution?: string
    size?: string
    quality?: string
    profile_id?: number
    sort_order?: number
  }

  if (!body.action_key || !body.label || !body.description || !body.prompt) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const defaultProfileId = await ensureDefaultImageProfileId(db)
  const profileId = Number.isFinite(body.profile_id) && Number(body.profile_id) > 0
    ? Number(body.profile_id)
    : defaultProfileId
  const aspectRatio = normalizeAiImageAspectRatio(body.aspect_ratio || inferAspectRatioFromLegacySize(body.size))
  const resolution = normalizeAiImageResolution(body.resolution || inferResolutionFromLegacyQuality(body.quality))
  const size = deriveLegacySizeFromAspectRatio(aspectRatio, body.size)
  const quality = deriveLegacyQualityFromResolution(resolution, body.quality)

  const maxRow = await db.prepare('SELECT MAX(sort_order) as max_sort FROM ai_image_actions').first<{ max_sort: number | null }>()
  const sortOrder = body.sort_order ?? ((maxRow?.max_sort ?? 0) + 10)

  try {
    await db.prepare(`
      INSERT INTO ai_image_actions (
        action_key, label, description, prompt, aspect_ratio, resolution, size, quality, profile_id, sort_order, is_builtin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(
      body.action_key,
      body.label,
      body.description,
      body.prompt,
      aspectRatio,
      resolution,
      size,
      quality,
      profileId ?? null,
      sortOrder,
    ).run()
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: ai_image_actions\\.action_key/i.test(error.message)) {
      return NextResponse.json({ error: '操作标识已存在' }, { status: 409 })
    }
    throw error
  }

  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  await ensureAiImageConfigInfrastructure(db)

  const body = (await req.json()) as { items: Array<{ id: number; sort_order: number }> }
  if (!body.items?.length) {
    return NextResponse.json({ error: '缺少排序数据' }, { status: 400 })
  }

  for (const item of body.items) {
    await db.prepare(`
      UPDATE ai_image_actions
      SET sort_order = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `).bind(item.sort_order, item.id).run()
  }

  return NextResponse.json({ success: true })
}
