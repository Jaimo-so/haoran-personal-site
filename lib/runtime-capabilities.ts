export interface RuntimeCapabilities {
  bindings: {
    d1: boolean
    cache: boolean
    images: boolean
    queue: boolean
    workersAI: boolean
    vectorize: boolean
  }
  features: {
    asyncJobs: {
      enabled: boolean
      strategy: 'queue' | 'inline'
      note: string
    }
    aiInference: {
      enabled: boolean
      strategy: 'workers-ai' | 'external-provider' | 'disabled'
      note: string
    }
    mediaPipeline: {
      enabled: boolean
      strategy: 'cloudflare' | 'client'
      note: string
    }
    relatedContent: {
      enabled: boolean
      strategy: 'vectorize' | 'fts'
      note: string
    }
  }
}

function readFlag(value: unknown): boolean {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

export function detectRuntimeCapabilities(env?: Partial<CloudflareEnv> | null): RuntimeCapabilities {
  const bindings = {
    d1: Boolean(env?.DB),
    cache: Boolean(env?.CACHE),
    images: Boolean(env?.IMAGES),
    queue: Boolean(env?.BACKGROUND_QUEUE),
    workersAI: Boolean(env?.WORKERS_AI),
    vectorize: Boolean(env?.VECTOR_INDEX),
  }

  const asyncJobsEnabled = bindings.queue && readFlag(env?.ENABLE_BACKGROUND_JOBS)
  const workersAIEnabled = bindings.workersAI && readFlag(env?.ENABLE_WORKERS_AI)
  const vectorizeEnabled = bindings.vectorize && readFlag(env?.ENABLE_VECTOR_SEARCH)
  const cloudflareMediaEnabled = bindings.images && readFlag(env?.ENABLE_CF_IMAGE_PIPELINE)

  return {
    bindings,
    features: {
      asyncJobs: {
        enabled: asyncJobsEnabled,
        strategy: asyncJobsEnabled ? 'queue' : 'inline',
        note: asyncJobsEnabled
          ? '优先使用 Cloudflare Queues，失败时回退到 waitUntil / inline。'
          : '回退到 waitUntil 或请求内执行，不依赖付费资源。',
      },
      aiInference: {
        enabled: workersAIEnabled || Boolean(env?.AI_API_KEY),
        strategy: workersAIEnabled
          ? 'workers-ai'
          : env?.AI_API_KEY
            ? 'external-provider'
            : 'disabled',
        note: workersAIEnabled
          ? '优先走 Workers AI。'
          : env?.AI_API_KEY
            ? '回退到外部 OpenAI 兼容服务商。'
            : '未配置 AI，相关增强保持可选关闭。',
      },
      mediaPipeline: {
        enabled: true,
        strategy: cloudflareMediaEnabled ? 'cloudflare' : 'client',
        note: cloudflareMediaEnabled
          ? '启用 Cloudflare 图片派生/压缩链。'
          : '默认使用浏览器侧压缩，R2 原链路仍可用。',
      },
      relatedContent: {
        enabled: true,
        strategy: vectorizeEnabled ? 'vectorize' : 'fts',
        note: vectorizeEnabled
          ? '使用 Vectorize 做语义召回。'
          : '回退到 D1/FTS 与规则召回，不阻塞开源部署。',
      },
    },
  }
}
