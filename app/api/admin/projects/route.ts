import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  createManagedProject,
  getManagedProjects,
  parseManagedProjectInput,
  ProjectValidationError,
  reorderManagedProjects,
  type ManagedProjectInput,
} from '@/lib/managed-projects'
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

    return jsonOk({ projects: await getManagedProjects(route.db) })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '获取项目失败', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库不可用')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db, '未授权')
    if (authError) return authError

    const body = await parseJsonBody<unknown>(req)
    const input = parseManagedProjectInput(body) as ManagedProjectInput
    const project = await createManagedProject(route.db, input)
    revalidatePath('/')
    revalidatePath('/admin/projects')
    return jsonOk({ project }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建项目失败'
    const status = error instanceof ProjectValidationError || /有效 JSON/.test(message) ? 400 : 500
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
    if (!body || typeof body !== 'object' || !Array.isArray(body.ids) || body.ids.length === 0) {
      return jsonError('缺少排序数据', 400)
    }
    const ids = body.ids as number[]
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      return jsonError('排序数据无效', 400)
    }

    const currentProjects = await getManagedProjects(route.db)
    const currentIds = new Set(currentProjects.map((project) => project.id))
    if (ids.length !== currentIds.size || ids.some((id) => !currentIds.has(id))) {
      return jsonError('排序数据与当前项目不一致，请刷新后重试', 409)
    }

    await reorderManagedProjects(route.db, ids)
    revalidatePath('/')
    revalidatePath('/admin/projects')
    return jsonOk({ projects: await getManagedProjects(route.db) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '调整顺序失败'
    return jsonError(message, /有效 JSON/.test(message) ? 400 : 500)
  }
}
