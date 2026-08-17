import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getAppCloudflareEnv: vi.fn(),
  ensureAiPostGeneratorInfrastructure: vi.fn(),
  generatePostMetadata: vi.fn(),
  generatePostCover: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({
  authenticateRequest: mocks.authenticateRequest,
}))

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: mocks.getAppCloudflareEnv,
}))

vi.mock('@/lib/ai-post-generators', () => ({
  ensureAiPostGeneratorInfrastructure: mocks.ensureAiPostGeneratorInfrastructure,
  generatePostMetadata: mocks.generatePostMetadata,
  generatePostCover: mocks.generatePostCover,
}))

import { POST } from '@/app/api/editor/ai-post-metadata/route'

describe('/api/editor/ai-post-metadata route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppCloudflareEnv.mockResolvedValue({
      DB: { kind: 'db' },
      IMAGES: { put: vi.fn() },
    })
    mocks.authenticateRequest.mockResolvedValue(true)
    mocks.ensureAiPostGeneratorInfrastructure.mockResolvedValue(undefined)
  })

  it('returns 401 when the request is not authenticated', async () => {
    mocks.authenticateRequest.mockResolvedValue(false)

    const response = await POST(new Request('http://test.local/api/editor/ai-post-metadata', {
      method: 'POST',
      body: JSON.stringify({ target: 'summary', title: '标题' }),
      headers: { 'Content-Type': 'application/json' },
    }) as never)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('passes trimmed metadata input to the text generator and returns the generated value', async () => {
    mocks.generatePostMetadata.mockResolvedValue({
      target: 'summary',
      value: '生成后的摘要',
    })

    const response = await POST(new Request('http://test.local/api/editor/ai-post-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'summary',
        title: '  Ask AI 标题  ',
        content: '  正文内容  ',
        category: '  AI  ',
        description: '  摘要  ',
        tags: ['标签1', '标签2'],
        currentSlug: '  current-slug  ',
      }),
    }) as never)
    const body = await response.json()

    expect(mocks.generatePostMetadata).toHaveBeenCalledWith({
      target: 'summary',
      title: 'Ask AI 标题',
      content: '正文内容',
      category: 'AI',
      description: '摘要',
      tags: ['标签1', '标签2'],
      currentSlug: 'current-slug',
      db: { kind: 'db' },
      env: {
        DB: { kind: 'db' },
        IMAGES: expect.any(Object),
      },
    })
    expect(body).toEqual({
      success: true,
      target: 'summary',
      value: '生成后的摘要',
    })
  })

  it('returns 500 for cover generation when image storage is unavailable', async () => {
    mocks.getAppCloudflareEnv.mockResolvedValue({
      DB: { kind: 'db' },
    })

    const response = await POST(new Request('http://test.local/api/editor/ai-post-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'cover',
        title: 'Ask AI 封面',
      }),
    }) as never)

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: '图片存储未配置' })
  })
})
