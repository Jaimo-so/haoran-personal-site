import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteCache,
  getCacheKey,
  getCached,
  getCacheNamespace,
  getPublicContentCacheNamespace,
  invalidateCache,
  invalidatePublicContentCache,
  shouldUsePublicContentCache,
} from '@/lib/cache'

type MockKV = {
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function createKvMock(): MockKV {
  return {
    get: vi.fn(),
    put: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
  }
}

describe('cache helpers', () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalEnableCacheInDev = process.env.ENABLE_PUBLIC_CACHE_IN_DEV

  beforeEach(() => {
    delete process.env.ENABLE_PUBLIC_CACHE_IN_DEV
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    if (originalEnableCacheInDev === undefined) {
      delete process.env.ENABLE_PUBLIC_CACHE_IN_DEV
    } else {
      process.env.ENABLE_PUBLIC_CACHE_IN_DEV = originalEnableCacheInDev
    }
  })

  it('resolves the cache namespace from CACHE first and falls back to KV', () => {
    const cache = createKvMock()
    const kv = createKvMock()

    expect(getCacheNamespace({ CACHE: cache as never, KV: kv as never })).toBe(cache)
    expect(getCacheNamespace({ KV: kv as never })).toBe(kv)
    expect(getCacheNamespace({})).toBeUndefined()
  })

  it('enables public cache in production or when dev flag is on', () => {
    const cache = createKvMock()

    process.env.NODE_ENV = 'production'
    expect(shouldUsePublicContentCache({ CACHE: cache as never })).toBe(true)

    process.env.NODE_ENV = 'test'
    process.env.ENABLE_PUBLIC_CACHE_IN_DEV = 'true'
    expect(shouldUsePublicContentCache({ CACHE: cache as never })).toBe(true)
    expect(getPublicContentCacheNamespace({ CACHE: cache as never })).toBe(cache)
  })

  it('returns false when cache is unavailable or disabled in dev', async () => {
    const cache = createKvMock()

    expect(shouldUsePublicContentCache({})).toBe(false)
    expect(getPublicContentCacheNamespace({ CACHE: cache as never })).toBeUndefined()
    await expect(invalidatePublicContentCache({ CACHE: cache as never })).resolves.toBe(false)
  })

  it('reads cached values before invoking the fetcher and writes misses asynchronously', async () => {
    const kv = createKvMock()
    const fetcher = vi.fn(async () => ({ value: 2 }))

    kv.get.mockResolvedValueOnce({ value: 1 })
    await expect(getCached(kv as never, 'cache:key', fetcher)).resolves.toEqual({ value: 1 })
    expect(fetcher).not.toHaveBeenCalled()

    kv.get.mockResolvedValueOnce(null)
    await expect(getCached(kv as never, 'cache:key', fetcher, 120)).resolves.toEqual({ value: 2 })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(kv.put).toHaveBeenCalledWith('cache:key', JSON.stringify({ value: 2 }), { expirationTtl: 120 })
  })

  it('increments cache version, builds versioned keys, and deletes direct keys', async () => {
    const kv = createKvMock()

    kv.get.mockResolvedValueOnce('3')
    await invalidateCache(kv as never)
    expect(kv.put).toHaveBeenCalledWith('cache:version', '4')

    kv.get.mockResolvedValueOnce('9')
    await expect(getCacheKey(kv as never, 'posts:index')).resolves.toBe('posts:index:v9')

    kv.get.mockResolvedValueOnce(null)
    await expect(getCacheKey(kv as never, 'posts:index')).resolves.toBe('posts:index')

    await deleteCache(kv as never, 'posts:index:v9')
    expect(kv.delete).toHaveBeenCalledWith('posts:index:v9')
  })
})
