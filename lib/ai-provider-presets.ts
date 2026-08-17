export type AIProviderCategory = '海外大模型' | '海外聚合' | '国内大模型' | '国内聚合'

export interface AIProviderPreset {
  id: string
  name: string
  providerType: 'openai_compatible' | 'gemini'
  category: AIProviderCategory
  baseUrl: string
  defaultModel: string
  quickModels: string[]
  apiKeyUrl?: string
  description: string
  recommended?: boolean
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'workers_ai',
    name: 'Cloudflare Workers AI',
    providerType: 'openai_compatible',
    category: '海外大模型',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/ai/v1',
    defaultModel: '@cf/meta/llama-3.1-8b-instruct',
    quickModels: [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/openai/gpt-oss-120b',
      '@cf/openai/gpt-oss-20b',
      '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    ],
    apiKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    description: 'Cloudflare 官方 Workers AI。使用 API Token，Base URL 里的 <ACCOUNT_ID> 需替换为你的账号 ID。',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    providerType: 'openai_compatible',
    category: '海外聚合',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    quickModels: [
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o-mini',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-chat',
    ],
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    description: '多模型聚合平台，模型最全',
    recommended: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    providerType: 'openai_compatible',
    category: '海外大模型',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    quickModels: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    description: 'OpenAI 官方接口',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    providerType: 'openai_compatible',
    category: '海外大模型',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4-0709',
    quickModels: ['grok-4-0709', 'grok-3-mini'],
    apiKeyUrl: 'https://console.x.ai/team/api-keys',
    description: 'xAI 官方 Grok',
  },
  {
    id: 'groq',
    name: 'Groq',
    providerType: 'openai_compatible',
    category: '海外聚合',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    quickModels: ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'gemma2-9b-it'],
    apiKeyUrl: 'https://console.groq.com/keys',
    description: '高吞吐低延迟',
  },
  {
    id: 'together',
    name: 'Together',
    providerType: 'openai_compatible',
    category: '海外聚合',
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'deepseek-ai/DeepSeek-R1-0528',
    quickModels: ['deepseek-ai/DeepSeek-R1-0528', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
    apiKeyUrl: 'https://api.together.ai/settings/api-keys',
    description: '开源模型聚合',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    providerType: 'openai_compatible',
    category: '国内大模型',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    quickModels: ['deepseek-chat', 'deepseek-reasoner'],
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    description: 'DeepSeek 官方',
    recommended: true,
  },
  {
    id: 'moonshot',
    name: 'Kimi (Moonshot)',
    providerType: 'openai_compatible',
    category: '国内大模型',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    quickModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    description: '月之暗面 Kimi',
  },
  {
    id: 'zhipu',
    name: '智谱',
    providerType: 'openai_compatible',
    category: '国内大模型',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
    quickModels: ['glm-4-plus', 'glm-4-flash'],
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
    description: '智谱 GLM 系列',
  },
  {
    id: 'qwen',
    name: '阿里百炼',
    providerType: 'openai_compatible',
    category: '国内大模型',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-max',
    quickModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    apiKeyUrl: 'https://bailian.console.aliyun.com/?tab=model#/api-key',
    description: '通义千问',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    providerType: 'openai_compatible',
    category: '国内聚合',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    quickModels: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    apiKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
    description: '国产聚合平台',
    recommended: true,
  },
  {
    id: 'doubao',
    name: '火山方舟',
    providerType: 'openai_compatible',
    category: '国内大模型',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'ep-20250616135538-zdz4b',
    quickModels: ['ep-20250616135538-zdz4b'],
    apiKeyUrl: 'https://www.volcengine.com/experience/ark',
    description: '豆包 / 火山引擎',
  },
  {
    id: 'aihubmix',
    name: 'AiHubMix',
    providerType: 'openai_compatible',
    category: '国内聚合',
    baseUrl: 'https://aihubmix.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    quickModels: ['claude-sonnet-4-20250514', 'o3-mini', 'gemini-2.5-pro-search'],
    apiKeyUrl: 'https://aihubmix.com/token',
    description: '国内聚合平台',
  },
]

export const AI_PROVIDER_MAP = Object.fromEntries(
  AI_PROVIDER_PRESETS.map(preset => [preset.id, preset]),
) as Record<string, AIProviderPreset>

export const AI_PROVIDER_CATEGORIES: AIProviderCategory[] = [
  '海外大模型',
  '海外聚合',
  '国内大模型',
  '国内聚合',
]
