import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteUrl } from '@/lib/site-config'
import { PERSONAL_SITE } from '@/lib/personal-site'

const SITE_URL = getSiteUrl()
const SITE_TITLE = PERSONAL_SITE.siteName
const SITE_DESCRIPTION = PERSONAL_SITE.description

interface RssPost {
  slug: string
  title: string
  description: string | null
  html: string | null
  category: string | null
  published_at: number
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  let posts: RssPost[] = []

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      // RSS needs html field; query directly to include it
      const { results } = await env.DB
        .prepare(
          `SELECT slug, title, description, html, category, published_at
           FROM posts
           WHERE status = 'published' AND deleted_at IS NULL AND password IS NULL AND is_hidden = 0
           ORDER BY published_at DESC
           LIMIT 50`
        )
        .all()
      posts = results as unknown as RssPost[]
    }
  } catch {
    // ignore
  }

  const items = posts
    .map((p) => {
      const pubDate = new Date(p.published_at * 1000).toUTCString()
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/${p.slug}</guid>
      <description>${escapeXml(p.description || '')}</description>
      <content:encoded><![CDATA[${p.html || ''}]]></content:encoded>
      <category>${escapeXml(p.category || '未分类')}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE_TITLE}</title>
    <link>${SITE_URL}</link>
    <description>${SITE_DESCRIPTION}</description>
    <language>zh-CN</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
