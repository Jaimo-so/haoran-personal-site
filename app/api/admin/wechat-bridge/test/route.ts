import type { NextRequest } from 'next/server'
import { ensureAuthenticatedRequest, getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import { fetchWechatBridgeJson, getWechatBridgeConfig, type WechatBridgeAccount } from '@/lib/wechat-bridge-config'
import { normalizeBaseUrl } from '@/lib/ai-provider-profiles'

interface BridgeTestBody {
  base_url?: string
  token?: string
}

export async function POST(req: NextRequest) {
  const route = await getRouteEnvWithDb('DB unavailable')
  if (!route.ok) return route.response

  const unauthorized = await ensureAuthenticatedRequest(req, route.db)
  if (unauthorized) return unauthorized

  try {
    const body = await parseJsonBody<BridgeTestBody>(req)
    const stored = await getWechatBridgeConfig(route.db, route.env)
    const baseUrl = normalizeBaseUrl(body.base_url || stored.base_url || '')
    const token = (body.token || '').trim() || stored.token

    if (!baseUrl || !token) {
      return jsonError('请先填写 bridge Base URL 和 Token', 400)
    }

    const bridge = { base_url: baseUrl, token }
    const health = await fetchWechatBridgeJson<{ ok?: boolean; service?: string }>(bridge, '/health')
    const accountsResponse = await fetchWechatBridgeJson<{ accounts?: WechatBridgeAccount[] }>(bridge, '/v1/accounts')

    return jsonOk({
      success: true,
      health,
      accounts: accountsResponse.accounts || [],
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '测试 bridge 连接失败', 500)
  }
}
