import { load } from 'cheerio/slim'

export class WechatImportError extends Error {
  constructor(message: string, public status = 422, public code = 'IMPORT_FAILED') {
    super(message)
  }
}

export function validateWechatArticleUrl(value: unknown): string {
  try {
    if (typeof value !== 'string' || value.length > 4096) throw new Error()
    const url = new URL(value.trim().replace(/&amp;/g, '&'))
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'mp.weixin.qq.com'
      || url.username || url.password || url.port || !/^\/s(?:\/[^/]+)?$/.test(url.pathname)) throw new Error()
    if (url.pathname === '/s' && (!url.searchParams.get('__biz') || !url.searchParams.get('mid'))) throw new Error()
    url.protocol = 'https:'
    url.hash = ''
    return url.toString()
  } catch {
    throw new WechatImportError('请输入有效的微信公众号文章链接（mp.weixin.qq.com/s/…）。', 400, 'INVALID_URL')
  }
}

function safeUrl(value: string | undefined, base: string) {
  if (!value?.trim()) return ''
  try {
    const url = new URL(value.trim(), base)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}

export function isWechatImageUrl(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.port && !url.username && !url.password
      && ['mmbiz.qpic.cn', 'mmbiz.qlogo.cn'].includes(url.hostname)
  } catch {
    return false
  }
}

const allowedTags = new Set('p div h1 h2 h3 h4 h5 h6 br hr strong b em i u s del blockquote ul ol li pre code a img table thead tbody tfoot tr th td sup sub'.split(' '))

/** Rebuild a small, editor-compatible HTML vocabulary; never execute the source page. */
export function cleanImportedHtml(html: string, sourceUrl: string) {
  const $ = load(html)
  const root = $.root()
  root.find('script,style,noscript,template,object,embed,svg,math,form,input,button,textarea,select,link,meta,base').remove()
  const warnings: string[] = []
  if (root.find('iframe,video,audio,mpvoice,mpvideo,mp-common-mpaudio,mp-common-videosnap,mp-miniprogram').length) {
    warnings.push('原文含视频、音频或小程序，已保留原文入口，请在编辑器中补充这些内容。')
    root.find('iframe,video,audio,mpvoice,mpvideo,mp-common-mpaudio,mp-common-videosnap,mp-miniprogram').each((_, el) => {
      const link = $('<a></a>').attr('href', sourceUrl).text('查看原文中的音视频或小程序')
      $(el).replaceWith($('<p></p>').append(link))
    })
  }
  root.find('*').each((_, el) => {
    const node = $(el)
    if (el.name === 'section' || el.name === 'article' || el.name === 'figure' || el.name === 'figcaption') el.name = 'div'
    // WeChat often represents paragraphs as nested sections containing inline text.
    if (el.name === 'div' && !node.find('p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,pre,table').length) el.name = 'p'
    if (!allowedTags.has(el.name)) {
      node.replaceWith(node.contents())
      return
    }
    const attrs: Record<string, string> = {}
    if (el.name === 'a') {
      const href = safeUrl(node.attr('href'), sourceUrl)
      if (href) { attrs.href = href; attrs.rel = 'noopener noreferrer' }
    }
    if (el.name === 'img') {
      const src = safeUrl(node.attr('data-src') || node.attr('src'), sourceUrl)
      if (!src) { node.remove(); return }
      attrs.src = src
      attrs.alt = node.attr('alt') || ''
      attrs.referrerpolicy = 'no-referrer'
    }
    if (el.name === 'td' || el.name === 'th') {
      for (const name of ['colspan', 'rowspan']) {
        const value = node.attr(name)
        if (value && /^\d{1,2}$/.test(value) && Number(value) > 0) attrs[name] = value
      }
    }
    if (el.name === 'ol' && /^\d{1,6}$/.test(node.attr('start') || '')) attrs.start = node.attr('start')!
    for (const name of Object.keys(el.attribs)) node.removeAttr(name)
    node.attr(attrs)
  })
  // Inline images must be blocks to survive the editor's block-image schema.
  root.find('p').has('img').each((_, el) => {
    const paragraph = $(el)
    const parts = $('<div></div>')
    let segment = $('<p></p>')
    const flush = () => {
      if (segment.contents().length) parts.append(segment)
      segment = $('<p></p>')
    }
    // Unwrap formatting around images so they become direct paragraph children.
    paragraph.find('img').each((_, img) => {
      while ($(img).parent()[0] !== el) {
        const parent = $(img).parent()
        if (!parent.length) break
        parent.replaceWith(parent.contents())
      }
    })
    paragraph.contents().each((_, child) => {
      if ('name' in child && child.name === 'img') { flush(); parts.append(child) }
      else segment.append(child)
    })
    flush()
    paragraph.replaceWith(parts.contents())
  })
  const cleaned = root.html()?.trim() || ''
  const textRoot = root.clone()
  textRoot.find('br').replaceWith('\n')
  textRoot.find('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,tr,pre').append('\n')
  const content = textRoot.text().replace(/\n[\t ]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!content && !root.find('img').length) throw new WechatImportError('未读取到文章正文，本次没有创建网站文章。')
  return { html: cleaned, content: content || '图片文章', warnings }
}

export function parseWechatArticle(html: string, sourceUrl: string) {
  const $ = load(html)
  const body = $('#js_content').first()
  const title = ($('#activity-name').text() || $('meta[property="og:title"]').attr('content') || '').trim()
  if (!body.length || !title) {
    throw new WechatImportError('微信未返回文章正文，可能需要验证、链接已失效或文章受限。本次没有创建网站文章。', 422, 'WECHAT_UNAVAILABLE')
  }
  const cleaned = cleanImportedHtml(body.html() || '', sourceUrl)
  const cover = safeUrl($('meta[property="og:image"]').attr('content'), sourceUrl)
  return { title, ...cleaned, cover_image: cover || null }
}

export async function readLimitedResponse(response: Response, limit: number) {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel()
    throw new WechatImportError('内容超过导入大小限制。', 413)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new WechatImportError('未读取到内容。')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new WechatImportError('内容超过导入大小限制。', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

export async function fetchWechatArticle(input: string) {
  let url = validateWechatArticleUrl(input)
  const signal = AbortSignal.timeout(15000)
  try {
    for (let hop = 0; hop < 4; hop++) {
      const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        try { url = validateWechatArticleUrl(new URL(location || '', url).href) } catch {
          throw new WechatImportError('微信要求验证，当前无法通过链接自动读取这篇文章。本次没有创建网站文章。', 422, 'WECHAT_UNAVAILABLE')
        }
        continue
      }
      if (!response.ok) { await response.body?.cancel(); throw new WechatImportError('暂时无法自动读取微信文章。本次没有创建网站文章。', 422, 'WECHAT_UNAVAILABLE') }
      return parseWechatArticle(new TextDecoder().decode(await readLimitedResponse(response, 4 * 1024 * 1024)), url)
    }
    throw new WechatImportError('微信文章跳转过多，自动读取未完成。本次没有创建网站文章。', 422, 'WECHAT_UNAVAILABLE')
  } catch (error) {
    if (error instanceof WechatImportError) throw error
    throw new WechatImportError('读取微信文章超时或网络不可用。本次没有创建网站文章，请稍后重试。', 422, 'WECHAT_UNAVAILABLE')
  }
}

export async function storeWechatImages(
  article: ReturnType<typeof parseWechatArticle>,
  bucket: Pick<R2Bucket, 'put'> | undefined,
  importId: string,
) {
  const $ = load(`<div id="images-root">${article.html}</div>`)
  const root = $('#images-root')
  const urls = new Set(root.find('img').map((_, el) => $(el).attr('src') || '').get())
  if (article.cover_image) urls.add(article.cover_image)
  const replacements = new Map<string, string>()
  const signal = AbortSignal.timeout(25000)
  let index = 0
  for (const url of urls) {
    if (!bucket || !isWechatImageUrl(url) || index >= 40 || signal.aborted) continue
    const key = `image/wechat/${importId}/${index++}`
    try {
      // Do not follow image redirects to arbitrary servers.
      const response = await fetch(url.replace(/^http:/, 'https:'), { redirect: 'manual', signal })
      const contentType = response.headers.get('content-type')?.split(';')[0].trim() || ''
      if (!response.ok || !['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'].includes(contentType)) {
        await response.body?.cancel()
        continue
      }
      const data = await readLimitedResponse(response, 10 * 1024 * 1024)
      if (!data.length) continue
      await bucket.put(key, data, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } })
      replacements.set(url, `/api/images/${key}`)
    } catch { /* Keep the source URL and report incomplete image storage. */ }
  }
  root.find('img').each((_, el) => {
    const replacement = replacements.get($(el).attr('src') || '')
    if (replacement) $(el).attr('src', replacement)
  })
  if (urls.size > replacements.size) article.warnings.push(`${urls.size - replacements.size} 张图片未能保存到本站，已保留原图链接；若显示失败，请在编辑器中重新上传。`)
  return {
    ...article,
    html: root.html() || '',
    cover_image: article.cover_image ? replacements.get(article.cover_image) || article.cover_image : null,
  }
}
