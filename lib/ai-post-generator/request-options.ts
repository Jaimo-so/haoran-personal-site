import { isWorkersAiBaseUrl, normalizeBaseUrl } from '@/lib/ai-provider-profiles'

type TextGenerationRequestOptionsInput =
  | {
      strategy: 'workers-ai'
      model: string
    }
  | {
      strategy: 'external-provider'
      model: string
      baseURL: string
    }

function isCloudflareZaiModel(model: string): boolean {
  return /@cf\/zai-org\//i.test(model.trim())
}

function isZhipuBaseUrl(baseURL: string): boolean {
  return /bigmodel\.cn/i.test(normalizeBaseUrl(baseURL))
}

export function buildTextGenerationRequestOptions(
  input: TextGenerationRequestOptionsInput,
): Record<string, unknown> {
  if (input.strategy === 'workers-ai') {
    return isCloudflareZaiModel(input.model)
      ? { chat_template_kwargs: { enable_thinking: false } }
      : {}
  }

  if (isWorkersAiBaseUrl(input.baseURL) && isCloudflareZaiModel(input.model)) {
    return { chat_template_kwargs: { enable_thinking: false } }
  }

  if (isZhipuBaseUrl(input.baseURL)) {
    return { thinking: { type: 'disabled' } }
  }

  return {}
}
