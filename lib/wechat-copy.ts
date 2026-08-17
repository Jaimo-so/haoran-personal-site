'use client'

import juice from 'juice'
import { buildWechatExportCss, normalizeWechatExportHtml, type WechatExportStyleTokens } from './wechat-export-style'

type ExportMode = 'clipboard' | 'pdf'

const URL_ATTRIBUTES = [
  ['img', 'src'],
  ['a', 'href'],
  ['audio', 'src'],
  ['video', 'src'],
  ['source', 'src'],
  ['iframe', 'src'],
] as const

function shouldRewriteUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('#')) return false
  if (/^(?:[a-z]+:|\/\/)/i.test(trimmed)) return false
  return true
}

function absolutizeUrls(root: Document | Element, baseUrl: string) {
  for (const [selector, attribute] of URL_ATTRIBUTES) {
    for (const element of root.querySelectorAll<HTMLElement>(selector)) {
      const value = element.getAttribute(attribute)
      if (!value || !shouldRewriteUrl(value)) continue
      element.setAttribute(attribute, new URL(value, baseUrl).toString())
    }
  }
}

function waitForLayout() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

async function waitForMediaReady(root: HTMLElement) {
  const imageTasks = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
    .filter((img) => !img.complete)
    .map((img) => new Promise<void>((resolve) => {
      const cleanup = () => {
        img.removeEventListener('load', cleanup)
        img.removeEventListener('error', cleanup)
        resolve()
      }

      img.addEventListener('load', cleanup, { once: true })
      img.addEventListener('error', cleanup, { once: true })
    }))

  const fontsReady = typeof document.fonts?.ready?.then === 'function'
    ? document.fonts.ready.then(() => undefined).catch(() => undefined)
    : Promise.resolve()

  await Promise.all([fontsReady, ...imageTasks])
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cleanAttributeValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

function readCssVar(style: CSSStyleDeclaration, name: string, fallback: string) {
  const value = style.getPropertyValue(name)
  return value ? cleanAttributeValue(value) : fallback
}

function readWechatExportStyleTokens(): WechatExportStyleTokens {
  const rootStyle = window.getComputedStyle(document.documentElement)
  const bodyStyle = window.getComputedStyle(document.body)
  const bodyFont = readCssVar(rootStyle, '--body-font', bodyStyle.fontFamily || 'Arial, Helvetica, sans-serif')

  return {
    background: readCssVar(rootStyle, '--background', '#f5f4ed'),
    panelBackground: readCssVar(rootStyle, '--editor-panel', '#faf9f5'),
    softBackground: readCssVar(rootStyle, '--editor-soft', '#e8e6dc'),
    lineColor: readCssVar(rootStyle, '--editor-line', '#f0eee6'),
    inkColor: readCssVar(rootStyle, '--editor-ink', '#141413'),
    mutedColor: readCssVar(rootStyle, '--editor-muted', '#5e5d59'),
    accentColor: readCssVar(rootStyle, '--editor-accent', '#c96442'),
    linkColor: readCssVar(rootStyle, '--editor-link', '#c96442'),
    codeBackground: readCssVar(rootStyle, '--editor-code-bg', '#faf9f5'),
    codeBorderColor: readCssVar(rootStyle, '--editor-code-border', '#e8e6dc'),
    quoteBackground: readCssVar(rootStyle, '--editor-quote-bg', '#faf9f5'),
    articleHeadingColor: readCssVar(rootStyle, '--article-heading', '#17120d'),
    articleBodyColor: readCssVar(rootStyle, '--article-body', '#2b241c'),
    articleQuoteColor: readCssVar(rootStyle, '--article-quote', '#51473a'),
    articleQuoteBorderColor: readCssVar(rootStyle, '--article-quote-border', '#cdb796'),
    articleQuoteNestedBorderColor: readCssVar(rootStyle, '--article-quote-nested-border', '#b8a68a'),
    articleQuoteNestedBackground: readCssVar(rootStyle, '--article-quote-nested-bg', 'rgba(0, 0, 0, 0.02)'),
    bodyFontFamily: bodyFont,
    monoFontFamily: readCssVar(rootStyle, '--font-geist-mono', '"SFMono-Regular", Consolas, monospace'),
    titleFontFamily: bodyFont || 'Georgia, "Noto Serif SC", serif',
  }
}

function normalizeMediaAttributes(root: ParentNode) {
  for (const image of root.querySelectorAll<HTMLImageElement>('img')) {
    const width = image.getAttribute('width')
    const height = image.getAttribute('height')

    if (width) {
      image.removeAttribute('width')
      image.style.width = /^\d+$/.test(width) ? `${width}px` : width
    }

    if (height) {
      image.removeAttribute('height')
      image.style.height = /^\d+$/.test(height) ? `${height}px` : height
    }
  }
}

function normalizeCodeBlockMarkup(root: ParentNode) {
  for (const pre of root.querySelectorAll<HTMLPreElement>('pre')) {
    if (!pre.querySelector('code'))
      continue

    pre.classList.add('code__pre')
  }
}

function getMediaSource(element: Element) {
  if (element instanceof HTMLMediaElement) {
    return element.currentSrc || element.getAttribute('src') || ''
  }

  if (element instanceof HTMLIFrameElement) {
    return element.getAttribute('src') || ''
  }

  return (
    element.getAttribute('src')
    || element.querySelector('iframe')?.getAttribute('src')
    || element.querySelector('source')?.getAttribute('src')
    || ''
  )
}

function createPdfMediaPlaceholder(
  doc: Document,
  options: {
    href: string
    kind: 'video' | 'embed'
    title?: string
  },
) {
  const figure = doc.createElement('figure')
  figure.className = 'pdf-media-placeholder'
  figure.setAttribute('data-pdf-media-kind', options.kind)

  const poster = doc.createElement('div')
  poster.className = 'pdf-media-placeholder__poster'

  const play = doc.createElement('span')
  play.className = 'pdf-media-placeholder__play'
  play.textContent = '▶'
  poster.appendChild(play)

  const caption = doc.createElement('figcaption')
  caption.className = 'pdf-media-placeholder__caption'

  const title = doc.createElement('strong')
  title.className = 'pdf-media-placeholder__title'
  title.textContent = options.title?.trim() || (options.kind === 'video' ? '视频内容' : '嵌入内容')
  caption.appendChild(title)

  const description = doc.createElement('p')
  description.className = 'pdf-media-placeholder__description'
  description.textContent = options.kind === 'video'
    ? 'PDF 中无法直接播放视频，请打开下方链接查看。'
    : 'PDF 中无法直接展示该嵌入内容，请打开下方链接查看。'
  caption.appendChild(description)

  if (options.href) {
    const link = doc.createElement('a')
    link.className = 'pdf-media-placeholder__link'
    link.href = options.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = options.href
    caption.appendChild(link)
  }

  figure.appendChild(poster)
  figure.appendChild(caption)
  return figure
}

function replaceUnsupportedPdfEmbeds(doc: Document) {
  for (const youtube of Array.from(doc.querySelectorAll<HTMLElement>('div[data-youtube-video]'))) {
    const src = getMediaSource(youtube)
    youtube.replaceWith(createPdfMediaPlaceholder(doc, {
      href: src,
      kind: 'video',
      title: '嵌入视频',
    }))
  }

  for (const video of Array.from(doc.querySelectorAll<HTMLVideoElement>('video'))) {
    const src = getMediaSource(video)
    const title = video.getAttribute('title') || undefined
    video.replaceWith(createPdfMediaPlaceholder(doc, {
      href: src,
      kind: 'video',
      title,
    }))
  }

  for (const iframe of Array.from(doc.querySelectorAll<HTMLIFrameElement>('iframe'))) {
    const src = getMediaSource(iframe)
    iframe.replaceWith(createPdfMediaPlaceholder(doc, {
      href: src,
      kind: 'embed',
      title: iframe.getAttribute('title') || '嵌入内容',
    }))
  }
}

function normalizeExportMarkup(html: string, mode: ExportMode = 'clipboard') {
  const parser = new DOMParser()
  const doc = parser.parseFromString(normalizeWechatExportHtml(html), 'text/html')
  absolutizeUrls(doc, window.location.origin)
  normalizeMediaAttributes(doc)
  normalizeCodeBlockMarkup(doc)

  if (mode === 'pdf') {
    replaceUnsupportedPdfEmbeds(doc)
  }

  return doc.body.innerHTML
}

function buildWechatExportFragment(title: string, html: string) {
  return `
    <section class="wechat-export-root">
      <article class="wechat-export-article">
        <p class="wechat-export-title">${escapeHtml(title)}</p>
        <div class="wechat-export-content">${html}</div>
      </article>
    </section>
  `
}

function createStageRoot(title: string, html: string, css: string) {
  const stage = document.createElement('div')
  stage.style.position = 'fixed'
  stage.style.left = '-20000px'
  stage.style.top = '0'
  stage.style.width = '720px'
  stage.style.pointerEvents = 'none'
  stage.style.background = '#ffffff'
  stage.style.zIndex = '-1'

  stage.innerHTML = `
    <style>${css}</style>
    ${buildWechatExportFragment(title, html)}
  `

  document.body.appendChild(stage)
  return stage
}

async function prepareArticleExportStage(title: string, html: string) {
  const normalizedTitle = title.trim() || '无标题'
  const normalizedHtml = normalizeExportMarkup(html, 'pdf')
  const css = buildWechatExportCss(readWechatExportStyleTokens())
  const stage = createStageRoot(normalizedTitle, normalizedHtml, css)
  const article = stage.querySelector('.wechat-export-article')

  if (!(article instanceof HTMLElement)) {
    stage.remove()
    throw new Error('生成导出内容失败')
  }

  await waitForLayout()
  await waitForMediaReady(stage)

  return {
    stage,
    article,
    normalizedTitle,
  }
}

function buildWechatClipboardHtml(title: string, html: string) {
  const normalizedTitle = title.trim() || '无标题'
  const normalizedHtml = normalizeExportMarkup(html, 'clipboard')
  const css = buildWechatExportCss(readWechatExportStyleTokens())
  const fragment = buildWechatExportFragment(normalizedTitle, normalizedHtml)

  const exportedHtml = juice.inlineContent(fragment, css, {
    applyWidthAttributes: true,
    applyHeightAttributes: true,
    applyAttributesTableElements: true,
    preserveImportant: true,
    resolveCSSVariables: false,
    removeStyleTags: false,
  })

  return {
    exportedHtml,
    normalizedTitle,
  }
}

type BridgeImageVariant = 'content' | 'cover'

function rewriteBridgeImageUrl(input: string, variant: BridgeImageVariant) {
  const url = new URL(input, window.location.origin)

  if (url.origin === window.location.origin && url.pathname.startsWith('/api/images/')) {
    if (variant === 'content') {
      url.searchParams.set('w', '1280')
      url.searchParams.set('q', '82')
      url.searchParams.set('format', 'jpeg')
    } else {
      url.searchParams.set('w', '560')
      url.searchParams.set('h', '315')
      url.searchParams.set('fit', 'cover')
      url.searchParams.set('q', '48')
      url.searchParams.set('format', 'jpeg')
    }
  }

  return url.toString()
}

function rewriteBridgeArticleHtml(exportedHtml: string) {
  const doc = new DOMParser().parseFromString(exportedHtml, 'text/html')

  for (const image of doc.querySelectorAll<HTMLImageElement>('img')) {
    const src = image.getAttribute('src')
    if (!src) continue
    image.setAttribute('src', rewriteBridgeImageUrl(src, 'content'))
  }

  return doc.body.innerHTML
}

export function buildWechatBridgeArticleExport(title: string, html: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持公众号发布导出')
  }

  const { exportedHtml, normalizedTitle } = buildWechatClipboardHtml(title, html)

  return {
    normalizedTitle,
    exportedHtml: rewriteBridgeArticleHtml(exportedHtml),
  }
}

export function buildWechatBridgeCoverImageUrl(input: string) {
  const normalized = input.trim()
  if (!normalized) return ''

  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持封面图处理')
  }

  return rewriteBridgeImageUrl(normalized, 'cover')
}

export function extractFirstWechatBridgeCoverImageUrl(html: string) {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持封面图处理')
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const src = doc.querySelector('img')?.getAttribute('src') || ''
  return src ? rewriteBridgeImageUrl(src, 'cover') : ''
}

function copyUsingExecCommand(html: string, plainText: string) {
  return new Promise<void>((resolve, reject) => {
    const textarea = document.createElement('textarea')
    textarea.value = plainText
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'

    const handleCopy = (event: ClipboardEvent) => {
      event.preventDefault()
      event.clipboardData?.setData('text/html', html)
      event.clipboardData?.setData('text/plain', plainText)
    }

    document.body.appendChild(textarea)
    document.addEventListener('copy', handleCopy)
    textarea.select()

    try {
      const ok = document.execCommand('copy')
      if (!ok) {
        throw new Error('execCommand failed')
      }
      resolve()
    } catch (error) {
      reject(error instanceof Error ? error : new Error('复制失败'))
    } finally {
      document.removeEventListener('copy', handleCopy)
      textarea.remove()
    }
  })
}

async function writeClipboardHtml(html: string, plainText: string) {
  if (window.isSecureContext && navigator.clipboard?.write) {
    try {
      if (typeof ClipboardItem === 'undefined') {
        throw new TypeError('ClipboardItem is not supported in this browser.')
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      // fall through to legacy copy
    }
  }

  await copyUsingExecCommand(html, plainText)
}

export async function copyAsWechatArticleFormat(title: string, html: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持复制')
  }

  const { exportedHtml, normalizedTitle } = buildWechatClipboardHtml(title, html)
  const plainText = new DOMParser()
    .parseFromString(exportedHtml, 'text/html')
    .body.textContent?.trim() || normalizedTitle

  await writeClipboardHtml(exportedHtml, plainText)
}

export async function downloadArticleAsPdf(title: string, html: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('当前环境不支持导出 PDF')
  }

  let prepared:
    | {
      stage: HTMLDivElement
      article: HTMLElement
      normalizedTitle: string
    }
    | undefined

  try {
    const { default: html2pdf } = await import('html2pdf.js')
    prepared = await prepareArticleExportStage(title, html)
    const pdfOptions = {
      margin: [16, 12, 16, 12],
      filename: `${prepared.normalizedTitle}.pdf`,
      image: { type: 'jpeg', quality: 0.96 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['img', 'pre', 'blockquote', 'table', 'figure', 'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.pdf-media-placeholder'],
      },
    }

    // html2pdf.js runtime supports `pagebreak`, but its bundled d.ts omits it.
    await html2pdf()
      .set(pdfOptions as never)
      .from(prepared.article)
      .save()
  } finally {
    prepared?.stage.remove()
  }
}
