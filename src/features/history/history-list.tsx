'use client'

import { useEffect, useRef, useState } from 'react'
import { HistoryRecordCard } from './history-record-card'
import { HistoryDetailModal } from './history-detail-modal'
import { HistoryEmptyState } from './history-empty-state'
import type { HistoryRecordSummary } from './types'

interface HistoryListProps {
  initialRecords: HistoryRecordSummary[]
  initialTotal: number
  pageSize: number
  /** 如果为 true，则在组件挂载后通过 API 加载第一页数据（无需 SSR 预取） */
  fetchOnMount?: boolean
}

export function HistoryList({ initialRecords, initialTotal, pageSize, fetchOnMount }: HistoryListProps) {
  const [records, setRecords] = useState<HistoryRecordSummary[]>(initialRecords)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(!!fetchOnMount)
  // ref 防止快速双击在 React 状态更新前并发触发
  const loadingRef = useRef(false)

  useEffect(() => {
    if (!fetchOnMount) return
    fetch('/api/rewrite/history?page=1')
      .then((r) => r.json())
      .then((body) => {
        if (body.data) {
          setRecords(body.data.records ?? [])
          setTotal(body.data.total ?? 0)
        }
      })
      .catch(() => {
        // 加载失败时保持空状态
      })
      .finally(() => setInitializing(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hasMore = records.length < total

  async function handleLoadMore() {
    if (loadingRef.current) return
    loadingRef.current = true
    const nextPage = page + 1
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const res = await fetch(`/api/rewrite/history?page=${nextPage}`)
      if (!res.ok) {
        setLoadMoreError('加载失败，请重试')
        return
      }
      const body = await res.json()
      if (body.data) {
        setRecords((prev) => [...prev, ...body.data.records])
        setTotal(body.data.total)
        setPage(nextPage)
      } else {
        setLoadMoreError(body.error?.message ?? '加载失败，请重试')
      }
    } catch {
      setLoadMoreError('网络错误，请重试')
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }

  if (initializing) return null

  if (records.length === 0 && total === 0) {
    return <HistoryEmptyState />
  }

  return (
    <div>
      <div className="space-y-3">
        {records.map((record) => (
          <HistoryRecordCard
            key={record.id}
            record={record}
            onClick={(id) => setSelectedId(id)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-6 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? '加载中...' : `加载更多（已显示 ${records.length} / ${total} 条）`}
          </button>
          {loadMoreError && (
            <p className="text-xs text-red-500">{loadMoreError}</p>
          )}
        </div>
      )}

      {pageSize > 0 && !hasMore && records.length > pageSize && (
        <p className="mt-4 text-center text-xs text-gray-400">已显示全部 {total} 条记录</p>
      )}

      <HistoryDetailModal
        recordId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
