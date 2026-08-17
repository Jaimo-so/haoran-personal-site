import { describe, expect, it } from 'vitest'
import {
  extractGeneratedTags,
  normalizeGeneratedSlug,
  normalizeSummary,
  parseJsonValue,
} from '@/lib/ai-post-generator/parsers'

describe('ai-post-generator/parsers', () => {
  it('parses fenced json payloads', () => {
    const parsed = parseJsonValue('```json\n{"summary":"测试摘要"}\n```')

    expect(parsed).toEqual({ summary: '测试摘要' })
  })

  it('extracts tags from nested payloads and removes duplicates', () => {
    const tags = extractGeneratedTags(
      {
        result: {
          tags: ['AI', '#AI', ' 测试 ', '测试', '工程', '产品', '写作', '多余标签'],
        },
      },
      '',
    )

    expect(tags).toEqual(['AI', '测试', '工程', '产品', '写作'])
  })

  it('cuts long summaries at sentence boundaries when possible', () => {
    const summary = normalizeSummary(
      `${'这是一段很长的摘要'.repeat(9)}，用来验证在超过限制时会优先截断到完整句号。${'补充内容'.repeat(20)}`,
      '',
    )

    expect(summary.endsWith('。')).toBe(true)
    expect(summary.length).toBeLessThanOrEqual(160)
  })

  it('normalizes generated slugs into lowercase kebab case', () => {
    const slug = normalizeGeneratedSlug('slug: AI_Editing & Prompt Design!!', '')

    expect(slug).toBe('ai-editing-and-prompt-design')
  })
})
