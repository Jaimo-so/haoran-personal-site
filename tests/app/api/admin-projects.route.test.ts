import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getManagedProjects: vi.fn(), getManagedProject: vi.fn(), createManagedProject: vi.fn(),
  updateManagedProject: vi.fn(), deleteManagedProject: vi.fn(), reorderManagedProjects: vi.fn(),
  authenticateRequest: vi.fn(), getAppCloudflareEnv: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('@/lib/managed-projects', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/managed-projects')>(),
  getManagedProjects: mocks.getManagedProjects, getManagedProject: mocks.getManagedProject,
  createManagedProject: mocks.createManagedProject, updateManagedProject: mocks.updateManagedProject,
  deleteManagedProject: mocks.deleteManagedProject, reorderManagedProjects: mocks.reorderManagedProjects,
}))
vi.mock('@/lib/admin-auth', () => ({ authenticateRequest: mocks.authenticateRequest }))
vi.mock('@/lib/cloudflare', () => ({ getAppCloudflareEnv: mocks.getAppCloudflareEnv }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
import { GET, POST, PUT } from '@/app/api/admin/projects/route'
import { PATCH, DELETE } from '@/app/api/admin/projects/[id]/route'

const context = (id = '1') => ({ params: Promise.resolve({ id }) })
const request = (method: string, payload?: unknown) => new NextRequest('http://localhost/api/admin/projects', {
  method, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
})
const project = { id: 1, name: 'AI 产品拆解', description: '', link_url: '', is_visible: 1, sort_order: 10 }

describe('admin project endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppCloudflareEnv.mockResolvedValue({ DB: {} })
    mocks.authenticateRequest.mockResolvedValue(true)
    mocks.getManagedProjects.mockResolvedValue([project, { ...project, id: 2 }])
    mocks.getManagedProject.mockResolvedValue(project)
    mocks.createManagedProject.mockResolvedValue(project)
    mocks.updateManagedProject.mockResolvedValue({ ...project, is_visible: 0 })
    mocks.deleteManagedProject.mockResolvedValue(true)
  })

  it('requires authentication for every operation', async () => {
    mocks.authenticateRequest.mockResolvedValue(false)
    const responses = await Promise.all([
      GET(request('GET')), POST(request('POST', { name: '项目' })), PUT(request('PUT', { ids: [2, 1] })),
      PATCH(request('PATCH', { is_visible: 0 }), context()), DELETE(request('DELETE'), context()),
    ])
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401])
    for (const fn of [mocks.getManagedProjects, mocks.getManagedProject, mocks.createManagedProject, mocks.updateManagedProject, mocks.deleteManagedProject, mocks.reorderManagedProjects]) expect(fn).not.toHaveBeenCalled()
  })

  it('lists projects including hidden ones for the admin', async () => {
    mocks.getManagedProjects.mockResolvedValue([{ ...project, is_visible: 0 }])
    expect(await (await GET(request('GET'))).json()).toEqual({ projects: [{ ...project, is_visible: 0 }] })
  })

  it('creates a project without requiring a link and invalidates the homepage', async () => {
    const response = await POST(request('POST', { name: ' AI 产品拆解 ' }))
    expect(response.status).toBe(201)
    expect(mocks.createManagedProject).toHaveBeenCalledWith({}, { name: 'AI 产品拆解', description: '', link_url: '', github_url: '', is_visible: 1 })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/projects')
  })

  it.each(['POST', 'PUT', 'PATCH'])('returns 400 for malformed JSON in %s', async (method) => {
    const req = new NextRequest('http://localhost/api/admin/projects', { method, body: '{broken' })
    const response = method === 'POST' ? await POST(req) : method === 'PUT' ? await PUT(req) : await PATCH(req, context())
    expect(response.status).toBe(400)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects unsafe links before writing', async () => {
    expect((await PATCH(request('PATCH', { link_url: 'javascript:alert(1)' }), context())).status).toBe(400)
    expect(mocks.updateManagedProject).not.toHaveBeenCalled()
  })

  it('updates visibility independently', async () => {
    expect((await PATCH(request('PATCH', { is_visible: 0 }), context())).status).toBe(200)
    expect(mocks.updateManagedProject).toHaveBeenCalledWith({}, 1, { is_visible: 0 })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })

  it('updates the repository link independently and invalidates the homepage', async () => {
    expect((await PATCH(request('PATCH', { github_url: 'https://github.com/Jaimo-so/demo' }), context())).status).toBe(200)
    expect(mocks.updateManagedProject).toHaveBeenCalledWith({}, 1, { github_url: 'https://github.com/Jaimo-so/demo' })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })

  it.each([{}, [], null])('rejects empty or invalid patches %#', async (payload) => {
    expect((await PATCH(request('PATCH', payload), context())).status).toBe(400)
    expect(mocks.updateManagedProject).not.toHaveBeenCalled()
  })

  it.each([{ ids: [1, 1] }, { ids: ['1', '2'] }, { ids: [1, -1] }, { ids: [1, 1.5] }, { ids: [] }, null])('rejects invalid order payload %#', async (payload) => {
    expect((await PUT(request('PUT', payload))).status).toBe(400)
    expect(mocks.reorderManagedProjects).not.toHaveBeenCalled()
  })

  it.each([{ ids: [1] }, { ids: [1, 3] }])('rejects stale ordering data %j', async ({ ids }) => {
    expect((await PUT(request('PUT', { ids }))).status).toBe(409)
    expect(mocks.reorderManagedProjects).not.toHaveBeenCalled()
  })

  it('persists a complete reordered list', async () => {
    expect((await PUT(request('PUT', { ids: [2, 1] }))).status).toBe(200)
    expect(mocks.reorderManagedProjects).toHaveBeenCalledWith({}, [2, 1])
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })

  it('returns 404 for missing projects', async () => {
    mocks.getManagedProject.mockResolvedValue(null)
    mocks.deleteManagedProject.mockResolvedValue(false)
    expect((await PATCH(request('PATCH', { name: '新名称' }), context())).status).toBe(404)
    expect((await DELETE(request('DELETE'), context())).status).toBe(404)
  })

  it('deletes a project and invalidates the homepage', async () => {
    expect((await DELETE(request('DELETE'), context())).status).toBe(200)
    expect(mocks.deleteManagedProject).toHaveBeenCalledWith({}, 1)
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
  })

  it.each(['abc', '-1', '1.5', '9007199254740992'])('rejects invalid project id %s', async (id) => {
    expect((await DELETE(request('DELETE'), context(id))).status).toBe(400)
    expect(mocks.deleteManagedProject).not.toHaveBeenCalled()
  })

  it('reports storage failure without claiming a successful save', async () => {
    mocks.createManagedProject.mockRejectedValue(new Error('database unavailable'))
    expect((await POST(request('POST', { name: '项目' }))).status).toBe(500)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
