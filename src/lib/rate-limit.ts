export const RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 分钟
} as const

// 内存存储清理阈值：超过此数量时触发惰性全局扫描，防止内存无限增长
const STORE_MAX_SIZE = 10_000

interface RateLimitEntry {
  count: number
  resetAt: number // Unix timestamp (ms)
}

// 内存存储：userId -> 限流条目
// MVP 单实例 Docker 场景下足够；多实例场景需替换为 Redis（Post-MVP）
const rateLimitStore = new Map<string, RateLimitEntry>()

export function checkRateLimit(userId: string): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  // 防御性校验：空 userId 视为超限拒绝
  if (!userId) {
    return { allowed: false, remaining: 0, resetAt: Date.now() + RATE_LIMIT.windowMs }
  }

  const now = Date.now()
  const entry = rateLimitStore.get(userId)

  // 条目不存在或窗口已过期 → 新窗口
  if (!entry || entry.resetAt <= now) {
    // 惰性全局清理：存储条目超出阈值时扫描删除所有过期项
    if (rateLimitStore.size >= STORE_MAX_SIZE) {
      for (const [key, val] of rateLimitStore) {
        if (val.resetAt <= now) rateLimitStore.delete(key)
      }
    }
    const resetAt = now + RATE_LIMIT.windowMs
    rateLimitStore.set(userId, { count: 1, resetAt })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1, resetAt }
  }

  // 窗口内已达上限
  if (entry.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  // 窗口内正常累计
  entry.count++
  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/** 仅供测试使用，重置内存存储（非 test 环境为 no-op） */
export function __resetStoreForTesting() {
  if (process.env.NODE_ENV !== 'test') return
  rateLimitStore.clear()
}

// ─── IP 限流（试用模式）───────────────────────────────────────────────────────
// 未登录用户按 IP 限流，每小时最多 3 次，防止试用功能被滥用

export const IP_RATE_LIMIT = {
  maxRequests: 3,
  windowMs: 60 * 60 * 1000, // 1 小时
} as const

// 独立 store，不与用户限流 store 混用
const ipRateLimitStore = new Map<string, RateLimitEntry>()

export function checkIpRateLimit(ip: string): {
  allowed: boolean
  resetAt: number
} {
  // 防御性校验：空 IP 视为超限拒绝
  if (!ip) {
    return { allowed: false, resetAt: Date.now() + IP_RATE_LIMIT.windowMs }
  }

  const now = Date.now()
  const entry = ipRateLimitStore.get(ip)

  // 条目不存在或窗口已过期 → 新窗口
  if (!entry || entry.resetAt <= now) {
    if (ipRateLimitStore.size >= STORE_MAX_SIZE) {
      for (const [key, val] of ipRateLimitStore) {
        if (val.resetAt <= now) ipRateLimitStore.delete(key)
      }
    }
    const resetAt = now + IP_RATE_LIMIT.windowMs
    ipRateLimitStore.set(ip, { count: 1, resetAt })
    return { allowed: true, resetAt }
  }

  // 窗口内已达上限
  if (entry.count >= IP_RATE_LIMIT.maxRequests) {
    return { allowed: false, resetAt: entry.resetAt }
  }

  // 窗口内正常累计
  entry.count++
  return { allowed: true, resetAt: entry.resetAt }
}

/** 仅供测试使用，重置 IP 限流存储（非 test 环境为 no-op） */
export function __resetIpStoreForTesting() {
  if (process.env.NODE_ENV !== 'test') return
  ipRateLimitStore.clear()
}
