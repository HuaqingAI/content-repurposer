import Link from 'next/link'

export function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-gray-500 text-base mb-4">还没有改写记录，去改写第一篇吧</p>
      <Link
        href="/app"
        className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
      >
        开始改写
      </Link>
    </div>
  )
}
