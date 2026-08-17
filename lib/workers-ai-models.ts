type WorkersAiTask =
  | string
  | {
      id?: string
      name?: string
      description?: string
    }

export type RawWorkersAiModelItem =
  | string
  | {
      id?: string
      name?: string
      model?: string
      slug?: string
      task?: WorkersAiTask
      task_name?: WorkersAiTask
      sub_type?: string
      subType?: string
      type?: string
      category?: string
      tags?: string[] | string
    }

function normalizeSearchValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''

  const candidate = value as { name?: string; description?: string; id?: string }
  return [candidate.name, candidate.description, candidate.id].filter(Boolean).join(' ')
}

function isModelLikeValue(value: string): boolean {
  const normalized = value.trim()
  if (!normalized) return false
  if (normalized.startsWith('@')) return true
  if (/\s/.test(normalized)) return false
  return /[/:._-]/.test(normalized)
}

function resolveModelId(item: RawWorkersAiModelItem): string {
  if (typeof item === 'string') return item.trim()

  const candidateNames = [
    item.model,
    item.slug,
    isModelLikeValue(item.name || '') ? item.name : '',
    item.id,
    item.name,
  ]

  for (const candidate of candidateNames) {
    const normalized = `${candidate || ''}`.trim()
    if (normalized) return normalized
  }

  return ''
}

function buildProviderErrorMessage(resStatus: number, resStatusText: string, rawBody: string): string {
  try {
    if (rawBody) {
      const parsed = JSON.parse(rawBody) as {
        error?: { message?: string } | string
        message?: string
      }
      if (typeof parsed.error === 'object' && parsed.error?.message) {
        return parsed.error.message
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim()
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim()
      }
    }
  } catch {
    // ignore parse error
  }

  const fallbackRaw = rawBody.trim()
  if (fallbackRaw) return fallbackRaw.slice(0, 500)
  return `HTTP ${resStatus}: ${resStatusText}`
}

export function extractCloudflareAccountId(baseUrl: string): string {
  const match = baseUrl.trim().replace(/\/+$/, '').match(/accounts\/([^/]+)\/ai(?:\/|$)/i)
  const accountId = match?.[1] || ''
  return /<account_id>/i.test(accountId) ? '' : accountId
}

export function extractWorkersAiModelItems(payload: unknown): RawWorkersAiModelItem[] {
  if (Array.isArray(payload)) return payload as RawWorkersAiModelItem[]
  if (!payload || typeof payload !== 'object') return []

  const candidate = payload as {
    result?: unknown
    data?: unknown
    items?: unknown
    models?: unknown
  }

  return [candidate.result, candidate.data, candidate.items, candidate.models]
    .flatMap((value) => (Array.isArray(value) ? value as RawWorkersAiModelItem[] : []))
}

export function filterWorkersAiModels(
  items: RawWorkersAiModelItem[],
  kind: 'text' | 'image',
): RawWorkersAiModelItem[] {
  const filtered = items.filter((item) => {
    const resolvedId = resolveModelId(item).toLowerCase()

    if (typeof item === 'string') {
      return kind === 'image'
        ? /(image|text-to-image|diffusion|flux|sdxl|dreamshaper|vision)/.test(resolvedId)
        : !/(image|text-to-image|diffusion|flux|sdxl|dreamshaper|embedding|bge|rerank|audio|tts|whisper)/.test(resolvedId)
    }

    const haystacks = [
      normalizeSearchValue(item.task),
      normalizeSearchValue(item.task_name),
      item.sub_type,
      item.subType,
      item.type,
      item.category,
      Array.isArray(item.tags) ? item.tags.join(' ') : item.tags,
      item.name,
      item.model,
      item.slug,
      item.id,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())

    if (kind === 'image') {
      return haystacks.some((value) => /(image generation|text-to-image|image|diffusion|flux|sdxl|dreamshaper|vision)/.test(value))
    }

    return haystacks.some((value) => /(text generation|text-generation|chat|llm|language|reasoning)/.test(value))
      || !haystacks.some((value) => /(image|text-to-image|diffusion|flux|sdxl|dreamshaper|embedding|bge|rerank|audio|tts|whisper)/.test(value))
  })

  return filtered.length > 0 ? filtered : items
}

export function buildWorkersAiModelOptions(
  items: RawWorkersAiModelItem[],
  fallbackIds: string[] = [],
): Array<{ id: string; name: string }> {
  const ids = new Set<string>()

  for (const item of items) {
    const id = resolveModelId(item)
    if (id) ids.add(id)
  }

  for (const fallbackId of fallbackIds) {
    const normalized = fallbackId.trim()
    if (normalized) ids.add(normalized)
  }

  return Array.from(ids)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((id) => ({ id, name: id }))
}

export async function fetchWorkersAiModels(
  accountId: string,
  apiToken: string,
  kind: 'text' | 'image',
  fallbackIds: string[] = [],
): Promise<Array<{ id: string; name: string }>> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=100`
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const rawBody = await res.text().catch(() => '')
    throw new Error(buildProviderErrorMessage(res.status, res.statusText, rawBody))
  }

  const data = await res.json().catch(() => null)
  const items = filterWorkersAiModels(extractWorkersAiModelItems(data), kind)
  return buildWorkersAiModelOptions(items, fallbackIds)
}
