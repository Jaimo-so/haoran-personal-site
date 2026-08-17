export function extractTweetId(url: string | null | undefined): string | null {
  if (!url) return null
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i)
  return match?.[1] ?? null
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (
          tweetId: string,
          element: HTMLElement,
          options?: {
            align?: 'left' | 'center' | 'right'
            conversation?: 'all' | 'none'
            dnt?: boolean
          }
        ) => Promise<HTMLElement>
      }
    }
  }
}

let widgetScriptPromise: Promise<void> | null = null

export function loadTwitterWidgets(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.twttr?.widgets) return Promise.resolve()
  if (widgetScriptPromise) return widgetScriptPromise

  widgetScriptPromise = new Promise((resolve) => {
    const existing = document.getElementById('twitter-widgets-js')
    if (existing) {
      const check = () => {
        if (window.twttr?.widgets) resolve()
        else window.setTimeout(check, 100)
      }
      check()
      return
    }

    const script = document.createElement('script')
    script.id = 'twitter-widgets-js'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      const check = () => {
        if (window.twttr?.widgets) resolve()
        else window.setTimeout(check, 100)
      }
      check()
    }
    document.head.appendChild(script)
  })

  return widgetScriptPromise
}

export async function renderTweetEmbed(container: HTMLElement, src: string) {
  const tweetId = extractTweetId(src)
  if (!tweetId) return false

  container.innerHTML = ''
  await loadTwitterWidgets()

  try {
    await window.twttr?.widgets.createTweet(tweetId, container, {
      align: 'center',
      conversation: 'none',
      dnt: true,
    })
  } catch {
    container.innerHTML = `<a href="${src}" target="_blank" rel="noopener noreferrer" style="color:#1da1f2">${src}</a>`
  }

  return true
}

export async function enhanceTwitterEmbeds(root: Document | Element) {
  const embeds = Array.from(root.querySelectorAll<HTMLElement>('div[data-twitter-src]'))
  await Promise.all(embeds.map(async (container) => {
    const src = container.getAttribute('data-twitter-src')
    if (!src) return
    await renderTweetEmbed(container, src)
  }))
}
