import 'server-only'
import { prisma } from '@/lib/prisma'
import { Feedback } from '@/generated/prisma/enums'

// ── 用户管理 ──────────────────────────────────────────────────────

export type UserListItem = {
  id: string
  phone: string | null        // 脱敏后（138****1234）
  displayName: string
  role: string
  isBanned: boolean
  createdAt: Date
  rewriteCount: number
  lastActiveAt: Date | null
}

/** 手机号脱敏：保留前3位和后4位，中间替换为 ****
 *  - 长度 < 7 位时无法有效脱敏，返回 '***' 避免泄露原始值
 *  - phone 为 null 时原样返回
 */
function maskPhone(phone: string | null): string | null {
  if (!phone) return phone
  if (phone.length < 7) return '***'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export async function getUserList(options: {
  search?: string
  skip?: number
  take?: number
}): Promise<{ users: UserListItem[]; total: number }> {
  // 空字符串 search 应视为无过滤条件
  const trimmedSearch = options.search?.trim()
  const where = trimmedSearch ? { phone: { startsWith: trimmedSearch } } : {}

  const [rawUsers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        displayName: true,
        role: true,
        isBanned: true,
        createdAt: true,
        // 用 _count 聚合改写次数，避免加载全量记录
        _count: { select: { rewriteRecords: true } },
        // 只取最近一条用于 lastActiveAt
        rewriteRecords: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: options.skip ?? 0,
      take: options.take ?? 20,
    }),
    prisma.user.count({ where }),
  ])

  const users: UserListItem[] = rawUsers.map((u) => ({
    id: u.id,
    phone: maskPhone(u.phone),
    displayName: u.displayName,
    role: u.role,
    isBanned: u.isBanned,
    createdAt: u.createdAt,
    rewriteCount: u._count.rewriteRecords,
    lastActiveAt: u.rewriteRecords[0]?.createdAt ?? null,
  }))

  return { users, total }
}

export async function toggleUserBan(
  userId: string,
  banned: boolean
): Promise<{ id: string; isBanned: boolean }> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isBanned: banned },
    select: { id: true, isBanned: true },
  })
  return updated
}

// ── 仪表盘统计 ────────────────────────────────────────────────────

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
