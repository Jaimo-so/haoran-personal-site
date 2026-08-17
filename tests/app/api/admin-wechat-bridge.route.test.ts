import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureAuthenticatedRequest: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
  getWechatBridgePublicConfig: vi.fn(),
  saveWechatBridgeConfig: vi.fn(),
}))

vi.mock('@/lib/server/route-helpers', () => ({
  ensureAuthenticatedRequest: mocks.ensureAuthenticatedRequest,
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

vi.mock('@/lib/wechat-bridge-config', () => ({
  getWechatBridgePublicConfig: mocks.getWechatBridgePublicConfig,
  saveWechatBridgeConfig: mocks.saveWechatBridgeConfig,
}))

import { GET, PUT } from '@/app/api/admin/wechat-bridge/route'

describe('/api/admin/wechat-bridge route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: { kind: 'env' },
    })
    mocks.ensureAuthenticatedRequest.mockResolvedValue(null)
  })

  it('returns masked bridge config on GET', async () => {
    mocks.getWechatBridgePublicConfig.mockResolvedValue({
      enabled: true,
      base_url: 'http://127.0.0.1:8788',
      token_masked: 'abc123...7890',
      configured: true,
    })

    const response = await GET({} as never)
    const body = await response.json()

    expect(mocks.getWechatBridgePublicConfig).toHaveBeenCalledWith({ kind: 'db' }, { kind: 'env' })
    expect(body).toEqual({
      config: {
        enabled: true,
        base_url: 'http://127.0.0.1:8788',
        token_masked: 'abc123...7890',
        configured: true,
      },
    })
  })

  it('rejects enabling bridge without base URL', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      enabled: true,
      base_url: '   ',
    })

    const response = await PUT({} as never)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '启用 bridge 前需要填写 Base URL' })
    expect(mocks.saveWechatBridgeConfig).not.toHaveBeenCalled()
  })

  it('saves bridge config on PUT', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      enabled: true,
      base_url: ' http://bridge.test:8788 ',
      token: 'bridge-token',
    })
    mocks.saveWechatBridgeConfig.mockResolvedValue({
      enabled: true,
      base_url: 'http://bridge.test:8788',
      token_masked: 'bridge...oken',
      configured: true,
    })

    const response = await PUT({} as never)
    const body = await response.json()

    expect(mocks.saveWechatBridgeConfig).toHaveBeenCalledWith(
      { kind: 'db' },
      { kind: 'env' },
      {
        enabled: true,
        base_url: 'http://bridge.test:8788',
        token: 'bridge-token',
      },
    )
    expect(body).toEqual({
      success: true,
      config: {
        enabled: true,
        base_url: 'http://bridge.test:8788',
        token_masked: 'bridge...oken',
        configured: true,
      },
    })
  })
})
