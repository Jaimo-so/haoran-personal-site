import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import {
  ensureAiPostGeneratorInfrastructure,
  generatePostCover,
  generatePostMetadata,
  type AiPostGeneratorTarget,
} from '@/lib/ai-post-generators'

type ImageBucket = {
  put: (
    key: string,
    value: File | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      httpMetadata?: {
        contentType?: string
        cacheControl?: string
      }
      customMetadata?: Record<string, string>
    }
  ) => Promise<void>
}

interface RequestBody {
  target?: AiPostGeneratorTarget
  title?: string
  content?: string
  category?: string
  description?: string
  tags?: string[]
  currentSlug?: string
}

function isValidTarget(value: unknown): value is AiPostGeneratorTarget {
  return typeof value === 'string' && ['summary', 'tags', 'slug', 'cover'].includes(value)
}

export async function POST(req: NextRequest) {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  const images = env?.IMAGES as ImageBucket | undefined

  if (!(await authenticateRequest(req, db))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!db) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 })
  }

  await ensureAiPostGeneratorInfrastructure(db, env)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '请求体不是有效 JSON' }, { status: 400 })
  }

  if (!isValidTarget(body.target)) {
    return NextResponse.json({ error: '缺少有效的 target 参数' }, { status: 400 })
  }

  const title = (body.title || '').trim()
  const content = (body.content || '').trim()
  const category = (body.category || '').trim()
  const description = (body.description || '').trim()
  const tags = Array.isArray(body.tags) ? body.tags : []
  const currentSlug = (body.currentSlug || '').trim()

  if (!title && !content) {
    return NextResponse.json({ error: '请先填写标题或正文' }, { status: 400 })
  }

  try {
    if (body.target === 'cover') {
      if (!images) {
        return NextResponse.json({ error: '图片存储未配置' }, { status: 500 })
      }

      const result = await generatePostCover({
        title,
        content,
        category,
        description,
        tags,
        db,
        images,
        env,
      })

      return NextResponse.json({
        success: true,
        target: body.target,
        image: result.image,
      })
    }

    const result = await generatePostMetadata({
      target: body.target,
      title,
      content,
      category,
      description,
      tags,
      currentSlug,
      db,
      env,
    })

    return NextResponse.json({
      success: true,
      target: body.target,
      value: result.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 生成失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
