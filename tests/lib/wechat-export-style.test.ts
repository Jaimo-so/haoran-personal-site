import { describe, expect, it } from 'vitest'
import {
  buildWechatExportCss,
  normalizeWechatExportHtml,
  type WechatExportStyleTokens,
} from '@/lib/wechat-export-style'

const TOKENS: WechatExportStyleTokens = {
  background: '#f5f4ed',
  panelBackground: '#faf9f5',
  softBackground: '#e8e6dc',
  lineColor: '#f0eee6',
  inkColor: '#141413',
  mutedColor: '#5e5d59',
  accentColor: '#c96442',
  linkColor: '#c96442',
  codeBackground: '#faf9f5',
  codeBorderColor: '#e8e6dc',
  quoteBackground: '#faf9f5',
  articleHeadingColor: '#17120d',
  articleBodyColor: '#2b241c',
  articleQuoteColor: '#51473a',
  articleQuoteBorderColor: '#cdb796',
  articleQuoteNestedBorderColor: '#b8a68a',
  articleQuoteNestedBackground: 'rgba(0, 0, 0, 0.02)',
  bodyFontFamily: 'Georgia, serif',
  monoFontFamily: '"SF Mono", monospace',
  titleFontFamily: 'Georgia, serif',
}

describe('wechat export helpers', () => {
  it('preserves intentional empty paragraphs for wechat paste', () => {
    const html = '<p>第一段</p><p><br class="ProseMirror-trailingBreak"></p><p>第二段</p><p>   </p>'

    const normalized = normalizeWechatExportHtml(html)

    expect(normalized).toContain('<p data-wechat-empty="true">&nbsp;</p>')
    expect(normalized).toContain('<p>第一段</p>')
    expect(normalized).toContain('<p>第二段</p>')
  })

  it('builds md-like css for tables, code blocks, quotes, empty paragraphs, and image spacing', () => {
    const css = buildWechatExportCss(TOKENS)

    expect(css).toContain('.wechat-export-title')
    expect(css).toContain('.wechat-export-content table')
    expect(css).toContain('.wechat-export-article')
    expect(css).toContain('.wechat-export-content pre')
    expect(css).toContain('pre.code__pre > code')
    expect(css).toContain('.wechat-export-content code')
    expect(css).toContain('.wechat-export-content blockquote')
    expect(css).toContain('p[data-wechat-empty="true"]')
    expect(css).toContain('.wechat-export-content img + p')
    expect(css).toContain('.wechat-export-content img + img')
    expect(css).toContain('font-size: 17px;')
    expect(css).toContain('display: -webkit-box;')
    expect(css).toContain('white-space: nowrap;')
    expect(css).toContain('.pdf-media-placeholder')
    expect(css).toContain('break-inside: avoid-page;')
    expect(css).toContain('page-break-inside: avoid;')
    expect(css).toContain('color: #d14')
    expect(css).toContain('padding: 0 8px;')
    expect(css).toContain('padding: 0 !important;')
    expect(css).toContain('background: transparent;')
    expect(css).not.toContain(TOKENS.background)
    expect(css).not.toContain(TOKENS.codeBackground)
  })
})
