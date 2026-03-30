'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // P1: 组件卸载时清除未触发的 timer，避免 setState on unmounted component
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      // P3: 非安全上下文（HTTP）或旧浏览器中 clipboard 可能不存在
      if (!navigator.clipboard) return
      try {
        await navigator.clipboard.writeText(text)
        // P2: 快速多次点击时先清除前一个 timer，避免状态抖动
        if (timerRef.current) clearTimeout(timerRef.current)
        setCopied(true)
        timerRef.current = setTimeout(() => setCopied(false), 1500)
      } catch {
        // 静默忽略：用户拒绝 clipboard 权限
      }
    },
    [text]
  )

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        'text-xs px-2 py-0.5 rounded transition-colors',
        copied ? 'text-accent' : 'text-text-secondary hover:text-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={copied ? '已复制' : '复制'}
    >
      {copied ? '已复制 ✓' : '复制'}
    </button>
  )
}
