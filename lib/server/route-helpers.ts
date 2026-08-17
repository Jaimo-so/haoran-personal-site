import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/admin-auth'
import { getAppCloudflareContext, getAppCloudflareEnv } from '@/lib/cloudflare'

export type RouteDbEnv = Partial<CloudflareEnv> & { DB: D1Database }

type RouteEnvWithDbResult =
  | {
      ok: true
      env: RouteDbEnv
      db: D1Database
    }
  | {
      ok: false
      response: NextResponse
    }

type RouteContextWithDbResult =
  | {
      ok: true
      env: RouteDbEnv
      db: D1Database
      ctx: Awaited<ReturnType<typeof getAppCloudflareContext>>['ctx']
    }
  | {
      ok: false
      response: NextResponse
    }

export function jsonOk<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status })
}

export function jsonError(error: string, status = 500) {
  return NextResponse.json({ error }, { status })
}

export async function parseJsonBody<T>(
  req: NextRequest,
  invalidMessage = '请求体不是有效 JSON',
): Promise<T> {
  try {
    return await req.json() as T
  } catch {
    throw new Error(invalidMessage)
  }
}

export async function getRouteEnvWithDb(missingDbMessage = 'DB unavailable'): Promise<RouteEnvWithDbResult> {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined

  if (!db) {
    return {
      ok: false,
      response: jsonError(missingDbMessage, 500),
    }
  }

  return {
    ok: true,
    env: env as RouteDbEnv,
    db,
  }
}

export async function getRouteContextWithDb(
  missingDbMessage = 'DB unavailable',
): Promise<RouteContextWithDbResult> {
  const cf = await getAppCloudflareContext()
  const db = cf.env?.DB as D1Database | undefined

  if (!db) {
    return {
      ok: false,
      response: jsonError(missingDbMessage, 500),
    }
  }

  return {
    ok: true,
    env: cf.env as RouteDbEnv,
    db,
    ctx: cf.ctx,
  }
}

export async function ensureAuthenticatedRequest(
  req: NextRequest,
  db?: D1Database,
  unauthorizedMessage = 'Unauthorized',
) {
  if (!(await authenticateRequest(req, db))) {
    return jsonError(unauthorizedMessage, 401)
  }
  return null
}
