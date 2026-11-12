import { describe, expect, it } from 'vitest'
import { parseManagedProjectInput } from '@/lib/managed-projects'

describe('project input validation', () => {
  it('keeps links optional and normalizes names', () => {
    expect(parseManagedProjectInput({ name: '  AI 产品拆解  ' })).toEqual({
      name: 'AI 产品拆解', description: '', link_url: '', github_url: '', is_visible: 1,
    })
  })

  it('supports visibility-only edits and clearing a link', () => {
    expect(parseManagedProjectInput({ is_visible: false }, true)).toEqual({ is_visible: 0 })
    expect(parseManagedProjectInput({ link_url: ' ' }, true)).toEqual({ link_url: '' })
  })

  it('normalizes web links', () => {
    expect(parseManagedProjectInput({ link_url: ' https://example.com ' }, true)).toEqual({ link_url: 'https://example.com/' })
  })

  it('saves and clears a separate GitHub destination without changing the website', () => {
    expect(parseManagedProjectInput({ github_url: ' https://github.com/Jaimo-so/demo ' }, true)).toEqual({ github_url: 'https://github.com/Jaimo-so/demo' })
    expect(parseManagedProjectInput({ github_url: ' ' }, true)).toEqual({ github_url: '' })
  })

  it.each(['javascript:alert(1)', 'https://github.com.evil.test/repo', 'https://example.com/repo'])('rejects invalid GitHub destinations %s', (github_url) => {
    expect(() => parseManagedProjectInput({ github_url }, true)).toThrow()
  })

  it.each(['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https//example.com', '//example.com'])('rejects unsafe or malformed link %s', (link_url) => {
    expect(() => parseManagedProjectInput({ link_url }, true)).toThrow()
  })

  it.each([null, [], 'name', { name: '' }, { name: '   ' }, { name: 42 }, { name: 'x'.repeat(81) }, { name: '项目', description: 'x'.repeat(501) }, { name: '项目', description: null }, { name: '项目', is_visible: null }, { name: '项目', is_visible: 'false' }, { name: '项目', is_visible: 2 }])('rejects invalid payload %#', (payload) => {
    expect(() => parseManagedProjectInput(payload)).toThrow()
  })
})
