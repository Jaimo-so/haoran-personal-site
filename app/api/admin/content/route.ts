import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'
import {
  getPersonalContent,
  parsePersonalContentInput,
  PersonalContentValidationError,
  savePersonalContent,
} from '@/lib/personal-content'
import {
  ensureAuthenticatedRequest,
  getRouteEnvWithDb,
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'

export async function GET(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError
    return jsonOk({ content: await getPersonalContent(route.db) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '获取站点文案失败', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    const content = parsePersonalContentInput(await parseJsonBody<unknown>(req))
    await savePersonalContent(route.db, content)
    revalidatePath('/')
    revalidatePath('/about')
    revalidatePath('/admin/content')
    return jsonOk({ content })
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存站点文案失败'
    const status = error instanceof PersonalContentValidationError || /有效 JSON/.test(message) ? 400 : 500
    return jsonError(message, status)
  }
}
