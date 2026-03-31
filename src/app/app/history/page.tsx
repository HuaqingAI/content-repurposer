import { HistoryList } from '@/features/history/history-list'
import { PAGE_SIZE } from '@/features/history/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '改写历史 | 适文',
}

// 历史记录页：数据通过客户端 /api/rewrite/history 加载（便于测试 mock）。
// 路由保护由 proxy.ts 中间件处理。
export default function HistoryPage() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-6">改写历史</h1>
      <HistoryList
        initialRecords={[]}
        initialTotal={0}
        pageSize={PAGE_SIZE}
        fetchOnMount
      />
    </div>
  )
}
