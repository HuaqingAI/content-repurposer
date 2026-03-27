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
