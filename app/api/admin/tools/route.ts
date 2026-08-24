import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  createManagedTool,
  getManagedTools,
  parseManagedToolInput,
  reorderManagedTools,
  type ManagedToolInput,
} from '@/lib/managed-tools'
import {
  ensureAuthenticatedRequest,
  getRouteEnvWithDb,
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'

function isUniqueLinkError(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed: managed_tools\.link_url/i.test(error.message)
}

export async function GET(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    return jsonOk({ tools: await getManagedTools(route.db) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '获取工具失败', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    const body = await parseJsonBody<unknown>(req)
    const input = parseManagedToolInput(body) as ManagedToolInput
    const tool = await createManagedTool(route.db, input)
    revalidatePath('/')
    return jsonOk({ tool }, 201)
  } catch (error) {
    if (isUniqueLinkError(error)) return jsonError('这个工具链接已经存在', 409)
    const message = error instanceof Error ? error.message : '创建工具失败'
    const status = /不能为空|内容过长|链接|图标|格式/.test(message) ? 400 : 500
    return jsonError(message, status)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    const body = await parseJsonBody<{ ids?: unknown }>(req)
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return jsonError('缺少排序数据', 400)
    }
    const ids = body.ids.map(Number)
    if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return jsonError('排序数据无效', 400)
    }

    const currentTools = await getManagedTools(route.db)
    const currentIds = new Set(currentTools.map((tool) => tool.id))
    if (ids.length !== currentIds.size || ids.some((id) => !currentIds.has(id))) {
      return jsonError('排序数据与当前工具不一致，请刷新后重试', 409)
    }

    await reorderManagedTools(route.db, ids)
    revalidatePath('/')
    return jsonOk({ tools: await getManagedTools(route.db) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '调整顺序失败', 500)
  }
}
