import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  deleteManagedProject,
  getManagedProject,
  parseManagedProjectInput,
  ProjectValidationError,
  updateManagedProject,
} from '@/lib/managed-projects'
import {
  ensureAuthenticatedRequest,
  getRouteEnvWithDb,
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'

function parseId(rawId: string) {
  const id = Number(rawId)
  return Number.isSafeInteger(id) && id > 0 ? id : null
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
    if (!id) return jsonError('项目 ID 无效', 400)
    if (!(await getManagedProject(route.db, id))) return jsonError('项目不存在', 404)

    const body = await parseJsonBody<unknown>(req)
    const updates = parseManagedProjectInput(body, true)
    if (Object.keys(updates).length === 0) return jsonError('没有可更新的字段', 400)

    const project = await updateManagedProject(route.db, id, updates)
    if (!project) return jsonError('项目不存在', 404)
    revalidatePath('/')
    revalidatePath('/admin/projects')
    return jsonOk({ project })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新项目失败'
    const status = error instanceof ProjectValidationError || /有效 JSON/.test(message) ? 400 : 500
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
    if (!id) return jsonError('项目 ID 无效', 400)
    if (!(await deleteManagedProject(route.db, id))) return jsonError('项目不存在', 404)

    revalidatePath('/')
    revalidatePath('/admin/projects')
    return jsonOk({ success: true })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '删除项目失败', 500)
  }
}
