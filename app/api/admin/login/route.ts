import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPassword,
  getSessionToken,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  getAdminAuthConfigError,
} from '@/lib/admin-auth'

export async function POST(req: NextRequest) {
  try {
    const configError = await getAdminAuthConfigError()
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 503 })
    }

    const { password } = (await req.json()) as { password?: string }

    if (!password || !(await verifyPassword(password))) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    const token = await getSessionToken()
    if (!token) {
      return NextResponse.json({ error: '管理员鉴权初始化失败，请检查环境变量配置' }, { status: 503 })
    }
    const response = NextResponse.json({ success: true })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    })

    return response
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
}
