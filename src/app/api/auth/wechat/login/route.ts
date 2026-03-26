import 'server-only'
import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { env } from '@/lib/env'

// P9: strip trailing slash to prevent double-slash redirects
const APP_URL = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

export async function GET(_request: NextRequest) {
  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('wechat_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // P2: require Secure in production
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  const redirectUri = encodeURIComponent(`${APP_URL}/api/auth/wechat/callback`)

  const wechatAuthUrl =
    `https://open.weixin.qq.com/connect/oauth2/authorize` +
    `?appid=${encodeURIComponent(env.WECHAT_APP_ID)}` + // P10: URI-encode AppID
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=snsapi_userinfo` +
    `&state=${state}` +
    `#wechat_redirect`

  return Response.redirect(wechatAuthUrl)
}
