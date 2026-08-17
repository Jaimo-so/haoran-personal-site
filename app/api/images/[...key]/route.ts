import { NextRequest } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'

type StoredObject = {
  body: ReadableStream | null
  httpEtag: string
  size: number
  writeHttpMetadata: (headers: Headers) => void
  range?: (range: { offset: number; length?: number }) => ReadableStream
  slice?: (start: number, end: number) => ReadableStream
}

type ImageBucket = {
  get: (key: string, options?: { range?: { offset: number; length: number } }) => Promise<StoredObject | null>
  head: (key: string) => Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>
}

type RuntimeEnv = {
  IMAGES?: ImageBucket
  ENABLE_CF_IMAGE_PIPELINE?: string
}

type CloudflareImageFit = 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
type CloudflareImageFormat = 'auto' | 'avif' | 'webp' | 'json' | 'jpeg' | 'png'

const TRANSFORM_QUERY_KEYS = ['w', 'width', 'h', 'height', 'q', 'quality', 'fit', 'format']

function readFlag(value: unknown): boolean {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parseBoundedInt(value: string | null, min: number, max: number): number | undefined {
  if (!value) return undefined

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return undefined

  return Math.min(max, Math.max(min, parsed))
}

function parseFit(value: string | null): CloudflareImageFit | undefined {
  switch (value) {
    case 'scale-down':
    case 'contain':
    case 'cover':
    case 'crop':
    case 'pad':
      return value
    default:
      return undefined
  }
}

function parseFormat(value: string | null): CloudflareImageFormat | undefined {
  switch (value) {
    case 'auto':
    case 'avif':
    case 'webp':
    case 'json':
    case 'jpeg':
    case 'png':
      return value
    default:
      return undefined
  }
}

function getImageTransform(searchParams: URLSearchParams) {
  const width = parseBoundedInt(searchParams.get('w') || searchParams.get('width'), 16, 4096)
  const height = parseBoundedInt(searchParams.get('h') || searchParams.get('height'), 16, 4096)
  const quality = parseBoundedInt(searchParams.get('q') || searchParams.get('quality'), 30, 100)
  const fit = parseFit(searchParams.get('fit'))
  const format = parseFormat(searchParams.get('format'))

  if (!width && !height && !quality && !fit && !format) {
    return null
  }

  return {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(quality ? { quality } : {}),
    ...(fit ? { fit } : {}),
    ...(format ? { format } : {}),
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params
  const requestPath = key?.join('/') || ''
  const objectKey = requestPath
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')

  const env = (await getAppCloudflareEnv()) as RuntimeEnv

  if (!env?.IMAGES) {
    return new Response('Image storage is not configured', { status: 500 })
  }

  // Check for Range header (required for iOS Safari video playback)
  const rangeHeader = req.headers.get('Range')
  const isRawRequest = req.nextUrl.searchParams.get('__raw') === '1'
  const transform = !rangeHeader && !isRawRequest ? getImageTransform(req.nextUrl.searchParams) : null

  if (transform && readFlag(env.ENABLE_CF_IMAGE_PIPELINE)) {
    const headInfo = await env.IMAGES.head(objectKey)

    if (!headInfo) {
      return new Response('Not found', { status: 404 })
    }

    const contentType = headInfo.httpMetadata?.contentType || ''
    const canTransform = contentType.startsWith('image/') && contentType !== 'image/gif' && contentType !== 'image/svg+xml'

    if (canTransform) {
      try {
        const rawUrl = new URL(req.url)
        rawUrl.searchParams.set('__raw', '1')
        for (const key of TRANSFORM_QUERY_KEYS) {
          rawUrl.searchParams.delete(key)
        }

        const transformed = await fetch(rawUrl.toString(), {
          cf: {
            image: transform,
          },
        } as RequestInit & { cf: { image: Record<string, unknown> } })

        if (transformed.ok) {
          const headers = new Headers(transformed.headers)
          headers.set('cache-control', 'public, max-age=31536000, immutable')
          headers.set('Accept-Ranges', 'bytes')

          return new Response(transformed.body, {
            status: transformed.status,
            headers,
          })
        }
      } catch (error) {
        console.warn('Cloudflare image transform failed, falling back to original asset:', error)
      }
    }
  }

  if (rangeHeader) {
    // Parse Range: bytes=0-1023
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (match) {
      const start = parseInt(match[1], 10)
      const endStr = match[2]

      // Get object with range
      const headInfo = await env.IMAGES.head(objectKey)
      if (!headInfo) {
        return new Response('Not found', { status: 404 })
      }

      const totalSize = headInfo.size
      const end = endStr ? Math.min(parseInt(endStr, 10), totalSize - 1) : totalSize - 1
      const length = end - start + 1

      const object = await env.IMAGES.get(objectKey, {
        range: { offset: start, length },
      })

      if (!object) {
        return new Response('Not found', { status: 404 })
      }

      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`)
      headers.set('Content-Length', String(length))
      headers.set('Accept-Ranges', 'bytes')
      headers.set('cache-control', 'public, max-age=31536000, immutable')

      return new Response(object.body, { status: 206, headers })
    }
  }

  // Normal full request
  const object = await env.IMAGES.get(objectKey)

  if (!object) {
    return new Response('Not found', { status: 404 })
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('Accept-Ranges', 'bytes')
  if (object.size) {
    headers.set('Content-Length', String(object.size))
  }

  return new Response(object.body, { headers })
}
