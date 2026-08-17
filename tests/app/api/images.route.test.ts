import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAppCloudflareEnv: vi.fn(),
}))

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: mocks.getAppCloudflareEnv,
}))

import { GET } from '@/app/api/images/[...key]/route'

const originalFetch = global.fetch

function createStoredObject(overrides?: Partial<{
  body: ReadableStream | null
  httpEtag: string
  size: number
}>) {
  return {
    body: overrides?.body ?? null,
    httpEtag: overrides?.httpEtag ?? 'etag-1',
    size: overrides?.size ?? 1024,
    writeHttpMetadata: (headers: Headers) => {
      headers.set('Content-Type', 'image/webp')
    },
  }
}

describe('/api/images/[...key] route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function createImageRequest(url: string, init?: RequestInit) {
    return new NextRequest(url, init)
  }

  it('returns 500 when image storage is not configured', async () => {
    mocks.getAppCloudflareEnv.mockResolvedValue({})

    const response = await GET(createImageRequest('http://test.local/api/images/image/a.webp') as never, {
      params: Promise.resolve({ key: ['image', 'a.webp'] }),
    })

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe('Image storage is not configured')
  })

  it('serves transformed images through the Cloudflare image pipeline when enabled', async () => {
    const head = vi.fn(async () => ({ size: 1024, httpMetadata: { contentType: 'image/webp' } }))
    const get = vi.fn(async () => createStoredObject())
    mocks.getAppCloudflareEnv.mockResolvedValue({
      IMAGES: { head, get },
      ENABLE_CF_IMAGE_PIPELINE: 'true',
    })

    const transformedResponse = new Response('transformed-body', {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
      },
    })
    global.fetch = vi.fn(async () => transformedResponse) as unknown as typeof fetch

    const response = await GET(createImageRequest('http://test.local/api/images/image/a.webp?w=800&format=webp') as never, {
      params: Promise.resolve({ key: ['image', 'a.webp'] }),
    })

    expect(head).toHaveBeenCalledWith('image/a.webp')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('__raw=1'),
      expect.objectContaining({
        cf: {
          image: {
            width: 800,
            format: 'webp',
          },
        },
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    await expect(response.text()).resolves.toBe('transformed-body')
  })

  it('returns partial content for range requests', async () => {
    const head = vi.fn(async () => ({ size: 4096, httpMetadata: { contentType: 'video/mp4' } }))
    const get = vi.fn(async () => createStoredObject({ size: 4096 }))
    mocks.getAppCloudflareEnv.mockResolvedValue({
      IMAGES: { head, get },
    })

    const response = await GET(createImageRequest('http://test.local/api/images/video/clip.mp4', {
      headers: { Range: 'bytes=0-1023' },
    }) as never, {
      params: Promise.resolve({ key: ['video', 'clip.mp4'] }),
    })

    expect(head).toHaveBeenCalledWith('video/clip.mp4')
    expect(get).toHaveBeenCalledWith('video/clip.mp4', {
      range: { offset: 0, length: 1024 },
    })
    expect(response.status).toBe(206)
    expect(response.headers.get('Content-Range')).toBe('bytes 0-1023/4096')
    expect(response.headers.get('Content-Length')).toBe('1024')
  })

  it('returns the full object with cache headers for ordinary requests', async () => {
    const object = createStoredObject({ size: 2048, httpEtag: 'etag-full' })
    const get = vi.fn(async () => object)
    mocks.getAppCloudflareEnv.mockResolvedValue({
      IMAGES: { get, head: vi.fn() },
    })

    const response = await GET(createImageRequest('http://test.local/api/images/image/full.webp') as never, {
      params: Promise.resolve({ key: ['image', 'full.webp'] }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('etag-full')
    expect(response.headers.get('Content-Length')).toBe('2048')
    expect(response.headers.get('Accept-Ranges')).toBe('bytes')
  })
})
