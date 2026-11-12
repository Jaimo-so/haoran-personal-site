import { describe, expect, it } from 'vitest'
import { getProjectLinks } from '@/lib/project-links'

describe('project destinations', () => {
  it('preserves an existing repository in the original link field', () => {
    expect(getProjectLinks({ link_url: 'https://github.com/Jaimo-so/existing' })).toEqual({ website: '', github: 'https://github.com/Jaimo-so/existing' })
  })
  it('keeps website and repository destinations separate', () => {
    expect(getProjectLinks({ link_url: 'https://demo.example', github_url: 'https://github.com/Jaimo-so/demo' })).toEqual({ website: 'https://demo.example', github: 'https://github.com/Jaimo-so/demo' })
  })
  it('does not mistake similarly named domains for GitHub', () => {
    expect(getProjectLinks({ link_url: 'https://github.com.example/demo' }).website).toBe('https://github.com.example/demo')
  })
  it('leaves missing destinations empty', () => {
    expect(getProjectLinks({ link_url: '' })).toEqual({ website: '', github: '' })
  })
})
