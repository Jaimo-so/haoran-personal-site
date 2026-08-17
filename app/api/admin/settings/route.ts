import { getSetting, setSetting } from '@/lib/db'
import { isAdminAuthenticated, COOKIE_NAME } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return isAdminAuthenticated(token)
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth())) {
    return jsonError('Unauthorized', 401)
  }

  try {
    const key = req.nextUrl.searchParams.get('key')
    if (!key) {
      return jsonError('Missing key', 400)
    }

    const route = await getRouteEnvWithDb('No DB')
    if (!route.ok) return route.response

    const value = await getSetting(route.db, key)
    return jsonOk({ key, value })
  } catch (error) {
    console.error('Get setting error:', error)
    return jsonError(error instanceof Error ? error.message : '获取设置失败', 500)
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return jsonError('Unauthorized', 401)
  }

  try {
    const { key, value } = await parseJsonBody<{ key?: string; value?: unknown }>(req)
    if (!key || value === undefined) {
      return jsonError('Missing key or value', 400)
    }

    const route = await getRouteEnvWithDb('No DB')
    if (!route.ok) return route.response

    await setSetting(route.db, key, typeof value === 'string' ? value : JSON.stringify(value))
    return jsonOk({ success: true })
  } catch (error) {
    console.error('Set setting error:', error)
    return jsonError(error instanceof Error ? error.message : '保存设置失败', 500)
  }
}
