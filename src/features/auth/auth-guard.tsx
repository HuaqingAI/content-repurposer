'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  // useRef 防止 React Strict Mode 双重调用 useEffect 时重复订阅
  // 来自 Story 2.2 Review Finding #12 的经验
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  // P7 fix: 防止 SIGNED_OUT 事件重复触发时多次调用 router.push
  const isRedirectingRef = useRef(false)

  useEffect(() => {
    if (subscriptionRef.current) return

    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !isRedirectingRef.current) {
        isRedirectingRef.current = true
        router.push('/login')
      }
      // TOKEN_REFRESHED 等其他事件：无需跳转，继续正常渲染
    })

    subscriptionRef.current = subscription

    return () => {
      subscription.unsubscribe()
      subscriptionRef.current = null
    }
  }, [router])

  // proxy（Next.js 16 Middleware）已在服务端完成认证检查
  // 客户端 AuthGuard 仅处理会话在页面打开期间过期的情况
  return <>{children}</>
}
