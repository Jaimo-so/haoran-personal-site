import { NextResponse } from 'next/server'
import { normalizeTheme } from '@/lib/appearance'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSetting } from '@/lib/db'

export async function GET() {
  try {
    const env = await getAppCloudflareEnv()
    if (!env?.DB) {
      return NextResponse.json({ font: '', defaultTheme: 'default' })
    }

    const [font, defaultTheme] = await Promise.all([
      getSetting(env.DB, 'body_font'),
      getSetting(env.DB, 'default_theme'),
    ])

    return NextResponse.json(
      { font: font || '', defaultTheme: normalizeTheme(defaultTheme) },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch {
    return NextResponse.json({ font: '', defaultTheme: 'default' })
  }
}
