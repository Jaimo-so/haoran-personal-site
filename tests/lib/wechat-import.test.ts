import { afterEach, describe, expect, it, vi } from 'vitest'
import { load } from 'cheerio/slim'
import { cleanImportedHtml, fetchWechatArticle, isWechatImageUrl, parseWechatArticle, readLimitedResponse, storeWechatImages, validateWechatArticleUrl } from '@/lib/wechat-import'

const url = 'https://mp.weixin.qq.com/s/XTU2TDunH2VCfcGKI9MYOQ'
const fixture = `<html><head><meta property="og:title" content="标题备用"><meta property="og:image" content="https://mmbiz.qpic.cn/cover"></head><body>
  <h1 id="activity-name">知识的定义 &amp; 意义</h1>
  <div id="js_content" style="visibility:hidden"><section><h2>完整定义</h2><p>第一段：定义不能省略。</p><p>第二段：意义也不能省略。</p>
  <section>独立段落一</section><section>独立段落二</section>
  <p><strong>重点</strong>与<a href="https://example.com/reference">引用</a></p><ul><li>要点一</li><li>要点二</li></ul>
  <blockquote>引用的原话</blockquote><table><tr><th>术语</th><th>含义</th></tr><tr><td>知识</td><td>完整描述</td></tr></table>
  <pre><code>if (a &lt; b) {\n  return a;\n}</code></pre>
  <p>图片前<img src="placeholder" data-src="https://mmbiz.qpic.cn/image" alt="示意图">图片后</p>
  <script>alert(1)</script></section></div><div>评论和阅读量不属于正文</div></body></html>`

afterEach(() => vi.unstubAllGlobals())

describe('WeChat article import', () => {
  it('accepts short and legacy links and normalizes HTTPS and HTML entities', () => {
    expect(validateWechatArticleUrl(` ${url}#rd `)).toBe(url)
    expect(validateWechatArticleUrl('http://mp.weixin.qq.com/s?__biz=abc&amp;mid=123&amp;idx=1')).toBe('https://mp.weixin.qq.com/s?__biz=abc&mid=123&idx=1')
  })

  it.each(['https://localhost/s/abc', 'https://mp.weixin.qq.com.evil.test/s/abc', 'https://mp.weixin.qq.com@127.0.0.1/s/abc', 'file:///tmp/article', 'https://mp.weixin.qq.com:123/s/abc', 'https://mp.weixin.qq.com/', 'https://mp.weixin.qq.com/s', 'https://mp.weixin.qq.com/cgi-bin/test'])('rejects unsupported fetch targets: %s', input => {
    expect(() => validateWechatArticleUrl(input)).toThrow('有效的微信公众号文章链接')
  })

  it('preserves definitions, meaning, order, headings, lists, tables, code, and lazy images', () => {
    const article = parseWechatArticle(fixture, url)
    expect(article.title).toBe('知识的定义 & 意义')
    const $ = load(article.html)
    expect($('h2').text()).toBe('完整定义')
    expect($('li').length).toBe(2)
    expect($('td').last().text()).toBe('完整描述')
    expect($('code').text()).toBe('if (a < b) {\n  return a;\n}')
    expect($('img').attr('src')).toBe('https://mmbiz.qpic.cn/image')
    expect($('p img').length).toBe(0)
    expect($('img').prev('p').text()).toBe('图片前')
    expect($('img').next('p').text()).toBe('图片后')
    expect(article.content).toMatch(/第一段：定义不能省略。[\s\S]*第二段：意义也不能省略。[\s\S]*独立段落一\n独立段落二/)
    expect(article.content).not.toContain('评论和阅读量')
    expect(article.html).not.toMatch(/script|visibility|data-src/)
  })

  it('removes active content and unsafe URLs without removing ordinary text', () => {
    const article = cleanImportedHtml('<div onclick="evil()">保留文字<a href="jav&#x61;script:alert(1)">定义</a><img data-src="javascript:alert(2)" onerror="bad()"><svg onload="bad()"><script>bad()</script></svg><p style="background:url(https://bad.test)">意义</p></div>', url)
    expect(article.content).toContain('保留文字定义')
    expect(article.content).toContain('意义')
    expect(article.html).not.toMatch(/javascript|onclick|onerror|onload|script|style|svg|bad.test/)
  })

  it('keeps all fragment text even if pasted HTML contains document wrappers or closing divs', () => {
    const article = cleanImportedHtml('</div><p>第一点</p><p>第二点</p>', url)
    expect(article.content).toContain('第一点\n第二点')
  })

  it('keeps an explicit source link for unsupported media and warns', () => {
    const result = cleanImportedHtml('<p>视频说明</p><iframe src="https://video.test"></iframe>', url)
    expect(result.warnings).toHaveLength(1)
    expect(result.html).toContain(url)
    expect(result.html).not.toContain('iframe')
    expect(result.content).toContain('视频说明')
  })

  it('rejects verification pages and empty articles instead of saving them as notes', () => {
    expect(() => parseWechatArticle('<h1>环境异常</h1><p>请完成验证</p>', url)).toThrow('微信未返回文章正文')
    expect(() => parseWechatArticle('<h1 id="activity-name">标题</h1><div id="js_content"></div>', url)).toThrow('未读取到文章正文')
  })

  it('extracts an accessible article and never forwards credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(fixture))
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchWechatArticle(url)).title).toBe('知识的定义 & 意义')
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: 'manual', headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } }))
  })

  it('does not follow redirects to verification or internal network addresses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchWechatArticle(url)).rejects.toMatchObject({ code: 'WECHAT_UNAVAILABLE' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports network failures without asking for manual content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')))
    await expect(fetchWechatArticle(url)).rejects.toThrow('本次没有创建网站文章')
  })

  it('limits streamed responses even without content-length', async () => {
    await expect(readLimitedResponse(new Response('12345'), 4)).rejects.toMatchObject({ status: 413 })
  })

  it('stores duplicate WeChat images once and replaces HTML and cover URLs', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })))
    vi.stubGlobal('fetch', fetchMock)
    const put = vi.fn().mockResolvedValue(undefined)
    const article = { title: '图片', html: '<p>正文</p><img src="https://mmbiz.qpic.cn/a"><img src="https://mmbiz.qpic.cn/a">', content: '正文', cover_image: 'https://mmbiz.qpic.cn/a', warnings: [] }
    const result = await storeWechatImages(article, { put } as never, 'test-import')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(put).toHaveBeenCalledTimes(1)
    expect(result.cover_image).toBe('/api/images/image/wechat/test-import/0')
    expect(result.html).not.toContain('mmbiz.qpic.cn')
    expect(result.warnings).toEqual([])
  })

  it('does not fetch non-WeChat images, keeps failed originals, and reports them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://localhost' } }))
    vi.stubGlobal('fetch', fetchMock)
    const put = vi.fn()
    const article = { title: '图片', html: '<img src="https://mmbiz.qpic.cn/a"><img src="http://localhost/a">', content: '图片', cover_image: null, warnings: [] }
    const result = await storeWechatImages(article, { put } as never, 'test')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(put).not.toHaveBeenCalled()
    expect(result.html).toContain('https://mmbiz.qpic.cn/a')
    expect(result.warnings[0]).toContain('2 张图片')
    expect(isWechatImageUrl('https://mmbiz.qpic.cn.evil.test/a')).toBe(false)
  })
})
