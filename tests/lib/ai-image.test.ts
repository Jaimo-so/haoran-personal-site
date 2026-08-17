import { afterEach, describe, expect, it, vi } from 'vitest'

import { runWorkersAiCompatImageRequest } from '@/lib/ai-image'

describe('ai-image workers ai compat image request', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retries with multipart form data when the model requires multipart input', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: "required properties at '/' are 'multipart'" }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ image: Buffer.from('fake-image').toString('base64') }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ))

    vi.stubGlobal('fetch', fetchMock)

    const result = await runWorkersAiCompatImageRequest(
      {
        apiKey: 'test-key',
        baseURL: 'https://api.cloudflare.com/client/v4/accounts/test-account/ai/v1',
        model: '@cf/black-forest-labs/flux-2-dev',
      },
      {
        prompt: '生成封面图',
        width: 1344,
        height: 768,
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      }),
    })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-key',
      }),
    })
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBeInstanceOf(FormData)
    expect(result).toEqual({
      image: Buffer.from('fake-image').toString('base64'),
    })
  })

  it('returns the raw response when workers ai sends back an image stream', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      {
        status: 200,
        headers: { 'content-type': 'image/png' },
      },
    ))

    vi.stubGlobal('fetch', fetchMock)

    const result = await runWorkersAiCompatImageRequest(
      {
        apiKey: 'test-key',
        baseURL: 'https://api.cloudflare.com/client/v4/accounts/test-account/ai/v1',
        model: '@cf/black-forest-labs/flux-2-dev',
      },
      {
        prompt: '生成封面图',
        width: 1344,
        height: 768,
      },
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get('content-type')).toBe('image/png')
  })
})
