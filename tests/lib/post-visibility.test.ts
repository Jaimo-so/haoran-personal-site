import { describe, expect, it } from 'vitest'

import { isPubliclyAccessiblePost, isSearchIndexablePost } from '@/lib/db'

describe('post visibility rules', () => {
  it('allows published unlisted posts to be opened by direct link', () => {
    expect(
      isPubliclyAccessiblePost({
        status: 'published',
        deleted_at: null,
      }),
    ).toBe(true)
  })

  it('rejects drafts and deleted posts from the public route', () => {
    expect(
      isPubliclyAccessiblePost({
        status: 'draft',
        deleted_at: null,
      }),
    ).toBe(false)

    expect(
      isPubliclyAccessiblePost({
        status: 'published',
        deleted_at: 1710000000,
      }),
    ).toBe(false)
  })

  it('keeps unlisted and encrypted posts out of search indexing', () => {
    expect(
      isSearchIndexablePost({
        status: 'published',
        password: null,
        is_hidden: 1,
        deleted_at: null,
      }),
    ).toBe(false)

    expect(
      isSearchIndexablePost({
        status: 'published',
        password: 'secret',
        is_hidden: 0,
        deleted_at: null,
      }),
    ).toBe(false)

    expect(
      isSearchIndexablePost({
        status: 'published',
        password: null,
        is_hidden: 0,
        deleted_at: null,
      }),
    ).toBe(true)
  })
})
