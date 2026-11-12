import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { DEFAULT_PERSONAL_CONTENT } from '@/lib/personal-content'

const mocks = vi.hoisted(() => ({
  getPersonalContent: vi.fn(),
  savePersonalContent: vi.fn(),
  authenticateRequest: vi.fn(),
  getAppCloudflareEnv: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/personal-content', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/personal-content')>(),
  getPersonalContent: mocks.getPersonalContent,
  savePersonalContent: mocks.savePersonalContent,
}))
vi.mock('@/lib/admin-auth', () => ({ authenticateRequest: mocks.authenticateRequest }))
vi.mock('@/lib/cloudflare', () => ({ getAppCloudflareEnv: mocks.getAppCloudflareEnv }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))

import { GET, PUT } from '@/app/api/admin/content/route'

function request(method: string, payload?: unknown) {
  return new NextRequest('http://localhost/api/admin/content', {
    method,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  })
}

describe('admin content endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppCloudflareEnv.mockResolvedValue({ DB: {} })
    mocks.authenticateRequest.mockResolvedValue(true)
    mocks.getPersonalContent.mockResolvedValue(DEFAULT_PERSONAL_CONTENT)
    mocks.savePersonalContent.mockResolvedValue(undefined)
  })

  it('requires authentication before reading or writing content', async () => {
    mocks.authenticateRequest.mockResolvedValue(false)
    expect((await GET(request('GET'))).status).toBe(401)
    expect((await PUT(request('PUT', DEFAULT_PERSONAL_CONTENT))).status).toBe(401)
    expect(mocks.getPersonalContent).not.toHaveBeenCalled()
    expect(mocks.savePersonalContent).not.toHaveBeenCalled()
  })

  it('returns the complete content model to the admin', async () => {
    expect(await (await GET(request('GET'))).json()).toEqual({ content: DEFAULT_PERSONAL_CONTENT })
  })

  it('saves validated content and refreshes both public pages', async () => {
    const input = structuredClone(DEFAULT_PERSONAL_CONTENT)
    input.hero.headline = ' 新标题 '
    const response = await PUT(request('PUT', input))
    expect(response.status).toBe(200)
    expect(mocks.savePersonalContent).toHaveBeenCalledWith({}, {
      ...DEFAULT_PERSONAL_CONTENT,
      hero: { ...DEFAULT_PERSONAL_CONTENT.hero, headline: '新标题' },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/about')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/content')
  })

  it('rejects malformed or incomplete content without writing', async () => {
    const malformed = new NextRequest('http://localhost/api/admin/content', { method: 'PUT', body: '{broken' })
    expect((await PUT(malformed)).status).toBe(400)
    expect((await PUT(request('PUT', { hero: {} }))).status).toBe(400)
    expect(mocks.savePersonalContent).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('does not claim success when storage fails', async () => {
    mocks.savePersonalContent.mockRejectedValue(new Error('database unavailable'))
    expect((await PUT(request('PUT', DEFAULT_PERSONAL_CONTENT))).status).toBe(500)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
