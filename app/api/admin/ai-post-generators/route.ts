import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import {
  WORKERS_AI_IMAGE_MODEL_SUGGESTIONS,
  WORKERS_AI_TEXT_MODEL_SUGGESTIONS,
  ensureAiPostGeneratorInfrastructure,
  getAiPostGeneratorByTarget,
  listAiPostGenerators,
  type AiPostGeneratorProviderMode,
  type AiPostGeneratorTarget,
} from '@/lib/ai-post-generators'
import { normalizeAiImageAspectRatio, normalizeAiImageResolution } from '@/lib/ai-image-options'
import { clampMaxTokens, clampTemperature } from '@/lib/ai-provider-profiles'

interface UpdateGeneratorBody {
  target_key?: AiPostGeneratorTarget
  prompt?: string
  provider_mode?: AiPostGeneratorProviderMode
  text_profile_id?: number | null
  image_profile_id?: number | null
  workers_model?: string
  temperature?: number
  max_tokens?: number
  aspect_ratio?: string
  resolution?: string
  is_enabled?: boolean | number
}

function normalizeTarget(value: unknown): AiPostGeneratorTarget | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return ['summary', 'tags', 'slug', 'cover'].includes(normalized)
    ? normalized as AiPostGeneratorTarget
    : null
}

function normalizeProviderMode(value: unknown): AiPostGeneratorProviderMode {
  return value === 'profile' ? 'profile' : 'workers_ai'
}

export async function GET(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })
  }

  const generators = await listAiPostGenerators(db, env)
  return NextResponse.json({
    generators,
    workers_ai: {
      text_models: WORKERS_AI_TEXT_MODEL_SUGGESTIONS,
      image_models: WORKERS_AI_IMAGE_MODEL_SUGGESTIONS,
    },
  })
}

export async function PUT(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })
  }

  await ensureAiPostGeneratorInfrastructure(db, env)

  let body: UpdateGeneratorBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体不是有效 JSON' }, { status: 400 })
  }

  const target = normalizeTarget(body.target_key)
  if (!target) {
    return NextResponse.json({ error: '缺少有效的 target_key' }, { status: 400 })
  }

  const current = await getAiPostGeneratorByTarget(db, target, env)
  if (!current) {
    return NextResponse.json({ error: '生成器配置不存在' }, { status: 404 })
  }

  const providerMode = normalizeProviderMode(body.provider_mode ?? current.provider_mode)
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : current.prompt
  const workersModel = typeof body.workers_model === 'string'
    ? body.workers_model.trim()
    : current.workers_model
  const textProfileId = body.text_profile_id === null
    ? null
    : Number.isFinite(body.text_profile_id)
      ? Number(body.text_profile_id)
      : current.text_profile_id
  const imageProfileId = body.image_profile_id === null
    ? null
    : Number.isFinite(body.image_profile_id)
      ? Number(body.image_profile_id)
      : current.image_profile_id
  const temperature = clampTemperature(
    body.temperature === undefined ? current.temperature : Number(body.temperature),
  )
  const maxTokens = clampMaxTokens(
    body.max_tokens === undefined ? current.max_tokens : Number(body.max_tokens),
  )
  const aspectRatio = normalizeAiImageAspectRatio(body.aspect_ratio || current.aspect_ratio)
  const resolution = normalizeAiImageResolution(body.resolution || current.resolution)
  const isEnabled = body.is_enabled === undefined
    ? current.is_enabled
    : (body.is_enabled === true || Number(body.is_enabled) === 1 ? 1 : 0)

  if (!prompt) {
    return NextResponse.json({ error: '提示词不能为空' }, { status: 400 })
  }

  if (providerMode === 'workers_ai' && !workersModel) {
    return NextResponse.json({ error: 'Workers AI 模型不能为空' }, { status: 400 })
  }

  if (target === 'cover') {
    await db.prepare(`
      UPDATE ai_post_generators
      SET prompt = ?,
          provider_mode = ?,
          image_profile_id = ?,
          workers_model = ?,
          aspect_ratio = ?,
          resolution = ?,
          is_enabled = ?,
          updated_at = strftime('%s', 'now')
      WHERE target_key = ?
    `).bind(
      prompt,
      providerMode,
      providerMode === 'profile' ? imageProfileId : imageProfileId,
      workersModel,
      aspectRatio,
      resolution,
      isEnabled,
      target,
    ).run()
  } else {
    await db.prepare(`
      UPDATE ai_post_generators
      SET prompt = ?,
          provider_mode = ?,
          text_profile_id = ?,
          workers_model = ?,
          temperature = ?,
          max_tokens = ?,
          is_enabled = ?,
          updated_at = strftime('%s', 'now')
      WHERE target_key = ?
    `).bind(
      prompt,
      providerMode,
      providerMode === 'profile' ? textProfileId : textProfileId,
      workersModel,
      temperature,
      maxTokens,
      isEnabled,
      target,
    ).run()
  }

  const generator = await getAiPostGeneratorByTarget(db, target, env)
  return NextResponse.json({ success: true, generator })
}
