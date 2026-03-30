'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLATFORM_LABELS, CONTENT_TYPE_LABELS, type HistoryRecordSummary } from './types'

// URL query param 安全上限（超出截断以避免 414/浏览器截断问题）
const MAX_TEXT_URL_CHARS = 1500

interface HistoryRecordCardProps {
  record: HistoryRecordSummary
  onClick: (id: string) => void
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryRecordCard({ record, onClick }: HistoryRecordCardProps) {
  const router = useRouter()
  const [reuseLoading, setReuseLoading] = useState(false)
  const [reuseError, setReuseError] = useState<string | null>(null)
  const platforms = [...new Set(record.results.map((r) => r.platform))]
  const contentTypeLabel = CONTENT_TYPE_LABELS[record.contentType] ?? record.contentType

  async function handleReuse(e: React.MouseEvent) {
    e.stopPropagation()
    setReuseLoading(true)
    setReuseError(null)
    try {
      const res = await fetch(`/api/rewrite/history/${record.id}`)
      if (!res.ok) {
        setReuseError('加载失败')
        return
      }
      const body = await res.json()
      if (body.data) {
        const { record: detail, results } = body.data
        const tone = results[0]?.tone ?? 'standard'
        const params = new URLSearchParams()
        // 截断超长文本以避免 URL 超出安全长度限制
        const safeText = detail.originalText.length > MAX_TEXT_URL_CHARS
          ? detail.originalText.slice(0, MAX_TEXT_URL_CHARS)
          : detail.originalText
        params.set('text', safeText)
        if (platforms.length > 0) params.set('platforms', platforms.join(','))
        params.set('tone', tone)
        router.push(`/app?${params.toString()}`)
      } else {
        setReuseError(body.error?.message ?? '加载失败')
      }
    } catch {
      setReuseError('网络错误')
    } finally {
      setReuseLoading(false)
    }
  }

  return (
    <div className="relative group bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
      <button
        type="button"
        onClick={() => onClick(record.id)}
        className="w-full text-left p-4"
      >
        <p className="text-sm text-gray-800 leading-relaxed line-clamp-2 mb-3">
          {record.originalText}
        </p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
              {contentTypeLabel}
            </span>
            {platforms.map((p) => (
              <span
                key={p}
                className="inline-block px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600"
              >
                {PLATFORM_LABELS[p] ?? p}
              </span>
            ))}
          </div>
          <time className="text-xs text-gray-400 shrink-0">{formatDate(record.createdAt)}</time>
        </div>
      </button>
      {/* 快捷重新改写按钮（悬停显示） */}
      <div className="absolute right-3 top-3 hidden group-hover:flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={handleReuse}
          disabled={reuseLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-60 transition-all"
          aria-label="重新改写"
        >
          {reuseLoading ? '...' : '重新改写'}
        </button>
        {reuseError && (
          <span className="text-xs text-red-500 bg-white px-1 rounded">{reuseError}</span>
        )}
      </div>
    </div>
  )
}
