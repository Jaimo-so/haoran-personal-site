export type AIImageProviderCategory = '官方' | '自定义兼容'

export interface AIImageProviderPreset {
  id: string
  name: string
  providerType: 'openai_images'
  category: AIImageProviderCategory
  baseUrl: string
  defaultModel: string
  quickModels: string[]
  apiKeyUrl?: string
  description: string
  recommended?: boolean
}

export const AI_IMAGE_PROVIDER_PRESETS: AIImageProviderPreset[] = [
  {
    id: 'tuzi',
    name: '兔子 API',
    providerType: 'openai_images',
    category: '自定义兼容',
    baseUrl: 'https://api.tu-zi.com/v1',
    defaultModel: 'gemini-2.5-flash-image',
    quickModels: ['gemini-2.5-flash-image', 'gpt-image-1', 'dall-e-3'],
    apiKeyUrl: 'https://api.tu-zi.com/register?aff=yyaz',
    description: 'TuZi / 兔子 OpenAI 兼容生图接口',
    recommended: true,
  },
  {
    id: 'openai',
    name: 'OpenAI Images',
    providerType: 'openai_images',
    category: '官方',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-image-1',
    quickModels: ['gpt-image-1', 'gpt-image-1-mini', 'dall-e-3'],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI 官方文生图接口',
    recommended: true,
  },
  {
    id: 'doubao',
    name: '火山方舟',
    providerType: 'openai_images',
    category: '自定义兼容',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'ep-20250916145609-9bqzl',
    quickModels: ['ep-20250916145609-9bqzl', 'doubao-seedream-4-0-250828'],
    apiKeyUrl: 'https://www.volcengine.com/experience/ark',
    description: '豆包 / 火山引擎 OpenAI 兼容生图接口',
  },
]

export const AI_IMAGE_PROVIDER_MAP = Object.fromEntries(
  AI_IMAGE_PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
) as Record<string, AIImageProviderPreset>

export const AI_IMAGE_PROVIDER_CATEGORIES: AIImageProviderCategory[] = ['官方', '自定义兼容']
