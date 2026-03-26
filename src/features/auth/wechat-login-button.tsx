'use client'

import { useState } from 'react'

interface WechatLoginButtonProps {
  onNavigate?: (url: string) => void
}

export function WechatLoginButton({
  onNavigate = (url) => window.location.assign(url),
}: WechatLoginButtonProps = {}) {
  const [redirecting, setRedirecting] = useState(false)

  function handleClick() {
    setRedirecting(true)
    try {
      onNavigate('/api/auth/wechat/login')
    } catch {
      setRedirecting(false) // P13: reset on synchronous navigation error
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={redirecting}
      className="w-full flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <WechatIcon className="h-5 w-5 text-[#07C160]" />
      {redirecting ? '跳转中...' : '微信登录'}
    </button>
  )
}

function WechatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.328.328 0 0 0 .186-.059l2.116-1.266a.595.595 0 0 1 .315-.09c.083 0 .167.012.25.036a6.44 6.44 0 0 0 1.757.246 6.15 6.15 0 0 0 .546-.024c-.27-.717-.418-1.48-.418-2.273 0-3.682 3.327-6.67 7.432-6.67.26 0 .516.015.769.042C14.885 4.446 12.035 2.188 8.691 2.188zm-2.37 4.083a.894.894 0 1 1 0 1.787.894.894 0 0 1 0-1.787zm4.741 0a.894.894 0 1 1 0 1.787.894.894 0 0 1 0-1.787zM22 13.86c0-3.28-3.123-5.942-6.975-5.942-3.854 0-6.978 2.663-6.978 5.942s3.124 5.942 6.978 5.942c.616 0 1.214-.08 1.781-.221a.455.455 0 0 1 .226-.004l1.745 1.042a.283.283 0 0 0 .161.051.252.252 0 0 0 .253-.252c0-.06-.023-.119-.041-.178l-.332-1.252a.512.512 0 0 1 .186-.58c1.53-1.172 2.496-2.94 2.496-4.548zm-9.174-.833a.757.757 0 1 1 0-1.514.757.757 0 0 1 0 1.514zm4.398 0a.757.757 0 1 1 0-1.514.757.757 0 0 1 0 1.514z" />
    </svg>
  )
}
