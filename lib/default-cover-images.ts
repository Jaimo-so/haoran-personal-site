const DEFAULT_POST_COVER_IMAGES = [
  '/images/haoran-ip.png',
] as const
const DEFAULT_SITE_COVER_IMAGE = DEFAULT_POST_COVER_IMAGES[0]

const FALLBACK_COVER_SEED = 'qmblog-default-cover'

interface CoverSeedInput {
  slug?: string | null
  title?: string | null
}

interface CoverImageInput extends CoverSeedInput {
  cover_image?: string | null
}

function normalizeSeedValue(value: string | null | undefined) {
  return String(value || '').trim()
}

function isLegacyDefaultCover(value: string, baseUrl?: string) {
  try {
    const url = new URL(value, baseUrl || 'https://blog.haoran-ai.workers.dev')
    const siteHosts = new Set([
      'blog.haoran-ai.workers.dev',
      'ai-product-notes.3516750545s.workers.dev',
    ])
    if (baseUrl) siteHosts.add(new URL(baseUrl).hostname)
    return siteHosts.has(url.hostname) && /^\/default-covers\/qm-cover-[123]\.jpg$/.test(url.pathname)
  } catch {
    return false
  }
}

function buildSeed(input: string | CoverSeedInput) {
  if (typeof input === 'string') {
    const normalized = normalizeSeedValue(input)
    return normalized || FALLBACK_COVER_SEED
  }

  const slug = normalizeSeedValue(input.slug)
  const title = normalizeSeedValue(input.title)
  return [slug, title].filter(Boolean).join('::') || FALLBACK_COVER_SEED
}

function hashSeed(seed: string) {
  let hash = 0
  for (const char of seed) {
    hash = ((hash * 33) + char.charCodeAt(0)) >>> 0
  }
  return hash
}

export function pickDefaultPostCoverPath(input: string | CoverSeedInput) {
  const seed = buildSeed(input)
  const index = hashSeed(seed) % DEFAULT_POST_COVER_IMAGES.length
  return DEFAULT_POST_COVER_IMAGES[index]
}

export function absolutizeSiteAssetUrl(input: string, baseUrl?: string) {
  const normalized = normalizeSeedValue(input)
  if (!normalized) return ''
  if (!baseUrl) return normalized

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return normalized
  }
}

export function resolvePostCoverImage(
  input: CoverImageInput,
  options: { baseUrl?: string } = {},
) {
  const explicitCover = absolutizeSiteAssetUrl(normalizeSeedValue(input.cover_image), options.baseUrl)
  if (explicitCover && !isLegacyDefaultCover(explicitCover, options.baseUrl)) return explicitCover

  return absolutizeSiteAssetUrl(pickDefaultPostCoverPath(input), options.baseUrl)
}

export function resolveDefaultSiteCoverImage(baseUrl?: string) {
  return absolutizeSiteAssetUrl(DEFAULT_SITE_COVER_IMAGE, baseUrl)
}

export { DEFAULT_POST_COVER_IMAGES, DEFAULT_SITE_COVER_IMAGE }
