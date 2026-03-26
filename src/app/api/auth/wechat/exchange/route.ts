import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// P0: Server-side session exchange — reads the httpOnly cookie set by callback route,
// verifies the magic link token with Supabase SSR client (which sets session cookies
// on the response), and returns { success: true/false }.
export async function GET() {
  const cookieStore = await cookies()
  const pendingRaw = cookieStore.get('wechat_pending_otp')?.value

  if (!pendingRaw) {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  // Delete immediately to prevent replay
  cookieStore.delete('wechat_pending_otp')

  let token: string
  let email: string
  try {
    const parsed = JSON.parse(pendingRaw) as { token?: string; email?: string }
    if (!parsed.token || !parsed.email) {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    token = parsed.token
    email = parsed.email
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  // P1: use token_hash + type:'magiclink' — correct API for hashed_token from generateLink
  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    token_hash: token,
    type: 'magiclink',
  })

  if (error) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  // Session cookies are set by the Supabase SSR client via cookies().set()
  // and are automatically included in this NextResponse
  return NextResponse.json({ success: true })
}
