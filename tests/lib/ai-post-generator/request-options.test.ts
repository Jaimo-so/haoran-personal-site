import { describe, expect, it } from 'vitest'
import { buildTextGenerationRequestOptions } from '@/lib/ai-post-generator/request-options'

describe('ai-post-generator/request-options', () => {
  it('disables thinking for zhipu-compatible profiles', () => {
    expect(buildTextGenerationRequestOptions({
      strategy: 'external-provider',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-5.1',
    })).toEqual({ thinking: { type: 'disabled' } })
  })

  it('disables thinking for Cloudflare zai models over workers ai endpoints', () => {
    expect(buildTextGenerationRequestOptions({
      strategy: 'external-provider',
      baseURL: 'https://api.cloudflare.com/client/v4/accounts/demo/ai/v1',
      model: '@cf/zai-org/glm-4.7-flash',
    })).toEqual({ chat_template_kwargs: { enable_thinking: false } })
  })

  it('disables thinking for Cloudflare zai models on workers bindings', () => {
    expect(buildTextGenerationRequestOptions({
      strategy: 'workers-ai',
      model: '@cf/zai-org/glm-4.7-flash',
    })).toEqual({ chat_template_kwargs: { enable_thinking: false } })
  })

  it('leaves unrelated providers untouched', () => {
    expect(buildTextGenerationRequestOptions({
      strategy: 'external-provider',
      baseURL: 'https://api.siliconflow.cn/v1',
      model: 'zai-org/GLM-4.6',
    })).toEqual({})
  })
})
