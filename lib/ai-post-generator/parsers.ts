import { buildAutoDescription, normalizePostSlug } from '@/lib/post-utils'
import { MAX_SUMMARY_LENGTH, MAX_TAGS } from '@/lib/ai-post-generator/constants'
import type { AiPostGeneratorTarget } from '@/lib/ai-post-generator/types'

function stripCodeFence(value: string): string {
  const trimmed = value.trim()
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fencedMatch?.[1]) return fencedMatch[1].trim()
  return trimmed
}

export function parseJsonValue(value: string): unknown {
  const normalized = stripCodeFence(value)
  if (!normalized) return null

  try {
    return JSON.parse(normalized)
  } catch {
    // fall through
  }

  const candidates = [
    normalized.match(/\{[\s\S]*\}/)?.[0] || '',
    normalized.match(/\[[\s\S]*\]/)?.[0] || '',
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // ignore candidate parse error
    }
  }

  return null
}

function unwrapGeneratedPayload(value: unknown): unknown {
  let current = value

  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return current
    }

    const record = current as Record<string, unknown>
    const nested = record.result ?? record.data ?? record.output
    if (nested === undefined) return current
    current = nested
  }

  return current
}

function readObjectValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

export function extractGeneratedText(
  parsed: unknown,
  fallbackText: string,
  preferredKeys: string[],
): string {
  const normalizedFallback = stripCodeFence(fallbackText)
  const payload = unwrapGeneratedPayload(parsed)

  if (typeof payload === 'string') return payload.trim()

  if (Array.isArray(payload)) {
    return payload.map((item) => String(item || '').trim()).filter(Boolean).join(', ').trim()
  }

  if (payload && typeof payload === 'object') {
    const candidate = readObjectValue(payload as Record<string, unknown>, preferredKeys)
    if (typeof candidate === 'string') return candidate.trim()
    if (Array.isArray(candidate)) {
      return candidate.map((item) => String(item || '').trim()).filter(Boolean).join(', ').trim()
    }
  }

  return normalizedFallback
}

export function normalizeTags(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,，、\n]/)
      : []

  const seen = new Set<string>()
  const tags: string[] = []

  for (const item of rawItems) {
    const tag = String(item || '')
      .trim()
      .replace(/^#/, '')
      .replace(/^(?:[-*•]+|\d+[.)])\s*/, '')
      .replace(/\s+/g, ' ')
      .slice(0, 24)

    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
    if (tags.length >= MAX_TAGS) break
  }

  return tags
}

export function extractGeneratedTags(parsed: unknown, fallbackText: string) {
  const payload = unwrapGeneratedPayload(parsed)

  if (Array.isArray(payload)) {
    return normalizeTags(payload)
  }

  if (payload && typeof payload === 'object') {
    const candidate = readObjectValue(
      payload as Record<string, unknown>,
      ['tags', 'keywords', 'labels', 'topics', 'items', 'list', 'result'],
    )
    const normalized = normalizeTags(candidate)
    if (normalized.length > 0) return normalized
  }

  return normalizeTags(stripCodeFence(fallbackText))
}

function extractWorkersAiPayload(result: unknown): unknown {
  if (result && typeof result === 'object') {
    const payload = result as {
      response?: unknown
      result?: { response?: unknown } | unknown
      choices?: Array<{ message?: { content?: unknown } }>
    }

    if (payload.response !== undefined) return payload.response
    if (payload.result && typeof payload.result === 'object' && 'response' in payload.result) {
      return (payload.result as { response?: unknown }).response
    }
    const firstChoice = payload.choices?.[0]?.message?.content
    if (firstChoice !== undefined) return firstChoice
  }

  return result
}

export function extractWorkersAiText(result: unknown): string {
  const payload = extractWorkersAiPayload(result)

  if (typeof payload === 'string') return payload.trim()
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'text' in item) {
          return String((item as { text?: unknown }).text || '')
        }
        return ''
      })
      .join('')
      .trim()
  }
  if (payload && typeof payload === 'object') return JSON.stringify(payload)
  return payload == null ? '' : String(payload).trim()
}

export function getWorkersAiAssistantPayload(response: unknown) {
  const choice = (response as {
    choices?: Array<{
      finish_reason?: string | null
      stop_reason?: string | null
      message?: {
        content?: unknown
        reasoning_content?: unknown
        reasoning?: unknown
        tool_calls?: unknown
        function_call?: unknown
      }
    }>
  })?.choices?.[0]

  if (!choice) {
    return {
      content: extractWorkersAiText(response),
      reasoning: '',
      finishReason: '',
    }
  }

  const message = choice.message || {}
  const content = coerceAssistantText(message.content)
  const toolCallArguments = extractToolCallArguments(message.tool_calls ?? message.function_call)
  return {
    content: content || toolCallArguments,
    reasoning: coerceAssistantText(message.reasoning_content ?? message.reasoning),
    finishReason: choice.finish_reason || choice.stop_reason || '',
  }
}

export function truncateText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized || maxLength <= 0) return ''
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

function coerceAssistantText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceAssistantText(item))
      .join('')
      .trim()
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const nested = record.text ?? record.content ?? record.value ?? record.arguments ?? record.output_text
    if (nested !== undefined) {
      return coerceAssistantText(nested)
    }
  }
  return ''
}

function extractToolCallArguments(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value)) {
    return value
      .map((item) => extractToolCallArguments(item))
      .filter(Boolean)
      .join('\n')
      .trim()
  }
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.function && typeof record.function === 'object') {
      const functionRecord = record.function as Record<string, unknown>
      const functionArgs = coerceAssistantText(functionRecord.arguments ?? functionRecord.content ?? functionRecord.text)
      if (functionArgs) return functionArgs
    }

    const directArgs = coerceAssistantText(record.arguments ?? record.content ?? record.text)
    if (directArgs) return directArgs
  }
  return ''
}

export function getExternalAssistantPayload(response: unknown) {
  const choice = (response as {
    choices?: Array<{
      finish_reason?: string | null
      message?: {
        content?: unknown
        reasoning_content?: unknown
        reasoning?: unknown
        tool_calls?: unknown
        function_call?: unknown
      }
    }>
  })?.choices?.[0]

  const message = choice?.message || {}
  const content = coerceAssistantText(message.content)
  const toolCallArguments = extractToolCallArguments(message.tool_calls ?? message.function_call)
  return {
    content: content || toolCallArguments,
    reasoning: coerceAssistantText(message.reasoning_content ?? message.reasoning),
    finishReason: choice?.finish_reason || '',
  }
}

export function shouldRetryAssistantPayload(payload: {
  content?: string
  reasoning?: string
  finishReason?: string
}) {
  return !payload.content
    && (!!payload.reasoning || payload.finishReason === 'length' || payload.finishReason === 'tool_calls')
}

export function buildPlainRetryInstruction(target: Exclude<AiPostGeneratorTarget, 'cover'>) {
  if (target === 'summary') {
    return 'If JSON mode is unavailable, return only the final Chinese summary sentence. No JSON keys, no bullets, no quotes, and no reasoning.'
  }
  if (target === 'tags') {
    return 'If JSON mode is unavailable, return only 3-5 Chinese tags separated by commas. No numbering, no explanation, and no reasoning.'
  }
  return 'If JSON mode is unavailable, return only the final lowercase kebab-case slug. No JSON keys, no quotes, no "slug:" prefix, and no reasoning.'
}

export function normalizeSummary(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  const normalized = truncateText(text || fallback, MAX_SUMMARY_LENGTH)
  if (normalized.length < MAX_SUMMARY_LENGTH) return normalized

  const boundary = Math.max(
    normalized.lastIndexOf('。'),
    normalized.lastIndexOf('！'),
    normalized.lastIndexOf('？'),
    normalized.lastIndexOf('；'),
  )

  if (boundary >= Math.floor(MAX_SUMMARY_LENGTH * 0.55)) {
    return normalized.slice(0, boundary + 1).trim()
  }

  return normalized
}

export function normalizeGeneratedSlug(value: unknown, fallbackTitle: string) {
  const rawCandidate = String(value || fallbackTitle || '').trim()
  const candidate = rawCandidate
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .replace(/^slug\s*[:：-]\s*/i, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/_/g, ' ')
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .replace(/\s+/g, '-')

  return normalizePostSlug(candidate)
}

export function buildFallbackSummary(title: string, content: string) {
  return buildAutoDescription(`${title} ${content}`.trim())
}
