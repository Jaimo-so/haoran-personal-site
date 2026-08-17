const DEFAULT_POST_COVER_IMAGES = [
  '/default-covers/qm-cover-1.jpg',
  '/default-covers/qm-cover-2.jpg',
  '/default-covers/qm-cover-3.jpg',
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
  if (explicitCover) return explicitCover

  return absolutizeSiteAssetUrl(pickDefaultPostCoverPath(input), options.baseUrl)
}

export function resolveDefaultSiteCoverImage(baseUrl?: string) {
  return absolutizeSiteAssetUrl(DEFAULT_SITE_COVER_IMAGE, baseUrl)
}

export { DEFAULT_POST_COVER_IMAGES, DEFAULT_SITE_COVER_IMAGE }
