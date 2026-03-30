'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PLATFORM_LABELS,
  TONE_LABELS,
  type HistoryRecordDetail,
  type HistoryResult,
} from './types'

// URL query param 安全上限（超出截断以避免 414/浏览器截断问题）
const MAX_TEXT_URL_CHARS = 1500

interface DetailData {
  record: HistoryRecordDetail
  results: HistoryResult[]
}

interface HistoryDetailModalProps {
  recordId: string | null
  onClose: () => void
}

function ResultSection({ result }: { result: HistoryResult }) {
  const [expanded, setExpanded] = useState(false)
  const titles = Array.isArray(result.titles) ? result.titles : []
  const tags = Array.isArray(result.tags) ? result.tags : []

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {PLATFORM_LABELS[result.platform] ?? result.platform}
        </span>
        <span className="text-xs text-gray-500">{TONE_LABELS[result.tone] ?? result.tone}</span>
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{result.body}</p>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs text-blue-500 hover:text-blue-700"
        >
          {expanded ? '收起标题/标签/引导语' : '展开标题/标签/引导语'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 text-sm">
            {titles.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">备选标题</p>
                <ul className="space-y-1">
                  {titles.map((t, i) => (
                    <li key={`title-${i}-${t}`} className="text-gray-700">
                      {i + 1}. {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tags.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">推荐标签</p>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag, i) => (
                    <span key={`tag-${i}-${tag}`} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.hook && (
              <div>
                <p className="text-xs text-gray-500 mb-1">互动引导语</p>
                <p className="text-gray-700">{result.hook}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function HistoryDetailModal({ recordId, onClose }: HistoryDetailModalProps) {
  const router = useRouter()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleReuse() {
    if (!data) return
    const platforms = [...new Set(data.results.map((r) => r.platform))]
    const tone = data.results[0]?.tone ?? 'standard'
    const params = new URLSearchParams()
    // 截断超长文本以避免 URL 超出安全长度限制
    const safeText = data.record.originalText.length > MAX_TEXT_URL_CHARS
      ? data.record.originalText.slice(0, MAX_TEXT_URL_CHARS)
      : data.record.originalText
    params.set('text', safeText)
    if (platforms.length > 0) params.set('platforms', platforms.join(','))
    params.set('tone', tone)
    router.push(`/app?${params.toString()}`)
    onClose()
  }

  useEffect(() => {
    if (!recordId) {
      setData(null)
      return
    }

    // 切换记录时立即清空旧数据，避免显示上一条记录内容
    setData(null)
    setLoading(true)
    setError(null)

    const controller = new AbortController()

    fetch(`/api/rewrite/history/${recordId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((body) => {
        if (body.error) {
          setError(body.error.message)
        } else {
          setData(body.data)
        }
      })
      .catch((err) => {
        // AbortError 是正常取消，不展示错误
        if (err.name !== 'AbortError') {
          setError('加载失败，请重试')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [recordId])

  if (!recordId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">改写详情</h2>
          <div className="flex items-center gap-3">
            {data && (
              <button
                type="button"
                onClick={handleReuse}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
              >
                重新改写
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="flex justify-center py-10">
              <span className="text-sm text-gray-400">加载中...</span>
            </div>
          )}

          {error && (
            <div className="text-center py-10">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">原文</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                  {data.record.originalText}
                </p>
              </div>

              {data.results.map((result) => (
                <ResultSection key={result.id} result={result} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
