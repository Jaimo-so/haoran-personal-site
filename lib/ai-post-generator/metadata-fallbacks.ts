import { MAX_TAGS } from '@/lib/ai-post-generator/constants'
import {
  extractGeneratedText,
  extractGeneratedTags,
  normalizeGeneratedSlug,
  normalizeTags,
  parseJsonValue,
} from '@/lib/ai-post-generator/parsers'
import { normalizePostSlug } from '@/lib/post-utils'
import type { GeneratePostMetadataInput } from '@/lib/ai-post-generator/types'

type MetadataFallbackInput = Omit<GeneratePostMetadataInput, 'target' | 'db' | 'env'> & {
  resultText: string
  reasoningText?: string
}

const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'into',
  'is',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'your',
])

const GENERIC_TAGS = new Set([
  '文章',
  '博客',
  '内容',
  '标题',
  '摘要',
  '总结',
  '分享',
  '方法',
  '指南',
  '教程',
  '案例',
  '实践',
  '问题',
  '方案',
  '系统',
  '功能',
  '功能设计',
  '开发',
  '实现',
])

function collectMatches(value: string, pattern: RegExp, pick: (match: RegExpExecArray) => string) {
  const matches: string[] = []

  for (const match of value.matchAll(pattern)) {
    const candidate = pick(match).trim()
    if (candidate) matches.push(candidate)
  }

  return matches
}

function getLastNonEmpty(values: string[]) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]?.trim()
    if (value) return value
  }
  return ''
}

function extractSlugFromReasoning(reasoningText: string) {
  const normalized = reasoningText.trim()
  if (!normalized) return ''

  const explicitJson = getLastNonEmpty(collectMatches(
    normalized,
    /"slug"\s*:\s*"([^"]+)"/gi,
    (match) => match[1] || '',
  ))
  if (explicitJson) return explicitJson

  const explicitLine = getLastNonEmpty(collectMatches(
    normalized,
    /(?:^|\n)\s*(?:slug|final(?: answer| output)?|answer|output)\s*[:：-]\s*([^\n]+)/gi,
    (match) => match[1] || '',
  ))
  if (explicitLine) return explicitLine

  const parsed = parseJsonValue(normalized)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const slug = (parsed as { slug?: unknown }).slug
    if (typeof slug === 'string' && slug.trim()) return slug.trim()
  }

  return ''
}

function extractTagsFromReasoning(reasoningText: string) {
  const normalized = reasoningText.trim()
  if (!normalized) return []

  const jsonCandidates = collectMatches(
    normalized,
    /"tags"\s*:\s*\[([\s\S]*?)\]/gi,
    (match) => `{"tags":[${match[1] || ''}]}`,
  )

  for (let index = jsonCandidates.length - 1; index >= 0; index -= 1) {
    const candidate = jsonCandidates[index]
    const parsed = parseJsonValue(candidate)
    const tags = extractGeneratedTags(parsed, candidate)
    if (tags.length > 0) return tags
  }

  const lineCandidate = getLastNonEmpty(collectMatches(
    normalized,
    /(?:^|\n)\s*(?:tags?|keywords?|labels?)\s*[:：-]\s*([^\n]+)/gi,
    (match) => match[1] || '',
  ))
  if (lineCandidate) {
    const tags = normalizeTags(lineCandidate)
    if (tags.length > 0) return tags
  }

  const tailLines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*•]+|\d+[.)])\s*\S+/.test(line))
    .slice(-MAX_TAGS)
    .map((line) => line.replace(/^(?:[-*•]+|\d+[.)])\s*/, ''))

  return normalizeTags(tailLines)
}

function addUnique(candidates: string[], seen: Set<string>, value: string, maxLength = 24) {
  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^#/, '')
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .slice(0, maxLength)

  if (!normalized) return
  if (seen.has(normalized)) return
  seen.add(normalized)
  candidates.push(normalized)
}

function collectEnglishTagCandidates(value: string) {
  return collectMatches(
    value,
    /[A-Za-z][A-Za-z0-9.+/#-]*(?:\s+[A-Za-z0-9.+/#-]+){0,2}/g,
    (match) => match[0] || '',
  )
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item.length >= 2 && item.length <= 24)
}

function collectChineseTagCandidates(value: string) {
  return value
    .split(/[\n,，。！？!?:：;；、|｜/\\()（）【】《》"'“”‘’]+/)
    .map((item) => item
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(?:讲清楚|聊聊|说说|解析|解读|关于|如何|为什么)\s*/u, '')
      .trim())
    .filter((item) => item.length >= 2 && item.length <= 16)
    .filter((item) => !GENERIC_TAGS.has(item))
}

function buildContextTags(input: Omit<MetadataFallbackInput, 'resultText' | 'reasoningText'>) {
  const candidates: string[] = []
  const seen = new Set<string>()

  for (const tag of input.tags || []) {
    addUnique(candidates, seen, tag)
  }

  addUnique(candidates, seen, input.category || '')

  for (const value of [input.title || '', input.description || '']) {
    for (const candidate of collectEnglishTagCandidates(value)) {
      addUnique(candidates, seen, candidate)
    }
    for (const candidate of collectChineseTagCandidates(value)) {
      addUnique(candidates, seen, candidate)
    }
    for (const candidate of collectChineseTagCandidates(value.replace(/[A-Za-z0-9.+/#-]+/g, ' '))) {
      addUnique(candidates, seen, candidate)
    }
  }

  for (const candidate of collectEnglishTagCandidates((input.content || '').slice(0, 1200))) {
    addUnique(candidates, seen, candidate)
    if (candidates.length >= MAX_TAGS) break
  }

  return candidates.slice(0, MAX_TAGS)
}

function collectSlugWords(value: string) {
  const words = collectMatches(
    value,
    /[A-Za-z][A-Za-z0-9.+/#-]*/g,
    (match) => match[0] || '',
  )

  return words
    .map((word) => word.toLowerCase().replace(/[^a-z0-9-]+/g, ''))
    .filter(Boolean)
    .filter((word) => !ENGLISH_STOP_WORDS.has(word))
}

function buildEnglishSlugFallback(...values: string[]) {
  const words: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    for (const word of collectSlugWords(value)) {
      if (seen.has(word)) continue
      seen.add(word)
      words.push(word)
      if (words.length >= 5) {
        return normalizeGeneratedSlug(words.join('-'), '')
      }
    }
  }

  return normalizeGeneratedSlug(words.join('-'), '')
}

function createStableSlugSeed(...values: string[]) {
  const text = values.join(' ').trim() || 'draft'
  let hash = 0

  for (const char of text) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0
  }

  return hash.toString(36).slice(0, 8) || 'draft'
}

export function resolveGeneratedTags(input: MetadataFallbackInput) {
  const parsed = parseJsonValue(input.resultText)
  const primary = extractGeneratedTags(parsed, input.resultText)
  if (primary.length > 0) return primary

  const reasoningTags = extractTagsFromReasoning(input.reasoningText || '')
  if (reasoningTags.length > 0) return reasoningTags

  return buildContextTags(input)
}

export function resolveGeneratedSlug(input: MetadataFallbackInput) {
  const parsed = parseJsonValue(input.resultText)
  const primary = normalizeGeneratedSlug(
    extractGeneratedText(parsed, input.resultText, ['slug', 'text', 'result', 'content']),
    '',
  )
  if (primary) return primary

  const reasoningSlug = normalizeGeneratedSlug(
    extractSlugFromReasoning(input.reasoningText || ''),
    '',
  )
  if (reasoningSlug) return reasoningSlug

  const contextSlug = buildEnglishSlugFallback(
    input.title || '',
    input.description || '',
    input.reasoningText || '',
    (input.content || '').slice(0, 1200),
  )
  if (contextSlug) return contextSlug

  const preservedCurrentSlug = normalizePostSlug(input.currentSlug || '')
  if (preservedCurrentSlug) return preservedCurrentSlug

  return normalizePostSlug(`post-${createStableSlugSeed(
    input.title || '',
    input.description || '',
    (input.content || '').slice(0, 160),
  )}`)
}
