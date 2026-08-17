import { NextResponse } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSetting } from '@/lib/db'

// 公开 API：返回字体设置（无需认证）
// 只暴露 body_font 这一个 key，不暴露其他设置
export async function GET() {
  try {
    const env = await getAppCloudflareEnv()
    if (!env?.DB) {
      return NextResponse.json({ font: '' })
    }
    const font = (await getSetting(env.DB, 'body_font')) || ''
    return NextResponse.json(
      { font },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    )
  } catch {
    return NextResponse.json({ font: '' })
  }
}
