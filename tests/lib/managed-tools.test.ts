import { describe, expect, it } from 'vitest'
import { parseManagedToolInput } from '@/lib/managed-tools'

describe('parseManagedToolInput', () => {
  it('normalizes a complete tool payload', () => {
    expect(parseManagedToolInput({
      name: '  网页剪藏  ',
      category: ' Chrome 扩展 ',
      description: ' 保存网页正文 ',
      link_url: 'https://github.com/example/clipper',
      icon: 'globe',
      is_visible: true,
    })).toEqual({
      name: '网页剪藏',
      category: 'Chrome 扩展',
      description: '保存网页正文',
      link_url: 'https://github.com/example/clipper',
      icon: 'globe',
      is_visible: 1,
    })
  })

  it('accepts a visibility-only partial update', () => {
    expect(parseManagedToolInput({ is_visible: 0 }, true)).toEqual({ is_visible: 0 })
  })

  it('rejects non-web links', () => {
    expect(() => parseManagedToolInput({
      name: '危险链接',
      category: '测试',
      description: '',
      link_url: 'javascript:alert(1)',
      icon: 'code',
      is_visible: 1,
    })).toThrow('工具链接必须以 http:// 或 https:// 开头')
  })

  it('rejects unknown icons', () => {
    expect(() => parseManagedToolInput({
      name: '测试工具',
      category: '测试',
      description: '',
      link_url: 'https://github.com/example/tool',
      icon: 'unknown',
      is_visible: 1,
    })).toThrow('请选择有效的工具图标')
  })
})
