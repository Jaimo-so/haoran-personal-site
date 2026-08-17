import type { NextRequest } from 'next/server'
import { ensureAuthenticatedRequest, getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import { assertWechatBridgeReady, fetchWechatBridgeJson, getWechatBridgeConfig } from '@/lib/wechat-bridge-config'
import { resolvePostCoverImage } from '@/lib/default-cover-images'
import { getSiteUrl } from '@/lib/site-config'
import { WECHAT_DEFAULT_AUTHOR, WECHAT_DEFAULT_NEED_OPEN_COMMENT } from '@/lib/wechat-publish-defaults'

interface PublishWechatBody {
  account_id?: string
  title?: string
  content_html?: string
  author?: string
  digest?: string
  content_source_url?: string
  cover_image_url?: string
  publish_now?: boolean
  need_open_comment?: boolean
  only_fans_can_comment?: boolean
}

export async function POST(req: NextRequest) {
  const route = await getRouteEnvWithDb('DB unavailable')
  if (!route.ok) return route.response

  const unauthorized = await ensureAuthenticatedRequest(req, route.db)
  if (unauthorized) return unauthorized

  try {
    const body = await parseJsonBody<PublishWechatBody>(req)
    const accountId = (body.account_id || '').trim()
    const title = (body.title || '').trim()
    const contentHtml = (body.content_html || '').trim()
    const author = (body.author || '').trim() || WECHAT_DEFAULT_AUTHOR
    const needOpenComment = body.need_open_comment === undefined
      ? WECHAT_DEFAULT_NEED_OPEN_COMMENT
      : Boolean(body.need_open_comment)
    const onlyFansCanComment = needOpenComment && Boolean(body.only_fans_can_comment)
    const coverImageUrl = resolvePostCoverImage(
      {
        cover_image: (body.cover_image_url || '').trim(),
        title,
      },
      { baseUrl: getSiteUrl() },
    )

    if (!accountId) return jsonError('请选择公众号账号', 400)
    if (!title) return jsonError('文章标题不能为空', 400)
    if (!contentHtml) return jsonError('文章内容不能为空', 400)

    const config = assertWechatBridgeReady(await getWechatBridgeConfig(route.db, route.env))
    const result = await fetchWechatBridgeJson<Record<string, unknown>>(config, '/v1/wechat/publish', {
      method: 'POST',
      body: JSON.stringify({
        account_id: accountId,
        title,
        content_html: contentHtml,
        author,
        digest: (body.digest || '').trim(),
        content_source_url: (body.content_source_url || '').trim(),
        cover_image_url: coverImageUrl,
        publish_now: Boolean(body.publish_now),
        need_open_comment: needOpenComment,
        only_fans_can_comment: onlyFansCanComment,
      }),
    })

    return jsonOk(result)
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '提交公众号发布失败', 500)
  }
}
