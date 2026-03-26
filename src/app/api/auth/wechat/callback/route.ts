import 'server-only'
import { type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'
import { createServiceRoleClient } from '@/lib/supabase/server-admin'

// P9: strip trailing slash to prevent double-slash redirects
const APP_URL = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const wechatError = searchParams.get('error') // P5: user cancel / WeChat error

  const cookieStore = await cookies()
  const storedState = cookieStore.get('wechat_oauth_state')?.value

  // Always delete state cookie after reading to prevent replay attacks
  cookieStore.delete('wechat_oauth_state')

  // P5: WeChat returned an explicit error (e.g. user cancelled authorization)
  if (wechatError) {
    return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
  }

  // CSRF state validation
  if (!state || !storedState || state !== storedState) {
    return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
  }

  if (!code) {
    return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
  }

  // Exchange code for openid via WeChat API
  // P6: check tokenRes.ok  P7: AbortController timeout
  let openid: string
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token` +
        `?appid=${env.WECHAT_APP_ID}` +
        `&secret=${env.WECHAT_APP_SECRET}` +
        `&code=${code}` +
        `&grant_type=authorization_code`,
      { signal: controller.signal }
    )
    clearTimeout(timeoutId)

    // P6: guard against non-2xx responses (e.g. WeChat CDN 502)
    if (!tokenRes.ok) {
      return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
    }

    const tokenData = (await tokenRes.json()) as { openid?: string; errcode?: number }
    if (tokenData.errcode || !tokenData.openid) {
      return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
    }
    openid = tokenData.openid
  } catch {
    return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
  }

  const adminClient = createServiceRoleClient()
  const authEmail = `wechat_${openid}@wechat.internal`

  // Look up existing user by wechat_openid
  const { data: existingUser } = await adminClient
    .from('users')
    .select('id')
    .eq('wechat_openid', openid)
    .single()

  if (!existingUser) {
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
    })

    if (createError) {
      // P8: Handle race condition — a concurrent request may have already created this user
      if (!createError.message?.toLowerCase().includes('already')) {
        return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
      }
      // else: concurrent request created the user; fall through to generateLink
    } else if (!newAuthUser.user) {
      return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
    } else {
      // Sync to public.users with wechat_openid
      const { error: upsertError } = await adminClient.from('users').upsert(
        {
          id: newAuthUser.user.id,
          wechat_openid: openid,
          display_name: '微信用户',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )

      if (upsertError) {
        // P4: Clean up orphaned auth user to prevent permanent lockout on retry
        await adminClient.auth.admin.deleteUser(newAuthUser.user.id)
        return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
      }
    }
  }

  // Generate a magic link token to establish the Supabase session
  const { data, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: authEmail,
  })

  // P3: guard against missing properties or undefined hashed_token
  if (linkError || !data?.properties?.hashed_token) {
    return Response.redirect(`${APP_URL}/login?error=wechat_failed`)
  }

  // P0: store token in httpOnly cookie instead of URL param (prevents exposure in logs/history)
  cookieStore.set(
    'wechat_pending_otp',
    JSON.stringify({ token: data.properties.hashed_token, email: authEmail }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 120,
      path: '/',
    }
  )

  return Response.redirect(`${APP_URL}/auth/wechat-session`)
}
