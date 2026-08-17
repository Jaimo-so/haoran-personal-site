import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import {
  ensureAiImageConfigInfrastructure,
  ensureDefaultImageProfileId,
} from '@/lib/ai-image-config'
import {
  deriveLegacyQualityFromResolution,
  deriveLegacySizeFromAspectRatio,
  inferAspectRatioFromLegacySize,
  inferResolutionFromLegacyQuality,
  normalizeAiImageAspectRatio,
  normalizeAiImageResolution,
} from '@/lib/ai-image-options'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  await ensureAiImageConfigInfrastructure(db)

  const { id } = await params
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
    is_enabled?: number
  }
  const numericId = Number(id)
  const current = await db.prepare(`
    SELECT id, aspect_ratio, resolution, size, quality
    FROM ai_image_actions
    WHERE id = ?
    LIMIT 1
  `).bind(numericId).first<{
    id: number
    aspect_ratio: string
    resolution: string
    size: string
    quality: string
  }>()

  if (!current?.id) {
    return NextResponse.json({ error: '操作不存在' }, { status: 404 })
  }

  const sets: string[] = []
  const values: Array<string | number | null> = []

  if (body.action_key !== undefined) {
    sets.push('action_key = ?')
    values.push(body.action_key)
  }
  if (body.label !== undefined) {
    sets.push('label = ?')
    values.push(body.label)
  }
  if (body.description !== undefined) {
    sets.push('description = ?')
    values.push(body.description)
  }
  if (body.prompt !== undefined) {
    sets.push('prompt = ?')
    values.push(body.prompt)
  }
  if (
    body.aspect_ratio !== undefined ||
    body.resolution !== undefined ||
    body.size !== undefined ||
    body.quality !== undefined
  ) {
    const nextAspectRatio = normalizeAiImageAspectRatio(
      body.aspect_ratio
        || (body.size !== undefined ? inferAspectRatioFromLegacySize(body.size) : current.aspect_ratio),
    )
    const nextResolution = normalizeAiImageResolution(
      body.resolution
        || (body.quality !== undefined ? inferResolutionFromLegacyQuality(body.quality) : current.resolution),
    )

    sets.push('aspect_ratio = ?')
    values.push(nextAspectRatio)
    sets.push('resolution = ?')
    values.push(nextResolution)
    sets.push('size = ?')
    values.push(deriveLegacySizeFromAspectRatio(nextAspectRatio, body.size || current.size))
    sets.push('quality = ?')
    values.push(deriveLegacyQualityFromResolution(nextResolution, body.quality || current.quality))
  }
  if (body.profile_id !== undefined) {
    if (Number.isFinite(body.profile_id) && Number(body.profile_id) > 0) {
      sets.push('profile_id = ?')
      values.push(Number(body.profile_id))
    } else {
      const defaultProfileId = await ensureDefaultImageProfileId(db)
      sets.push('profile_id = ?')
      values.push(defaultProfileId ?? null)
    }
  }
  if (body.is_enabled !== undefined) {
    sets.push('is_enabled = ?')
    values.push(body.is_enabled)
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: '没有可更新的字段' }, { status: 400 })
  }

  sets.push("updated_at = strftime('%s', 'now')")
  values.push(numericId)

  try {
    await db.prepare(`
      UPDATE ai_image_actions
      SET ${sets.join(', ')}
      WHERE id = ?
    `).bind(...values).run()
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: ai_image_actions\\.action_key/i.test(error.message)) {
      return NextResponse.json({ error: '操作标识已存在' }, { status: 409 })
    }
    throw error
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })

  await ensureAiImageConfigInfrastructure(db)

  const { id } = await params
  const row = await db.prepare('SELECT id FROM ai_image_actions WHERE id = ?')
    .bind(Number(id))
    .first<{ id: number }>()

  if (!row?.id) {
    return NextResponse.json({ error: '操作不存在' }, { status: 404 })
  }

  await db.prepare('DELETE FROM ai_image_actions WHERE id = ?').bind(Number(id)).run()
  return NextResponse.json({ success: true })
}
