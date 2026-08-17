import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureAuthenticatedRequest: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
  getWechatBridgeConfig: vi.fn(),
  assertWechatBridgeReady: vi.fn(),
  fetchWechatBridgeJson: vi.fn(),
}))

vi.mock('@/lib/server/route-helpers', () => ({
  ensureAuthenticatedRequest: mocks.ensureAuthenticatedRequest,
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

vi.mock('@/lib/wechat-bridge-config', () => ({
  getWechatBridgeConfig: mocks.getWechatBridgeConfig,
  assertWechatBridgeReady: mocks.assertWechatBridgeReady,
  fetchWechatBridgeJson: mocks.fetchWechatBridgeJson,
}))

import { POST } from '@/app/api/admin/wechat-publish/route'

describe('/api/admin/wechat-publish route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: { kind: 'env' },
    })
    mocks.ensureAuthenticatedRequest.mockResolvedValue(null)
    mocks.getWechatBridgeConfig.mockResolvedValue({
      enabled: true,
      base_url: 'http://bridge.test:8788',
      token: 'bridge-token',
    })
    mocks.assertWechatBridgeReady.mockImplementation((config) => config)
  })

  it('rejects missing account_id', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      title: 'Test title',
      content_html: '<p>Hello</p>',
    })

    const response = await POST({} as never)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请选择公众号账号' })
    expect(mocks.fetchWechatBridgeJson).not.toHaveBeenCalled()
  })

  it('forwards publish payload to bridge', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      account_id: 'main',
      title: '  Test title  ',
      content_html: ' <p>Hello</p> ',
      author: '  Joe  ',
      digest: '  Summary  ',
      content_source_url: ' https://example.com/post ',
      cover_image_url: ' https://example.com/cover.jpg ',
      publish_now: true,
      need_open_comment: true,
      only_fans_can_comment: false,
    })
    mocks.fetchWechatBridgeJson.mockResolvedValue({
      success: true,
      media_id: 'MEDIA_ID',
      publish_id: 'PUBLISH_ID',
    })

    const response = await POST({} as never)
    const body = await response.json()

    expect(mocks.fetchWechatBridgeJson).toHaveBeenCalledWith(
      {
        enabled: true,
        base_url: 'http://bridge.test:8788',
        token: 'bridge-token',
      },
      '/v1/wechat/publish',
      {
        method: 'POST',
        body: JSON.stringify({
          account_id: 'main',
          title: 'Test title',
          content_html: '<p>Hello</p>',
          author: 'Joe',
          digest: 'Summary',
          content_source_url: 'https://example.com/post',
          cover_image_url: 'https://example.com/cover.jpg',
          publish_now: true,
          need_open_comment: true,
          only_fans_can_comment: false,
        }),
      },
    )
    expect(body).toEqual({
      success: true,
      media_id: 'MEDIA_ID',
      publish_id: 'PUBLISH_ID',
    })
  })

  it('applies default author, comments, and cover image when omitted', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      account_id: 'main',
      title: 'No Cover Post',
      content_html: '<p>Hello</p>',
    })
    mocks.fetchWechatBridgeJson.mockResolvedValue({
      success: true,
      media_id: 'MEDIA_ID',
    })

    const response = await POST({} as never)
    expect(response.status).toBe(200)

    const [, , requestInit] = mocks.fetchWechatBridgeJson.mock.calls[0]
    const forwarded = JSON.parse(String(requestInit.body))

    expect(forwarded.author).toBe('你的名字')
    expect(forwarded.need_open_comment).toBe(true)
    expect(forwarded.only_fans_can_comment).toBe(false)
    expect(forwarded.cover_image_url).toMatch(/^https:\/\/example\.com\/default-covers\/qm-cover-[1-3]\.jpg$/)
  })
})
