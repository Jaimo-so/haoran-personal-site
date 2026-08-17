import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  ensureAuthenticatedRequest: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getCategories: mocks.getCategories,
  createCategory: mocks.createCategory,
  updateCategory: mocks.updateCategory,
  deleteCategory: mocks.deleteCategory,
}))

vi.mock('@/lib/server/route-helpers', () => ({
  ensureAuthenticatedRequest: mocks.ensureAuthenticatedRequest,
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

import { DELETE, GET, POST } from '@/app/api/admin/categories/route'

describe('/api/admin/categories route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: {},
    })
    mocks.ensureAuthenticatedRequest.mockResolvedValue(null)
  })

  it('returns the category list after auth succeeds', async () => {
    mocks.getCategories.mockResolvedValue([
      { slug: 'ai', name: 'AI' },
      { slug: 'product', name: 'Product' },
    ])

    const response = await GET({} as never)
    const body = await response.json()

    expect(mocks.getCategories).toHaveBeenCalledWith({ kind: 'db' })
    expect(body).toEqual({
      categories: [
        { slug: 'ai', name: 'AI' },
        { slug: 'product', name: 'Product' },
      ],
    })
  })

  it('validates required fields before creating a category', async () => {
    mocks.parseJsonBody.mockResolvedValue({ name: 'AI' })

    const response = await POST({} as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '名称和slug不能为空' })
    expect(mocks.createCategory).not.toHaveBeenCalled()
  })

  it('returns the auth error response for delete requests', async () => {
    mocks.ensureAuthenticatedRequest.mockResolvedValue(Response.json({ error: '未授权' }, { status: 401 }))

    const response = await DELETE({} as never)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: '未授权' })
    expect(mocks.deleteCategory).not.toHaveBeenCalled()
  })
})
