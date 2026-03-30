import 'server-only'
import { prisma } from '@/lib/prisma'
import { Feedback } from '@/generated/prisma/enums'

export type DateRange = 'today' | '7d' | '30d'

export type DashboardStats = {
  dau: number
  totalRewrites: number
  totalApiCalls: number
  totalCostYuan: number
  satisfactionRate: number | null // null 表示暂无反馈数据
}

// UTC+8（北京时间）偏移量，用于正确计算业务日边界
const CST_OFFSET_MS = 8 * 60 * 60 * 1000

export function getDateRange(range: DateRange): { startDate: Date; endDate: Date } {
  // 将 UTC 时间偏移到 CST，用 UTC 方法设定日边界，再偏移回 UTC 存储时间
  const nowCst = new Date(Date.now() + CST_OFFSET_MS)

  const endCst = new Date(nowCst)
  endCst.setUTCHours(23, 59, 59, 999)
  const endDate = new Date(endCst.getTime() - CST_OFFSET_MS)

  let startDate: Date
  if (range === 'today') {
    const startCst = new Date(nowCst)
    startCst.setUTCHours(0, 0, 0, 0)
    startDate = new Date(startCst.getTime() - CST_OFFSET_MS)
  } else if (range === '7d') {
    const startCst = new Date(nowCst)
    startCst.setUTCDate(nowCst.getUTCDate() - 6)
    startCst.setUTCHours(0, 0, 0, 0)
    startDate = new Date(startCst.getTime() - CST_OFFSET_MS)
  } else {
    const startCst = new Date(nowCst)
    startCst.setUTCDate(nowCst.getUTCDate() - 29)
    startCst.setUTCHours(0, 0, 0, 0)
    startDate = new Date(startCst.getTime() - CST_OFFSET_MS)
  }
  return { startDate, endDate }
}

export async function getDashboardStats(range: DateRange): Promise<DashboardStats> {
  const { startDate, endDate } = getDateRange(range)
  const dateFilter = { gte: startDate, lte: endDate }

  const [dauGroups, totalRewrites, totalApiCalls, costResult, helpfulCount, totalFeedback] =
    await Promise.all([
      // DAU：按 userId 分组，得到去重用户数
      prisma.rewriteRecord.groupBy({
        by: ['userId'],
        where: { createdAt: dateFilter },
      }),
      // 总改写次数
      prisma.rewriteRecord.count({
        where: { createdAt: dateFilter },
      }),
      // API 总调用量（每条 rewrite_result = 一次 LLM 调用）
      prisma.rewriteResult.count({
        where: { createdAt: dateFilter },
      }),
      // API 总成本（分）
      prisma.rewriteResult.aggregate({
        where: { createdAt: dateFilter },
        _sum: { apiCostCents: true },
      }),
      // 有帮助的反馈数
      prisma.rewriteResult.count({
        where: { createdAt: dateFilter, feedback: Feedback.helpful },
      }),
      // 有反馈的总数（helpful + not_helpful）
      prisma.rewriteResult.count({
        where: { createdAt: dateFilter, feedback: { not: null } },
      }),
    ])

  const dau = dauGroups.length
  const totalCostYuan = (costResult._sum.apiCostCents ?? 0) / 100
  const satisfactionRate = totalFeedback > 0 ? helpfulCount / totalFeedback : null

  return {
    dau,
    totalRewrites,
    totalApiCalls,
    totalCostYuan,
    satisfactionRate,
  }
}
