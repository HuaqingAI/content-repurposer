'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DashboardStats, DateRange } from './admin-service'

const RANGE_LABELS: Record<DateRange, string> = {
  today: '今日',
  '7d': '7 日',
  '30d': '30 日',
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-sm text-gray-500 mb-2">{title}</p>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function formatSatisfactionRate(rate: number | null): string {
  if (rate === null) return '暂无数据'
  return `${(rate * 100).toFixed(1)}%`
}

function formatCost(yuan: number): string {
  return `¥${yuan.toFixed(2)}`
}

export default function DashboardStats() {
  const [range, setRange] = useState<DateRange>('today')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async (r: DateRange, signal: AbortSignal) => {
    setLoading(true)
    setStats(null)
    setError(null)
    try {
      const res = await fetch(`/api/admin/dashboard?range=${r}`, { signal })
      const body = await res.json()
      if (!res.ok || body.error) {
        setError(body.error?.message ?? '加载失败')
      } else {
        setStats(body.data)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchStats(range, controller.signal)
    return () => controller.abort()
  }, [range, fetchStats])

  return (
    <div>
      {/* 时间范围切换 */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              range === r
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="text-red-500 text-sm mb-4">{error}</div>
      )}

      {/* 指标卡片 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard title="日活用户（DAU）" value={String(stats.dau)} />
          <StatCard title="总改写次数" value={String(stats.totalRewrites)} />
          <StatCard title="API 调用量" value={String(stats.totalApiCalls)} />
          <StatCard title="API 总成本" value={formatCost(stats.totalCostYuan)} />
          <StatCard title="反馈满意率" value={formatSatisfactionRate(stats.satisfactionRate)} />
        </div>
      ) : null}
    </div>
  )
}
