import { describe, expect, it } from 'vitest'
import {
  MAX_CONTEXT_LENGTH,
  MAX_COVER_PROMPT_LENGTH,
} from '@/lib/ai-post-generator/constants'
import {
  buildContextBlock,
  buildCoverPrompt,
  buildTextSystemPrompt,
} from '@/lib/ai-post-generator/prompts'
import type { AiPostGeneratorRow } from '@/lib/ai-post-generator/types'

const coverGenerator: AiPostGeneratorRow = {
  id: 1,
  target_key: 'cover',
  label: '封面生成',
  description: '生成封面',
  prompt: '请根据文章生成一张封面图',
  provider_mode: 'workers_ai',
  text_profile_id: null,
  image_profile_id: null,
  workers_model: '@cf/black-forest-labs/flux-1-schnell',
  temperature: 0.7,
  max_tokens: 2000,
  aspect_ratio: '16:9',
  resolution: '2k',
  is_enabled: 1,
  is_builtin: 1,
  created_at: 0,
  updated_at: 0,
}

describe('ai-post-generator/prompts', () => {
  it('builds a summary context block from non-empty sections and truncates content', () => {
    const context = buildContextBlock({
      title: '测试标题',
      category: 'AI',
      description: '摘要',
      tags: ['提示词', '编辑器'],
      currentSlug: 'test-slug',
      content: ` ${'a'.repeat(MAX_CONTEXT_LENGTH + 20)} `,
    }, 'summary')

    expect(context).toContain('标题：测试标题')
    expect(context).toContain('分类：AI')
    expect(context).toContain('已有标签：提示词、编辑器')
    expect(context).toContain('当前 slug：test-slug')
    expect(context).toContain(`正文：${'a'.repeat(MAX_CONTEXT_LENGTH)}`)
    expect(context).not.toContain('a'.repeat(MAX_CONTEXT_LENGTH + 1))
  })

  it('omits existing tags and current slug when building slug context', () => {
    const context = buildContextBlock({
      title: 'OpenAI Agents SDK 实战',
      category: 'AI',
      description: '围绕 Agent 编排和工具调用展开。',
      tags: ['旧标签1', '旧标签2'],
      currentSlug: 'old-slug',
      content: '正文会补充这是一个关于 OpenAI Agents SDK、tool calling 和 agent workflow 的实战指南。',
    }, 'slug')

    expect(context).toContain('标题：OpenAI Agents SDK 实战')
    expect(context).toContain('正文参考：')
    expect(context).not.toContain('已有标签：')
    expect(context).not.toContain('当前 slug：')
  })

  it('omits existing tags and requests 3-5 tags for tag generation', () => {
    const context = buildContextBlock({
      title: '用 MCP 重构内容工作流',
      category: '工作流',
      description: '讨论 MCP、工具编排和内容生产。',
      tags: ['旧标签'],
      currentSlug: 'old-slug',
      content: '正文重点讨论 MCP server、tool orchestration、agent workflow 和内容自动化。',
    }, 'tags')

    expect(context).toContain('标题：用 MCP 重构内容工作流')
    expect(context).toContain('正文：')
    expect(context).not.toContain('已有标签：')
    expect(context).not.toContain('当前 slug：')
    expect(buildTextSystemPrompt('tags', '提标签')).toContain('标签数量 3-5 个')
  })

  it('adds target-specific json instructions to text prompts', () => {
    expect(buildTextSystemPrompt('summary', '写摘要')).toContain('{"summary":"..."}')
    expect(buildTextSystemPrompt('tags', '提标签')).toContain('{"tags":["标签1","标签2"]}')
    expect(buildTextSystemPrompt('slug', 'make slug')).toContain('{"slug":"english-kebab-case-slug"}')
    expect(buildTextSystemPrompt('slug', 'make slug')).toContain('title as the primary source of meaning')
  })

  it('keeps cover prompts within the configured limit while preserving key context', () => {
    const prompt = buildCoverPrompt(coverGenerator, {
      title: 'Ask AI 如何让 Markdown 编辑更顺手',
      category: '产品设计',
      tags: ['编辑器', 'AI', '写作'],
      description: '围绕编辑器和 AI 交互细节展开讨论。',
      content: `${'这一段用于补充上下文，帮助生成更准确的封面图。'.repeat(120)}`,
    })

    expect(prompt).toContain('文章标题：Ask AI 如何让 Markdown 编辑更顺手')
    expect(prompt).toContain('分类：产品设计')
    expect(prompt).toContain('标签：编辑器、AI、写作')
    expect(prompt).toContain('构图比例：16:9')
    expect(prompt.length).toBeLessThanOrEqual(MAX_COVER_PROMPT_LENGTH)
  })
})
