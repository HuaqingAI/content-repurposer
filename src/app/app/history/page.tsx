import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { HistoryList } from '@/features/history/history-list'
import { PAGE_SIZE } from '@/features/history/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '改写历史 | 适文',
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // proxy.ts 已保证登录，此处 user 不应为 null；防御性处理
  if (!user) redirect('/login')

  const [records, total] = await Promise.all([
    prisma.rewriteRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: PAGE_SIZE,
      select: {
        id: true,
        originalText: true,
        contentType: true,
        createdAt: true,
        results: {
          select: { id: true, platform: true },
        },
      },
    }),
    prisma.rewriteRecord.count({ where: { userId: user.id } }),
  ])

  // 截取 originalText 前 100 字（Unicode 安全）
  const recordsWithPreview = records.map((r) => ({
    ...r,
    originalText: [...r.originalText].slice(0, 100).join(''),
    createdAt: r.createdAt.toISOString(),
  }))

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-6">改写历史</h1>
      <HistoryList
        initialRecords={recordsWithPreview}
        initialTotal={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  )
}
