import { searchPosts, type Post, type PostWithTags } from '@/lib/db'

const VECTOR_NAMESPACE = 'posts'
const DEFAULT_VECTOR_DIMENSIONS = 128
const MAX_VECTOR_TEXT_LENGTH = 6000

type RelatedStrategy = 'vectorize' | 'fts'
type RelatedSource = 'vectorize' | 'fts' | 'rules'

type RelatedSearchResult = {
  strategy: RelatedStrategy
  source: RelatedSource
  results: PostWithTags[]
}

type PublicPostRow = Pick<
  Post,
  | 'id'
  | 'slug'
  | 'title'
  | 'content'
  | 'description'
  | 'category'
  | 'tags'
  | 'status'
  | 'password'
  | 'is_hidden'
  | 'deleted_at'
  | 'published_at'
>

function readFlag(value: unknown): boolean {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function isVectorizeEnabled(env?: Partial<CloudflareEnv> | null): env is Partial<CloudflareEnv> & { VECTOR_INDEX: VectorizeIndex } {
  return Boolean(env?.VECTOR_INDEX) && readFlag(env?.ENABLE_VECTOR_SEARCH)
}

function parseTags(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : []
  } catch {
    return []
  }
}

function mapPost(post: Post): PostWithTags {
  return {
    ...post,
    status: post.deleted_at ? 'deleted' : (post.status || 'published'),
    tags: parseTags(post.tags),
  }
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCjkBigrams(text: string): string[] {
  const result: string[] = []
  const segments = text.match(/[\u3400-\u9fff]+/g) || []
  for (const segment of segments) {
    if (segment.length === 1) {
      result.push(segment)
      continue
    }
    for (let index = 0; index < segment.length - 1; index += 1) {
      result.push(segment.slice(index, index + 2))
    }
  }
  return result
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text)
  if (!normalized) return []

  const latinWords = normalized.match(/[a-z0-9][a-z0-9_-]{1,31}/g) || []
  return [...latinWords, ...extractCjkBigrams(normalized)]
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function buildHashedEmbedding(text: string, dimensions: number): number[] {
  const vector = new Array(Math.max(8, dimensions)).fill(0)
  const tokens = tokenize(text).slice(0, 1200)

  for (const token of tokens) {
    const hash = hashToken(token)
    const slot = hash % vector.length
    const sign = (hash & 1) === 0 ? 1 : -1
    const weight = token.length > 8 ? 1.6 : token.length > 3 ? 1.25 : 1
    vector[slot] += sign * weight
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => Number((value / magnitude).toFixed(6)))
}

function buildPostVectorText(post: {
  title: string
  description?: string | null
  category?: string | null
  tags?: string[] | string | null
  content?: string | null
}): string {
  const pieces = [
    post.title,
    post.description || '',
    post.category || '',
    ...parseTags(post.tags),
    (post.content || '').slice(0, MAX_VECTOR_TEXT_LENGTH),
  ].filter(Boolean)

  return pieces.join('\n')
}

async function getVectorDimensions(index: VectorizeIndex): Promise<number> {
  try {
    const description = await index.describe()
    const details = description as { dimensions?: number; config?: { dimensions?: number } } | undefined
    const config = description?.config as { dimensions?: number } | undefined
    const dimensions =
      config?.dimensions ||
      details?.dimensions ||
      DEFAULT_VECTOR_DIMENSIONS
    return Math.max(8, dimensions)
  } catch {
    return DEFAULT_VECTOR_DIMENSIONS
  }
}

async function fetchPostsBySlugs(db: D1Database, slugs: string[]): Promise<PostWithTags[]> {
  if (slugs.length === 0) return []

  const placeholders = slugs.map(() => '?').join(', ')
  const { results } = await db
    .prepare(
      `SELECT * FROM posts
       WHERE slug IN (${placeholders})
         AND status = 'published'
         AND password IS NULL
         AND is_hidden = 0
         AND deleted_at IS NULL`
    )
    .bind(...slugs)
    .all<Post>()

  const order = new Map(slugs.map((slug, index) => [slug, index]))
  return results
    .map(mapPost)
    .sort((left, right) => (order.get(left.slug) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.slug) ?? Number.MAX_SAFE_INTEGER))
}

async function tryVectorLookup(
  db: D1Database,
  env: Partial<CloudflareEnv> | null | undefined,
  queryText: string,
  excludeSlug: string | null,
  limit: number,
): Promise<PostWithTags[] | null> {
  if (!isVectorizeEnabled(env)) return null

  try {
    const dimensions = await getVectorDimensions(env.VECTOR_INDEX)
    const vector = buildHashedEmbedding(queryText, dimensions)
    const response = await env.VECTOR_INDEX.query(vector, {
      topK: Math.max(limit + 6, 12),
      namespace: VECTOR_NAMESPACE,
      returnMetadata: 'all',
    }) as { matches?: Array<{ metadata?: Record<string, unknown> }> }

    const slugs = (response.matches || [])
      .map((match) => {
        const metadataSlug = match?.metadata?.slug
        return typeof metadataSlug === 'string' ? metadataSlug : null
      })
      .filter((slug): slug is string => Boolean(slug) && slug !== excludeSlug)

    if (slugs.length === 0) return []

    const uniqueSlugs = Array.from(new Set(slugs))
    const posts = await fetchPostsBySlugs(db, uniqueSlugs)
    return posts.slice(0, limit)
  } catch (error) {
    console.warn('Vector lookup failed, falling back to FTS/rules:', error)
    return null
  }
}

function buildRelatedQuery(post: PostWithTags): string {
  const parts = [
    post.title,
    post.category || '',
    ...post.tags.slice(0, 4),
  ].filter(Boolean)

  return parts.join(' ').trim()
}

function buildTokenSet(post: {
  title: string
  description?: string | null
  category?: string | null
  tags?: string[]
}): Set<string> {
  return new Set(
    tokenize([
      post.title,
      post.description || '',
      post.category || '',
      ...(post.tags || []),
    ].join(' '))
  )
}

function scoreCandidate(candidate: PostWithTags, current: PostWithTags, currentTokens: Set<string>, currentTags: Set<string>): number {
  let score = 0

  if (candidate.category && current.category && candidate.category === current.category) {
    score += 6
  }

  const sharedTags = candidate.tags.filter((tag) => currentTags.has(tag)).length
  score += sharedTags * 5

  const candidateTokens = buildTokenSet(candidate)
  let overlap = 0
  for (const token of candidateTokens) {
    if (currentTokens.has(token)) overlap += 1
  }
  score += Math.min(overlap, 10) * 0.8

  const freshnessBoost = Math.max(0, candidate.published_at - current.published_at)
  if (freshnessBoost > 0) score += 0.25

  return score
}

async function getRuleBasedRelatedPosts(db: D1Database, current: PostWithTags, limit: number): Promise<PostWithTags[]> {
  const query = buildRelatedQuery(current)
  const fromSearch = query ? await searchPosts(db, query, Math.max(limit * 4, 12)) : []
  const recentResult = await db
    .prepare(
      `SELECT * FROM posts
       WHERE slug != ?
         AND status = 'published'
         AND password IS NULL
         AND is_hidden = 0
         AND deleted_at IS NULL
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .bind(current.slug, Math.max(limit * 12, 48))
    .all<Post>()

  const merged = new Map<string, PostWithTags>()
  for (const post of [...fromSearch, ...recentResult.results.map(mapPost)]) {
    if (post.slug === current.slug) continue
    merged.set(post.slug, post)
  }

  const currentTokens = buildTokenSet(current)
  const currentTags = new Set(current.tags)

  return Array.from(merged.values())
    .map((post) => ({
      post,
      score: scoreCandidate(post, current, currentTokens, currentTags),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.post.published_at - left.post.published_at)
    .slice(0, limit)
    .map((item) => item.post)
}

type SearchPostsWithStrategyOptions = {
  limit?: number
}

export async function searchPostsWithStrategy(
  db: D1Database,
  env: Partial<CloudflareEnv> | null | undefined,
  query: string,
  options: SearchPostsWithStrategyOptions = {},
): Promise<RelatedSearchResult> {
  const limit = options.limit ?? 20
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return { strategy: isVectorizeEnabled(env) ? 'vectorize' : 'fts', source: 'rules', results: [] }
  }

  const vectorResults = await tryVectorLookup(db, env, trimmedQuery, null, limit)
  if (vectorResults && vectorResults.length > 0) {
    return {
      strategy: 'vectorize',
      source: 'vectorize',
      results: vectorResults,
    }
  }

  return {
    strategy: 'fts',
    source: 'fts',
    results: await searchPosts(db, trimmedQuery, limit),
  }
}

export async function getRelatedPosts(
  db: D1Database,
  env: Partial<CloudflareEnv> | null | undefined,
  post: PostWithTags,
  limit = 3,
): Promise<RelatedSearchResult> {
  const vectorResults = await tryVectorLookup(db, env, buildPostVectorText(post), post.slug, limit)
  if (vectorResults && vectorResults.length > 0) {
    return {
      strategy: 'vectorize',
      source: 'vectorize',
      results: vectorResults,
    }
  }

  const ruleResults = await getRuleBasedRelatedPosts(db, post, limit)
  if (ruleResults.length > 0) {
    return {
      strategy: 'fts',
      source: 'rules',
      results: ruleResults,
    }
  }

  return {
    strategy: 'fts',
    source: 'fts',
    results: (await searchPosts(db, buildRelatedQuery(post) || post.title, limit + 1))
      .filter((candidate) => candidate.slug !== post.slug)
      .slice(0, limit),
  }
}

async function getPostForIndexing(db: D1Database, postId: number): Promise<PublicPostRow | null> {
  return db
    .prepare(
      `SELECT id, slug, title, content, description, category, tags, status, password, is_hidden, deleted_at, published_at
       FROM posts
       WHERE id = ?`
    )
    .bind(postId)
    .first<PublicPostRow>()
}

function isIndexablePost(post: PublicPostRow | null): post is PublicPostRow {
  return Boolean(
    post &&
    post.status === 'published' &&
    !post.password &&
    post.is_hidden === 0 &&
    post.deleted_at == null
  )
}

export async function syncPostToRelatedIndex(
  env: Partial<CloudflareEnv> | null | undefined,
  postId: number,
): Promise<'synced' | 'skipped' | 'deleted'> {
  if (!isVectorizeEnabled(env) || !env.DB) return 'skipped'

  const post = await getPostForIndexing(env.DB, postId)
  if (!isIndexablePost(post)) {
    if (env.VECTOR_INDEX.deleteByIds) {
      await env.VECTOR_INDEX.deleteByIds([`post:${postId}`])
      return 'deleted'
    }
    return 'skipped'
  }

  const dimensions = await getVectorDimensions(env.VECTOR_INDEX)
  const values = buildHashedEmbedding(buildPostVectorText({
    title: post.title,
    description: post.description,
    category: post.category,
    tags: post.tags,
    content: post.content,
  }), dimensions)

  await env.VECTOR_INDEX.upsert([
    {
      id: `post:${post.id}`,
      namespace: VECTOR_NAMESPACE,
      values,
      metadata: {
        slug: post.slug,
        title: post.title,
        category: post.category || '',
        tags: parseTags(post.tags),
        published_at: post.published_at,
      },
    },
  ])

  return 'synced'
}

export async function deletePostFromRelatedIndex(
  env: Partial<CloudflareEnv> | null | undefined,
  postId: number,
): Promise<void> {
  if (!isVectorizeEnabled(env) || !env.VECTOR_INDEX.deleteByIds) return
  await env.VECTOR_INDEX.deleteByIds([`post:${postId}`])
}
