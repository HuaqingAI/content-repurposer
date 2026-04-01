'use client'

import { useState } from 'react'

function getErrorMessage(url: string): string {
  try {
    const { hostname } = new URL(url)
    if (hostname === 'mp.weixin.qq.com') {
      return '微信文章有防爬保护，请在文章页全选正文后复制，再切换到「粘贴全文」标签粘贴'
    }
    if (hostname === 'www.xiaohongshu.com' || hostname === 'xiaohongshu.com' || hostname === 'xhslink.com') {
      return '小红书笔记需要登录才能访问，请手动复制正文内容后粘贴'
    }
    if (hostname === 'zhuanlan.zhihu.com' || hostname === 'www.zhihu.com') {
      return '无法提取知乎文章，请手动复制正文内容后粘贴'
    }
  } catch {
    // 非法 URL，走默认提示
  }
  return '无法自动提取该链接的内容，请手动复制文章文本后粘贴'
}

interface UrlInputProps {
  onExtracted: (text: string) => void
  onError: (message?: string) => void
  disabled?: boolean
}

export function UrlInput({ onExtracted, onError, disabled = false }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!url.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: AbortSignal.timeout(15_000),
      })
      const json = await res.json()
      if (json.data?.success && json.data?.text) {
        onExtracted(json.data.text)
      } else {
        const msg = getErrorMessage(url.trim())
        setError(msg)
        onError(msg)
      }
    } catch {
      // 超时 (AbortError) 或网络错误
      const msg = getErrorMessage(url.trim())
      setError(msg)
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴公众号/知乎/小红书文章链接..."
          disabled={disabled || loading}
          className="flex-1 rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-[13.5px] text-ink placeholder:text-text-caption focus:outline-none focus:border-border-focus disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={!url.trim() || loading || disabled}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
        >
          {loading ? '提取中...' : '提取正文'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <p className="text-xs text-text-caption">支持微信公众号、知乎、小红书链接（Best Effort）</p>
    </div>
  )
}
