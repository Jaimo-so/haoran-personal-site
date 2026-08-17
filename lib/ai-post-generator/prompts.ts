import {
  MAX_CONTEXT_LENGTH,
  MAX_COVER_BRIEF_LENGTH,
  MAX_COVER_DESCRIPTION_LENGTH,
  MAX_COVER_PROMPT_LENGTH,
  MAX_COVER_TAGS_LENGTH,
  MAX_COVER_TITLE_LENGTH,
} from '@/lib/ai-post-generator/constants'
import { truncateText } from '@/lib/ai-post-generator/parsers'
import type { AiPostGeneratorRow, GeneratePostCoverInput } from '@/lib/ai-post-generator/types'

type ContextTarget = 'summary' | 'tags' | 'slug' | 'cover'

export function buildContextBlock(input: {
  title?: string
  content?: string
  category?: string
  description?: string
  tags?: string[]
  currentSlug?: string
}, target: ContextTarget = 'summary') {
  const sections: string[] = []
  const title = (input.title || '').trim()
  const description = (input.description || '').trim()
  const category = (input.category || '').trim()
  const content = (input.content || '').replace(/\s+/g, ' ').trim()
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : []
  const currentSlug = (input.currentSlug || '').trim()

  if (title) sections.push(`标题：${title}`)
  if (category) sections.push(`分类：${category}`)

  if (target === 'slug') {
    if (description) sections.push(`摘要参考：${description}`)
    if (content) sections.push(`正文参考：${content.slice(0, Math.min(MAX_CONTEXT_LENGTH, 1200))}`)
    return sections.join('\n')
  }

  if (target === 'tags') {
    if (description) sections.push(`摘要参考：${description}`)
    if (content) sections.push(`正文：${content.slice(0, MAX_CONTEXT_LENGTH)}`)
    return sections.join('\n')
  }

  if (tags.length > 0) sections.push(`已有标签：${tags.join('、')}`)
  if (description) sections.push(`已有摘要：${description}`)
  if (currentSlug) sections.push(`当前 slug：${currentSlug}`)
  if (content) sections.push(`正文：${content.slice(0, MAX_CONTEXT_LENGTH)}`)

  return sections.join('\n')
}

export function buildTextSystemPrompt(
  target: 'summary' | 'tags' | 'slug',
  prompt: string,
) {
  if (target === 'summary') {
    return `${prompt}\n\n请只返回 JSON：{"summary":"..."}。\n额外要求：摘要必须是简体中文，控制在 160 字以内；必须基于标题和正文中的具体内容，优先提炼文章最值得读的那个问题、反差、矛盾或洞见，再用自然导语把读者带进去；尽量保留具体主题词；避免“本文/这篇文章/作者认为”等空泛开头；不要使用引号。`
  }
  if (target === 'tags') {
    return `${prompt}\n\n请只返回 JSON：{"tags":["标签1","标签2"]}。\n额外要求：标签数量 3-5 个；优先根据正文主线提取，再用标题校准；使用简体中文短词，不要解释，不要整句；优先输出具体概念、对象、方法、技术、产品、人物、议题和领域词；避免空泛大词、泛泛分类词和重复词。`
  }
  return `${prompt}\n\nReturn JSON only: {"slug":"english-kebab-case-slug"}.\nRequirements: use the title as the primary source of meaning; translate the core topic into natural English when the title is Chinese; use the article body only for clarification; output exactly one concise English topic slug, lowercase and hyphen-separated, ideally 2-5 words; avoid dates, vague filler, pinyin, quotes, and any prefix such as "slug:".`
}

export function getNowPrefix() {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  return { yyyy, mm }
}

export function sanitizeFilename(filename: string) {
  const trimmed = filename.trim().toLowerCase()
  const safe = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return safe || 'image'
}

export function buildAssetUrls(encodedKey: string, cloudflareEnabled: boolean) {
  const baseUrl = `/api/images/${encodedKey}`
  return {
    raw: baseUrl,
    content: cloudflareEnabled ? `${baseUrl}?w=1600&q=85&format=webp` : baseUrl,
    thumb: cloudflareEnabled ? `${baseUrl}?w=960&q=82&format=webp` : baseUrl,
    cover: cloudflareEnabled ? `${baseUrl}?w=1600&h=900&fit=cover&q=84&format=webp` : baseUrl,
  }
}

function buildCoverHintPhrases(input: Omit<GeneratePostCoverInput, 'db' | 'images' | 'env'>) {
  const rawHints = [
    ...(Array.isArray(input.tags) ? input.tags : []),
    input.category || '',
    ...(input.title || '').split(/[：:，,、|《》“”"'（）()]/),
    ...(input.description || '').split(/[：:，,、|《》“”"'（）()]/),
  ]

  return Array.from(new Set(
    rawHints
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 24),
  ))
}

function buildCoverContentBrief(input: Omit<GeneratePostCoverInput, 'db' | 'images' | 'env'>) {
  const description = truncateText(input.description || '', MAX_COVER_DESCRIPTION_LENGTH)
  const normalizedContent = (input.content || '').replace(/\r/g, '\n')
  const hints = buildCoverHintPhrases(input)
  const rawSentences = normalizedContent
    .split(/(?<=[。！？!?\.])\s+|\n+/u)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const matched: string[] = []
  const fallback: string[] = []

  for (const sentence of rawSentences.slice(0, 24)) {
    if (sentence.length < 12) continue
    if (/^(本文|这篇文章|文章|作者|首先|其次|再次|最后|总之|总结来说)/.test(sentence)) continue

    const concise = truncateText(sentence, 120)
    if (!concise) continue

    const hasHint = hints.some((hint) => concise.includes(hint))
    const targetList = hasHint ? matched : fallback
    if (targetList.some((item) => item === concise || item.includes(concise) || concise.includes(item))) {
      continue
    }

    targetList.push(concise)
    if (matched.length >= 4 && fallback.length >= 4) break
  }

  const coreSentences = [...matched, ...fallback].slice(0, 4)
  const lines: string[] = []

  if (description) lines.push(`文章导语：${description}`)
  if (coreSentences.length > 0) {
    lines.push(`文章核心信息：${truncateText(coreSentences.join('；'), MAX_COVER_BRIEF_LENGTH)}`)
  }

  return lines
}

function joinPromptSectionsWithinLimit(
  headSections: string[],
  tailSections: string[],
  maxLength: number,
) {
  const tail = tailSections.filter(Boolean).join('\n\n')
  const reserved = tail ? tail.length + 2 : 0
  const remaining = Math.max(0, maxLength - reserved)
  const collected: string[] = []
  let used = 0

  for (const rawSection of headSections) {
    const section = rawSection.trim()
    if (!section) continue

    const separatorLength = collected.length > 0 ? 2 : 0
    const available = remaining - used - separatorLength
    if (available <= 0) break

    const truncated = truncateText(section, available)
    if (!truncated) break

    collected.push(truncated)
    used += separatorLength + truncated.length
  }

  return [...collected, ...tailSections.filter(Boolean)].join('\n\n')
}

export function buildCoverPrompt(
  generator: AiPostGeneratorRow,
  input: Omit<GeneratePostCoverInput, 'db' | 'images' | 'env'>,
) {
  const title = (input.title || '').trim()
  const category = (input.category || '').trim()
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => tag.trim()).filter(Boolean) : []
  const headSections: string[] = []

  if (generator.prompt.trim()) headSections.push(generator.prompt.trim())
  if (title) headSections.push(`文章标题：${truncateText(title, MAX_COVER_TITLE_LENGTH)}`)
  if (category) headSections.push(`分类：${truncateText(category, 48)}`)
  if (tags.length > 0) headSections.push(`标签：${truncateText(tags.join('、'), MAX_COVER_TAGS_LENGTH)}`)
  headSections.push(...buildCoverContentBrief(input))

  return joinPromptSectionsWithinLimit(
    headSections,
    [
      `构图比例：${generator.aspect_ratio}`,
      `清晰度：${generator.resolution}`,
      '输出要求：先根据文章内容提炼一个简洁、可视化、单一主视觉的画面概念，再生成封面图；不要添加可读文字、logo、水印、UI 截图或多联画；画面需要层次明确，适合博客封面裁切。',
    ],
    MAX_COVER_PROMPT_LENGTH,
  )
}
