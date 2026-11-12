import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { load } from 'cheerio/slim'

const mocks = vi.hoisted(() => ({ env: vi.fn(), auth: vi.fn(), createPost: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/db', () => ({ createPost: mocks.createPost }))
vi.mock('@/lib/cloudflare', () => ({ getAppCloudflareEnv: mocks.env, getAppCloudflareContext: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ authenticateRequest: mocks.auth }))
import { POST } from '@/app/api/admin/import/wechat/route'

const url = 'https://mp.weixin.qq.com/s/XTU2TDunH2VCfcGKI9MYOQ'
const request = (payload: unknown) => new NextRequest('https://site.test/api/admin/import/wechat', { method: 'POST', body: JSON.stringify(payload) })

describe('POST /api/admin/import/wechat', () => {
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.env.mockResolvedValue({ DB: { kind: 'db' } })
    mocks.auth.mockResolvedValue(true)
    mocks.createPost.mockResolvedValue(123)
    mocks.fetch.mockResolvedValue(new Response('<h1 id="activity-name">原文标题</h1><div id="js_content"><h2>定义</h2><p>完整意义。</p></div>'))
    vi.stubGlobal('fetch', mocks.fetch)
  })

  it('saves a new editable draft with full body and source attribution', async () => {
    const response = await POST(request({ url }))
    const result = await response.json()
    expect(response.status).toBe(201)
    expect(result).toMatchObject({ success: true, id: 123, slug: expect.stringMatching(/^wechat-/), warnings: [] })
    expect(mocks.createPost).toHaveBeenCalledWith({ kind: 'db' }, expect.objectContaining({
      title: '原文标题', status: 'draft', category: '未分类',
      content: expect.stringContaining(`原文链接：${url}`),
    }))
    const $ = load(mocks.createPost.mock.calls[0][1].html)
    expect($('h2').text()).toBe('定义')
    expect($('p').first().text()).toBe('完整意义。')
  })

  it('checks authentication before any external fetch or save', async () => {
    mocks.auth.mockResolvedValue(false)
    expect((await POST(request({ url }))).status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.createPost).not.toHaveBeenCalled()
  })

  it('rejects arbitrary URLs before fetching', async () => {
    expect((await POST(request({ url: 'http://localhost/admin' }))).status).toBe(400)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.createPost).not.toHaveBeenCalled()
  })

  it('reports verification failure without saving an article or requesting manual content', async () => {
    mocks.fetch.mockResolvedValue(new Response('<h1>环境异常</h1>'))
    const response = await POST(request({ url }))
    expect(response.status).toBe(422)
    const result = await response.json()
    expect(result).toMatchObject({ code: 'WECHAT_UNAVAILABLE' })
    expect(result.error).not.toMatch(/复制|粘贴|填写/)
    expect(mocks.createPost).not.toHaveBeenCalled()
  })

  it('always reads the URL, even if a stale client submits manual content', async () => {
    mocks.fetch.mockResolvedValue(new Response('<h1>环境异常</h1>'))
    const response = await POST(request({ url, mode: 'paste', title: '手填标题', html: '<p>手填正文</p>' }))
    expect(response.status).toBe(422)
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.createPost).not.toHaveBeenCalled()
  })

  it('imports user-triggered browser content without requesting the WeChat page again', async () => {
    const response = await POST(request({ url, mode: 'browser', title: '完整原文', category: '思考',
      html: '<h2>定义</h2><p>意义必须完整保留。</p><img src="https://site.test/api/images/a.png" onerror="bad()"><script>bad()</script>',
    }))
    expect(response.status).toBe(201)
    expect(mocks.fetch).not.toHaveBeenCalled()
    const saved = mocks.createPost.mock.calls[0][1]
    expect(saved).toMatchObject({ title: '完整原文', status: 'draft', category: '思考' })
    expect(saved.content).toContain('意义必须完整保留。')
    expect(saved.html).toContain('https://site.test/api/images/a.png')
    expect(saved.html).not.toMatch(/script|onerror/)
  })

  it('rejects incomplete browser captures without fetching or creating an empty draft', async () => {
    expect((await POST(request({ url, mode: 'browser', title: '', html: '<p>正文</p>' }))).status).toBe(422)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.createPost).not.toHaveBeenCalled()
  })

  it.each([null, [], 'invalid'])('rejects malformed payloads: %s', async payload => {
    expect((await POST(request(payload))).status).toBe(400)
    expect(mocks.createPost).not.toHaveBeenCalled()
  })
})
