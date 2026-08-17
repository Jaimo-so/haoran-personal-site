import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAppCloudflareEnv: vi.fn(),
  searchPostsWithStrategy: vi.fn(),
}))

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: mocks.getAppCloudflareEnv,
}))

vi.mock('@/lib/related-content', () => ({
  searchPostsWithStrategy: mocks.searchPostsWithStrategy,
}))

import { GET } from '@/app/api/search/route'

describe('/api/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty results when the query is blank', async () => {
    const response = await GET({
      nextUrl: new URL('http://test.local/api/search?q=%20%20'),
    } as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ results: [] })
    expect(mocks.searchPostsWithStrategy).not.toHaveBeenCalled()
  })

  it('returns empty results when the database is unavailable', async () => {
    mocks.getAppCloudflareEnv.mockResolvedValue({})

    const response = await GET({
      nextUrl: new URL('http://test.local/api/search?q=ask%20ai'),
    } as never)

    await expect(response.json()).resolves.toEqual({ results: [] })
  })

  it('maps related-content results into the public response shape', async () => {
    mocks.getAppCloudflareEnv.mockResolvedValue({ DB: { kind: 'db' } })
    mocks.searchPostsWithStrategy.mockResolvedValue({
      strategy: 'vector',
      source: 'vectorize',
      results: [
        {
          slug: 'ask-ai-markdown',
          title: 'Ask AI 与 Markdown',
          description: '一篇关于编辑器交互的文章',
          category: 'AI',
          published_at: 1710000000,
          password: 'secret',
          html: '<p>hidden</p>',
        },
      ],
    })

    const response = await GET({
      nextUrl: new URL('http://test.local/api/search?q=%20ask%20ai%20'),
    } as never)
    const body = await response.json()

    expect(mocks.searchPostsWithStrategy).toHaveBeenCalledWith(
      { kind: 'db' },
      { DB: { kind: 'db' } },
      'ask ai',
      { limit: 50 },
    )
    expect(body).toEqual({
      strategy: 'vector',
      source: 'vectorize',
      results: [
        {
          slug: 'ask-ai-markdown',
          title: 'Ask AI 与 Markdown',
          description: '一篇关于编辑器交互的文章',
          category: 'AI',
          published_at: 1710000000,
          password: true,
        },
      ],
    })
  })
})
