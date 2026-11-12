import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const require = createRequire(import.meta.url)
const domino = require('@mixmark-io/domino')
const source = readFileSync('ecosystem/chrome-clipper/content-script.js', 'utf8')
const background = readFileSync('ecosystem/chrome-clipper/background.js', 'utf8')
const pageUrl = 'https://mp.weixin.qq.com/s/browser-fixture'

function extract(html: string) {
  const window = domino.createWindow(html)
  return runInNewContext(source, { document: window.document, location: new URL(pageUrl), URL })
}

describe('Chrome WeChat capture', () => {
  it('captures full article HTML and lazy images without running Readability or requesting the page', () => {
    const result = extract(`<h1 id="activity-name">原文标题</h1><div id="js_content">
      <section><h2>定义</h2><p>定义的完整内容。</p><p>意义的完整内容。</p></section>
      <table><tr><th>术语</th><th>意义</th></tr><tr><td>知识</td><td>原文解释</td></tr></table>
      <pre><code>if (a &lt; b) {\n  return a;\n}</code></pre>
      <img data-src="https://mmbiz.qpic.cn/a?x=1&amp;y=2" src="placeholder">
      <img data-src="https://mmbiz.qpic.cn/a?x=1&amp;y=2">
      <script>bad()</script></div><p>正文外的评论</p>`)
    expect(result.title).toBe('原文标题')
    expect(result.source).toBe('wechat')
    expect(result.markdown).toContain('定义的完整内容。')
    expect(result.markdown).toContain('意义的完整内容。')
    expect(result.html).toContain('<table>')
    expect(result.html).toContain('<pre><code>')
    expect(result.html).not.toMatch(/script|placeholder|正文外的评论/)
    expect([...result.images]).toEqual(['https://mmbiz.qpic.cn/a?x=1&y=2'])
  })

  it.each(['<h1>环境异常</h1>', '<h1 id="activity-name">标题</h1><div id="js_content"></div>'])('rejects verification and empty pages', html => {
    const result = extract(html)
    expect(result.error).toContain('没有完整的公众号正文')
    expect(result.html).toBeUndefined()
  })

  it('uploads images and passes HTML to the browser import endpoint, then opens the editor', async () => {
    const imageUrl = 'https://mmbiz.qpic.cn/a?x=1&y=2'
    const capture = { source: 'wechat', title: '实际文章标题', markdown: '完整定义',
      html: '<p>完整定义</p><img src="https://mmbiz.qpic.cn/a?x=1&amp;y=2">', images: [imageUrl], url: pageUrl }
    const fetchMock = vi.fn(async (url: string) => {
      if (url === imageUrl) return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
      if (url.endsWith('/api/uploads')) return Response.json({ success: true, url: '/api/images/local.png' })
      return Response.json({ success: true, slug: 'imported-fixture', warnings: [] })
    })
    const createTab = vi.fn().mockResolvedValue({})
    const context = { URL, Blob, FormData, AbortSignal, fetch: fetchMock, console,
      chrome: {
        storage: { local: { get: (_keys: unknown, callback: (value: unknown) => void) => callback({ apiUrl: 'https://site.test', apiToken: 'test-token' }) } },
        tabs: { query: vi.fn().mockResolvedValue([{ id: 42 }]), create: createTab },
        scripting: { executeScript: vi.fn().mockResolvedValue([{ result: capture }]) },
        runtime: { sendMessage: vi.fn().mockResolvedValue({}), onMessage: { addListener: vi.fn() } },
      },
    }
    const result = await runInNewContext(background + '\nclipPage({ title: "过时的标签页标题" })', context)
    expect(result.success).toBe(true)
    expect(result.title).toBe('实际文章标题')
    expect(fetchMock.mock.calls.some(([url]) => url === pageUrl)).toBe(false)
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    const [url, init] = calls.at(-1)!
    expect(url).toBe('https://site.test/api/admin/import/wechat')
    const body = JSON.parse(init.body as string)
    expect(body.mode).toBe('browser')
    expect(body.html).toContain('src="https://site.test/api/images/local.png"')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' })
    expect(calls[0][1].headers).toBeUndefined()
    expect(createTab).toHaveBeenCalledWith({ url: 'https://site.test/editor?edit=imported-fixture' })
  })
})
