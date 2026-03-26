import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WechatSessionContent } from './wechat-session-content'

export const metadata: Metadata = {
  robots: 'noindex',
}

export default function WechatSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">正在登录...</p>
        </div>
      }
    >
      <WechatSessionContent />
    </Suspense>
  )
}
