import { describe, expect, it } from 'vitest'
import {
  resolveGeneratedSlug,
  resolveGeneratedTags,
} from '@/lib/ai-post-generator/metadata-fallbacks'

describe('ai-post-generator/metadata-fallbacks', () => {
  it('salvages tags from reasoning-only JSON output', () => {
    const tags = resolveGeneratedTags({
      title: 'OpenAI Agents SDK 工具调用指南',
      content: '',
      category: 'AI',
      description: '',
      tags: [],
      currentSlug: '',
      resultText: '',
      reasoningText: `
        思考过程略。
        Final JSON:
        {"tags":["OpenAI Agents SDK","工具调用","Agent 编排","多轮对话"]}
      `,
    })

    expect(tags).toEqual(['OpenAI Agents SDK', '工具调用', 'Agent 编排', '多轮对话'])
  })

  it('falls back to title and category tags when no AI output is available', () => {
    const tags = resolveGeneratedTags({
      title: 'OpenAI Agents SDK 工具调用指南',
      content: '',
      category: 'AI',
      description: '讲清楚 Agent 工作流和工具调用方式',
      tags: [],
      currentSlug: '',
      resultText: '',
      reasoningText: '',
    })

    expect(tags).toContain('AI')
    expect(tags).toContain('OpenAI Agents SDK')
    expect(tags).toContain('工具调用指南')
    expect(tags.length).toBeGreaterThanOrEqual(3)
    expect(tags.length).toBeLessThanOrEqual(5)
  })

  it('salvages slug from reasoning-only JSON output', () => {
    const slug = resolveGeneratedSlug({
      title: 'OpenAI Agents SDK 工具调用指南',
      content: '',
      category: 'AI',
      description: '',
      tags: [],
      currentSlug: '',
      resultText: '',
      reasoningText: `
        分析略。
        {"slug":"openai-agents-sdk-tool-calling-guide"}
      `,
    })

    expect(slug).toBe('openai-agents-sdk-tool-calling-guide')
  })

  it('falls back to english context words before using a generic slug', () => {
    const slug = resolveGeneratedSlug({
      title: 'OpenAI Agents SDK 工具调用指南',
      content: '这篇文章解释 tool calling workflow 和 agent orchestration。',
      category: 'AI',
      description: '',
      tags: [],
      currentSlug: '',
      resultText: '',
      reasoningText: '',
    })

    expect(slug).toBe('openai-agents-sdk-tool-calling')
  })

  it('preserves current slug when neither AI nor english context is available', () => {
    const slug = resolveGeneratedSlug({
      title: '一篇中文文章',
      content: '纯中文内容，没有可提取的英文线索。',
      category: '随笔',
      description: '',
      tags: [],
      currentSlug: 'existing_slug',
      resultText: '',
      reasoningText: '',
    })

    expect(slug).toBe('existing_slug')
  })
})
