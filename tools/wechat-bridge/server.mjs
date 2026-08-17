import http from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { URL } from 'node:url'
import dns from 'node:dns/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number(process.env.PORT || 8788)
const BRIDGE_TOKEN = (process.env.BRIDGE_TOKEN || '').trim()
const ACCOUNTS_FILE = process.env.WECHAT_ACCOUNTS_FILE || '/etc/qmblog-wechat-bridge/accounts.json'
const REQUEST_BODY_LIMIT = 2.5 * 1024 * 1024
const REMOTE_IMAGE_LIMIT = 1024 * 1024
const COVER_IMAGE_LIMIT = 64 * 1024
const FALLBACK_SOURCE_IMAGE_LIMIT = 20 * 1024 * 1024
const FALLBACK_SOURCE_COVER_LIMIT = 10 * 1024 * 1024
const convertFile = promisify(execFile)
const IMAGE_MAGICK_BIN = process.env.IMAGEMAGICK_CONVERT || 'convert'

class RemoteFileTooLargeError extends Error {
  constructor(maxBytes, url) {
    super(`Remote file exceeds limit of ${maxBytes} bytes`)
    this.name = 'RemoteFileTooLargeError'
    this.maxBytes = maxBytes
    this.url = url
  }
}

if (!BRIDGE_TOKEN) {
  throw new Error('Missing BRIDGE_TOKEN')
}

const tokenCache = new Map()

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function loadAccounts() {
  const raw = await readFile(ACCOUNTS_FILE, 'utf8')
  const parsed = JSON.parse(raw)
  const inputAccounts = Array.isArray(parsed?.accounts) ? parsed.accounts : []

  return inputAccounts
    .map((account) => ({
      id: String(account?.id || '').trim(),
      name: String(account?.name || '').trim(),
      appid: String(account?.appid || '').trim(),
      secret: String(account?.secret || '').trim(),
    }))
    .filter(account => account.id && account.name && account.appid && account.secret)
}

async function readJsonBody(req, maxBytes = REQUEST_BODY_LIMIT) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) {
      throw new Error('Request body too large')
    }
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  return raw ? JSON.parse(raw) : {}
}

function requireAuth(req) {
  const header = req.headers.authorization || ''
  if (header === `Bearer ${BRIDGE_TOKEN}`) return true
  return false
}

async function getAccount(accountId) {
  const accounts = await loadAccounts()
  const account = accounts.find(item => item.id === accountId)
  if (!account) {
    throw new Error(`Unknown account_id: ${accountId}`)
  }
  return { account }
}

async function getAccessToken(account) {
  const cached = tokenCache.get(account.id)
  const now = Date.now()

  if (cached && cached.expiresAt > now + 60_000) {
    return cached.token
  }

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token')
  url.searchParams.set('grant_type', 'client_credential')
  url.searchParams.set('appid', account.appid)
  url.searchParams.set('secret', account.secret)

  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await response.json()

  if (!response.ok || payload?.errcode) {
    throw new Error(payload?.errmsg || `access_token request failed: HTTP ${response.status}`)
  }

  const expiresIn = Number(payload?.expires_in || 7200)
  tokenCache.set(account.id, {
    token: payload.access_token,
    expiresAt: now + expiresIn * 1000,
  })

  return payload.access_token
}

async function wxApiJson(account, path, { method = 'POST', body } = {}) {
  const accessToken = await getAccessToken(account)
  const url = new URL(`https://api.weixin.qq.com${path}`)
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || (typeof payload?.errcode === 'number' && payload.errcode !== 0)) {
    throw new Error(payload?.errmsg || `WeChat API request failed: ${path}`)
  }

  return payload
}

async function wxUploadForm(account, path, searchParams, formData) {
  const accessToken = await getAccessToken(account)
  const url = new URL(`https://api.weixin.qq.com${path}`)
  url.searchParams.set('access_token', accessToken)

  for (const [key, value] of Object.entries(searchParams || {})) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(30_000),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || (typeof payload?.errcode === 'number' && payload.errcode !== 0)) {
    throw new Error(payload?.errmsg || `WeChat upload failed: ${path}`)
  }

  return payload
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN)) return true

  if (parts[0] === 10) return true
  if (parts[0] === 127) return true
  if (parts[0] === 0) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true
  return false
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase()
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  )
}

async function assertPublicHostname(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http/https image URLs are allowed')
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Localhost URLs are not allowed')
  }

  if (net.isIP(hostname)) {
    if (
      (net.isIPv4(hostname) && isPrivateIPv4(hostname)) ||
      (net.isIPv6(hostname) && isPrivateIPv6(hostname))
    ) {
      throw new Error('Private network image URLs are not allowed')
    }
    return
  }

  const records = await dns.lookup(hostname, { all: true })
  if (!records.length) {
    throw new Error(`Cannot resolve hostname: ${hostname}`)
  }

  for (const record of records) {
    if (
      (record.family === 4 && isPrivateIPv4(record.address)) ||
      (record.family === 6 && isPrivateIPv6(record.address))
    ) {
      throw new Error('Private network image URLs are not allowed')
    }
  }
}

async function readResponseBuffer(response, maxBytes) {
  const reader = response.body?.getReader()
  if (!reader) {
    return Buffer.from(await response.arrayBuffer())
  }

  const chunks = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new RemoteFileTooLargeError(maxBytes)
    }
    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks)
}

function inferFileName(url, fallback) {
  const pathname = new URL(url).pathname
  const lastSegment = pathname.split('/').filter(Boolean).pop() || fallback
  const safe = lastSegment.replace(/[^a-zA-Z0-9._-]+/g, '-')
  return safe || fallback
}

function decodeHtmlEntities(input) {
  return String(input || '')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function shouldAttemptLocalTranscode(error) {
  if (!(error instanceof Error)) return false
  return (
    error instanceof RemoteFileTooLargeError ||
    /超过微信\s*(1MB|64KB)\s*限制/i.test(error.message) ||
    /Unsupported image type/i.test(error.message)
  )
}

function isOptimizableBlogImageUrl(url) {
  return url.pathname.startsWith('/api/images/')
}

function buildImageFetchCandidates(inputUrl, kind) {
  const input = new URL(decodeHtmlEntities(inputUrl))
  const candidates = [input.toString()]

  if (!isOptimizableBlogImageUrl(input)) {
    return candidates
  }

  const presets = kind === 'cover'
    ? [
      { w: '560', h: '315', fit: 'cover', q: '42', format: 'jpeg' },
      { w: '480', h: '270', fit: 'cover', q: '36', format: 'jpeg' },
      { w: '400', h: '225', fit: 'cover', q: '32', format: 'jpeg' },
      { w: '320', h: '180', fit: 'cover', q: '28', format: 'jpeg' },
    ]
    : [
      { w: '1280', q: '82', format: 'jpeg' },
      { w: '1080', q: '76', format: 'jpeg' },
      { w: '960', q: '70', format: 'jpeg' },
      { w: '840', q: '64', format: 'jpeg' },
      { w: '720', q: '58', format: 'jpeg' },
      { w: '640', q: '52', format: 'jpeg' },
    ]

  for (const preset of presets) {
    const next = new URL(input.toString())
    for (const [key, value] of Object.entries(preset)) {
      next.searchParams.set(key, value)
    }
    const candidate = next.toString()
    if (!candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  return candidates
}

async function fetchRemoteImageOnce(inputUrl, maxBytes) {
  let url = new URL(decodeHtmlEntities(inputUrl))

  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    await assertPublicHostname(url)

    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'qmblog-wechat-bridge/1.0' },
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error('Redirect response without Location header')
      url = new URL(location, url)
      continue
    }

    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`)
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const data = await readResponseBuffer(response, maxBytes).catch((error) => {
      if (error instanceof RemoteFileTooLargeError) {
        error.url = url.toString()
      }
      throw error
    })

    return {
      buffer: data,
      contentType,
      url: url.toString(),
      fileName: inferFileName(url.toString(), 'image'),
    }
  }

  throw new Error('Too many redirects while downloading image')
}

async function fetchRemoteImage(inputUrl, maxBytes, kind) {
  const candidates = buildImageFetchCandidates(inputUrl, kind)
  let lastTooLargeError = null

  for (const candidate of candidates) {
    try {
      return await fetchRemoteImageOnce(candidate, maxBytes)
    } catch (error) {
      if (error instanceof RemoteFileTooLargeError) {
        lastTooLargeError = error
        continue
      }
      throw error
    }
  }

  if (lastTooLargeError) {
    const limitLabel = kind === 'cover' ? '64KB' : '1MB'
    throw new Error(`图片在自动压缩后仍超过微信 ${limitLabel} 限制：${lastTooLargeError.url || inputUrl}`)
  }

  throw new Error(`Failed to download image: ${inputUrl}`)
}

function normalizeImageFile(download, allowedTypes) {
  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
  }

  if (!allowedTypes.includes(download.contentType)) {
    throw new Error(`Unsupported image type: ${download.contentType || 'unknown'}`)
  }

  const extension = extensionMap[download.contentType] || 'img'
  const baseName = download.fileName.replace(/\.[a-z0-9]+$/i, '') || 'image'
  const fileName = `${baseName}.${extension}`

  return {
    blob: new Blob([download.buffer], { type: download.contentType }),
    fileName,
    contentType: download.contentType,
  }
}

function buildLocalTranscodePresets(kind) {
  if (kind === 'cover') {
    return [
      { width: 560, height: 315, quality: 40 },
      { width: 480, height: 270, quality: 34 },
      { width: 400, height: 225, quality: 30 },
      { width: 320, height: 180, quality: 26 },
      { width: 280, height: 158, quality: 22 },
      { width: 240, height: 135, quality: 18 },
    ]
  }

  return [
    { width: 1280, quality: 82 },
    { width: 1080, quality: 76 },
    { width: 960, quality: 70 },
    { width: 840, quality: 64 },
    { width: 720, quality: 58 },
    { width: 640, quality: 52 },
    { width: 560, quality: 46 },
    { width: 480, quality: 40 },
    { width: 420, quality: 36 },
    { width: 360, quality: 32 },
    { width: 320, quality: 28 },
    { width: 280, quality: 24 },
  ]
}

async function transcodeImageLocally(download, { kind, maxBytes }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'qmblog-wechat-bridge-'))
  const inputPath = path.join(tempDir, 'input.bin')
  const outputPath = path.join(tempDir, 'output.jpg')

  try {
    await writeFile(inputPath, download.buffer)

    for (const preset of buildLocalTranscodePresets(kind)) {
      const resizeArgs = kind === 'cover'
        ? [
          '-thumbnail', `${preset.width}x${preset.height}^`,
          '-gravity', 'center',
          '-extent', `${preset.width}x${preset.height}`,
        ]
        : [
          '-thumbnail', `${preset.width}x>`,
        ]

      await convertFile(IMAGE_MAGICK_BIN, [
        inputPath,
        '-auto-orient',
        '-strip',
        ...resizeArgs,
        '-interlace', 'Plane',
        '-sampling-factor', '4:2:0',
        '-quality', String(preset.quality),
        `jpeg:${outputPath}`,
      ])

      const outputBuffer = await readFile(outputPath)
      if (outputBuffer.byteLength <= maxBytes) {
        const baseName = download.fileName.replace(/\.[a-z0-9]+$/i, '') || 'image'
        return {
          blob: new Blob([outputBuffer], { type: 'image/jpeg' }),
          fileName: `${baseName}.jpg`,
          contentType: 'image/jpeg',
        }
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }

  const limitLabel = kind === 'cover' ? '64KB' : '1MB'
  throw new Error(`图片在本地重压后仍超过微信 ${limitLabel} 限制：${download.url}`)
}

async function buildWechatUploadFile(sourceUrl, options) {
  try {
    const optimized = await fetchRemoteImage(sourceUrl, options.maxBytes, options.kind)
    return normalizeImageFile(optimized, options.allowedTypes)
  } catch (error) {
    if (!shouldAttemptLocalTranscode(error)) {
      throw error
    }

    const original = await fetchRemoteImageOnce(
      decodeHtmlEntities(sourceUrl),
      options.fallbackSourceLimit,
    )
    return transcodeImageLocally(original, {
      kind: options.kind,
      maxBytes: options.maxBytes,
    })
  }
}

async function uploadArticleImage(account, sourceUrl) {
  const normalized = await buildWechatUploadFile(sourceUrl, {
    kind: 'content',
    maxBytes: REMOTE_IMAGE_LIMIT,
    allowedTypes: ['image/jpeg', 'image/png'],
    fallbackSourceLimit: FALLBACK_SOURCE_IMAGE_LIMIT,
  })
  const formData = new FormData()
  formData.append('media', normalized.blob, normalized.fileName)

  const payload = await wxUploadForm(account, '/cgi-bin/media/uploadimg', {}, formData)
  const resultUrl = String(payload?.url || '').trim()
  if (!resultUrl) {
    throw new Error('WeChat uploadimg did not return url')
  }
  return resultUrl
}

async function uploadCoverThumb(account, sourceUrl) {
  const normalized = await buildWechatUploadFile(sourceUrl, {
    kind: 'cover',
    maxBytes: COVER_IMAGE_LIMIT,
    allowedTypes: ['image/jpeg'],
    fallbackSourceLimit: FALLBACK_SOURCE_COVER_LIMIT,
  })
  const formData = new FormData()
  formData.append('media', normalized.blob, normalized.fileName.endsWith('.jpg') ? normalized.fileName : 'cover.jpg')

  const payload = await wxUploadForm(account, '/cgi-bin/material/add_material', { type: 'thumb' }, formData)
  const mediaId = String(payload?.media_id || '').trim()
  if (!mediaId) {
    throw new Error('WeChat add_material did not return media_id')
  }
  return mediaId
}

async function replaceHtmlImageSources(html, replacer) {
  const regex = /<img\b[^>]*?\bsrc=(['"])(.*?)\1/gi
  let result = ''
  let lastIndex = 0
  let match

  while ((match = regex.exec(html)) !== null) {
    const [fullMatch, quote, src] = match
    const start = match.index
    const end = start + fullMatch.length
    const newSrc = await replacer(src)
    const updatedTag = fullMatch.replace(`${quote}${src}${quote}`, `${quote}${newSrc}${quote}`)

    result += html.slice(lastIndex, start)
    result += updatedTag
    lastIndex = end
  }

  result += html.slice(lastIndex)
  return result
}

function extractFirstImageSource(html) {
  const match = html.match(/<img\b[^>]*?\bsrc=(['"])(.*?)\1/i)
  return decodeHtmlEntities(match?.[2] || '')
}

async function publishArticle(account, body) {
  const title = String(body?.title || '').trim()
  const contentHtml = String(body?.content_html || '').trim()
  const accountId = String(body?.account_id || '').trim()
  const publishNow = Boolean(body?.publish_now)

  if (!accountId) throw new Error('Missing account_id')
  if (!title) throw new Error('Missing title')
  if (!contentHtml) throw new Error('Missing content_html')

  const imageCache = new Map()
  const rewrittenContent = await replaceHtmlImageSources(contentHtml, async (src) => {
    const normalizedSrc = decodeHtmlEntities(src)

    if (!normalizedSrc || normalizedSrc.startsWith('data:')) {
      throw new Error('WeChat content does not support inline data URLs')
    }
    if (!imageCache.has(normalizedSrc)) {
      imageCache.set(normalizedSrc, await uploadArticleImage(account, normalizedSrc))
    }
    return imageCache.get(normalizedSrc)
  })

  const coverImageUrl = decodeHtmlEntities(String(body?.cover_image_url || '').trim()) || extractFirstImageSource(contentHtml)
  if (!coverImageUrl) {
    throw new Error('Missing cover_image_url and no image found in article content')
  }

  const thumbMediaId = await uploadCoverThumb(account, coverImageUrl)
  const draftPayload = await wxApiJson(account, '/cgi-bin/draft/add', {
    body: {
      articles: [
        {
          title,
          author: String(body?.author || '').trim(),
          digest: String(body?.digest || '').trim(),
          content: rewrittenContent,
          content_source_url: String(body?.content_source_url || '').trim(),
          thumb_media_id: thumbMediaId,
          need_open_comment: body?.need_open_comment ? 1 : 0,
          only_fans_can_comment: body?.only_fans_can_comment ? 1 : 0,
        },
      ],
    },
  })

  const mediaId = String(draftPayload?.media_id || '').trim()
  if (!mediaId) {
    throw new Error('WeChat draft/add did not return media_id')
  }

  const response = {
    success: true,
    account: {
      id: account.id,
      name: account.name,
    },
    media_id: mediaId,
    publish_now: publishNow,
  }

  if (!publishNow) {
    return response
  }

  const publishPayload = await wxApiJson(account, '/cgi-bin/freepublish/submit', {
    body: { media_id: mediaId },
  })

  return {
    ...response,
    publish_id: String(publishPayload?.publish_id || ''),
    msg_data_id: String(publishPayload?.msg_data_id || ''),
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method || 'GET'
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (method === 'GET' && requestUrl.pathname === '/health') {
      const accounts = await loadAccounts().catch(() => [])
      return json(res, 200, {
        ok: true,
        service: 'qmblog-wechat-bridge',
        account_count: accounts.length,
      })
    }

    if (!requireAuth(req)) {
      return json(res, 401, { error: 'Unauthorized' })
    }

    if (method === 'GET' && requestUrl.pathname === '/v1/accounts') {
      const accounts = await loadAccounts()
      return json(res, 200, {
        accounts: accounts.map(({ id, name }) => ({ id, name })),
      })
    }

    if (method === 'POST' && requestUrl.pathname === '/v1/wechat/publish') {
      const body = await readJsonBody(req)
      const { account } = await getAccount(String(body?.account_id || '').trim())
      const result = await publishArticle(account, body)
      return json(res, 200, result)
    }

    return json(res, 404, { error: 'Not found' })
  } catch (error) {
    console.error('[wechat-bridge]', error)
    return json(res, 500, { error: toErrorMessage(error) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`qmblog-wechat-bridge listening on ${HOST}:${PORT}`)
})
