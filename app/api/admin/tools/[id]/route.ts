import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  deleteManagedTool,
  getManagedTool,
  parseManagedToolInput,
  updateManagedTool,
} from '@/lib/managed-tools'
import {
  ensureAuthenticatedRequest,
  getRouteEnvWithDb,
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'

function parseId(rawId: string) {
  const id = Number(rawId)
  return Number.isInteger(id) && id > 0 ? id : null
}

function isUniqueLinkError(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed: managed_tools\.link_url/i.test(error.message)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    const id = parseId((await params).id)
    if (!id) return jsonError('工具 ID 无效', 400)
    if (!(await getManagedTool(route.db, id))) return jsonError('工具不存在', 404)

    const body = await parseJsonBody<unknown>(req)
    const updates = parseManagedToolInput(body, true)
    if (Object.keys(updates).length === 0) return jsonError('没有可更新的字段', 400)

    const tool = await updateManagedTool(route.db, id, updates)
    if (!tool) return jsonError('工具不存在', 404)
    revalidatePath('/')
    return jsonOk({ tool })
  } catch (error) {
    if (isUniqueLinkError(error)) return jsonError('这个工具链接已经存在', 409)
    const message = error instanceof Error ? error.message : '更新工具失败'
    const status = /不能为空|内容过长|链接|图标|格式/.test(message) ? 400 : 500
    return jsonError(message, status)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    const id = parseId((await params).id)
    if (!id) return jsonError('工具 ID 无效', 400)
    if (!(await deleteManagedTool(route.db, id))) return jsonError('工具不存在', 404)

    revalidatePath('/')
    return jsonOk({ success: true })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '删除工具失败', 500)
  }
}
