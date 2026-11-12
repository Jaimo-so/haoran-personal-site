import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { load } from 'cheerio/slim'
import { createPost } from '@/lib/db'
import { ensureAuthenticatedRequest, getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { cleanImportedHtml, fetchWechatArticle, readLimitedResponse, storeWechatImages, validateWechatArticleUrl, WechatImportError } from '@/lib/wechat-import'

export async function POST(req: NextRequest) {
  try {
    const route = await getRouteEnvWithDb('数据库未配置')
    if (!route.ok) return route.response
    const authError = await ensureAuthenticatedRequest(req, route.db)
    if (authError) return authError

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(new TextDecoder().decode(await readLimitedResponse(new Response(req.body), 5 * 1024 * 1024)))
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return jsonError('请求格式不正确。', 400)
    } catch (error) {
      if (error instanceof WechatImportError) throw error
      return jsonError('请求格式不正确。', 400)
    }
    const sourceUrl = validateWechatArticleUrl(payload.url)
    // The browser extension sends content only after the user clicks on an open article.
    // Never request the source page again for this flow.
    const fromBrowser = payload.mode === 'browser'
    let article: Awaited<ReturnType<typeof fetchWechatArticle>>
    if (fromBrowser) {
      const title = typeof payload.title === 'string' ? payload.title.trim() : ''
      const html = typeof payload.html === 'string' ? payload.html : ''
      if (!title || !html.trim()) return jsonError('浏览器未读取到完整文章，请等待原文加载完成后再导入。', 422)
      article = { title, ...cleanImportedHtml(html, sourceUrl), cover_image: null }
    } else {
      article = await fetchWechatArticle(sourceUrl)
    }
    const slug = `wechat-${nanoid(12)}`
    const stored = fromBrowser ? article : await storeWechatImages(article, route.env.IMAGES, slug)
    const $ = load('<p></p>')
    const source = $('p').append($('<a></a>').attr({ href: sourceUrl, rel: 'noopener noreferrer' }).text('原文链接（微信公众号）')).toString()
    const id = await createPost(route.db, {
      slug,
      title: stored.title,
      html: `${stored.html}\n${source}`,
      content: `${stored.content}\n\n原文链接：${sourceUrl}`,
      status: 'draft',
      category: typeof payload.category === 'string' && payload.category.trim() ? payload.category.trim() : '未分类',
      tags: [],
      cover_image: stored.cover_image,
    })
    return jsonOk({ success: true, id, slug, warnings: stored.warnings }, 201)
  } catch (error) {
    if (error instanceof WechatImportError) return jsonOk({ error: error.message, code: error.code }, error.status)
    console.error('Wechat import failed:', error)
    return jsonError('导入未完成，请稍后重试。', 500)
  }
}
