'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function WechatSessionContent() {
  const router = useRouter()
  const didRun = useRef(false) // P11: prevent double-run in React Strict Mode

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    // P0: token is in httpOnly cookie (not URL) — exchange via server-side API route
    fetch('/api/auth/wechat/exchange')
      .then((res) => res.json() as Promise<{ success: boolean }>)
      .then(({ success }) => {
        if (success) {
          router.push('/app')
        } else {
          router.push('/login?error=wechat_failed')
        }
      })
      .catch(() => {
        router.push('/login?error=wechat_failed')
      })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">正在登录...</p>
    </div>
  )
}
