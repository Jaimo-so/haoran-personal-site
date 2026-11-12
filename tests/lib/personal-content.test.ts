import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PERSONAL_CONTENT,
  normalizePersonalContent,
  parsePersonalContentInput,
} from '@/lib/personal-content'

describe('personal site content', () => {
  it('accepts the complete content model and trims saved text', () => {
    const input = structuredClone(DEFAULT_PERSONAL_CONTENT)
    input.hero.role = '  AI 产品经理  '
    expect(parsePersonalContentInput(input).hero.role).toBe('AI 产品经理')
  })

  it('keeps every definition from the default about-page copy', () => {
    const parsed = parsePersonalContentInput(DEFAULT_PERSONAL_CONTENT)
    expect(parsed.about.html).toContain('成为真正理解用户、技术与商业的 AI 产品经理')
    expect(parsed.about.html).toContain('<strong>产品视角。</strong>')
    expect(parsed.about.html).toContain('<strong>构建视角。</strong>')
    expect(parsed.about.html).toContain('<strong>成长视角。</strong>')
  })

  it('fills missing fields in older stored content from defaults', () => {
    expect(normalizePersonalContent({ hero: { headline: '新的标题' } })).toEqual({
      ...DEFAULT_PERSONAL_CONTENT,
      hero: { ...DEFAULT_PERSONAL_CONTENT.hero, headline: '新的标题' },
    })
  })

  it('migrates every legacy about-page field into one rich-text article', () => {
    const legacy = {
      ...DEFAULT_PERSONAL_CONTENT,
      about: {
        heading: '自我介绍',
        identityPrefix: '我是小明，也是一名',
        identityRole: 'AI Builder',
        identitySuffix: '。',
        direction: '我的方向。',
        introduction: '我的关注。',
        builderPhilosophy: '我的构建理念。',
        productPerspectiveTitle: '产品视角。',
        productPerspective: '产品视角的完整定义。',
        builderPerspectiveTitle: '构建视角。',
        builderPerspective: '构建视角的完整定义。',
        growthPerspectiveTitle: '成长视角。',
        growthPerspective: '成长视角的完整定义。',
      },
    }
    const html = normalizePersonalContent(legacy).about.html
    for (const text of Object.values(legacy.about)) expect(html).toContain(text)
  })

  it.each([
    null,
    [],
    {},
    { ...DEFAULT_PERSONAL_CONTENT, hero: { ...DEFAULT_PERSONAL_CONTENT.hero, role: '' } },
    { ...DEFAULT_PERSONAL_CONTENT, contact: { ...DEFAULT_PERSONAL_CONTENT.contact, headline: 42 } },
    { ...DEFAULT_PERSONAL_CONTENT, about: { html: '<p><br></p>' } },
    { ...DEFAULT_PERSONAL_CONTENT, about: { html: 'x'.repeat(50001) } },
  ])('rejects incomplete or invalid content %#', (input) => {
    expect(() => parsePersonalContentInput(input)).toThrow()
  })
})
