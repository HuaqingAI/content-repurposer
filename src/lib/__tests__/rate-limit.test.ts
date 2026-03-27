/**
 * @jest-environment node
 */
import { checkRateLimit, RATE_LIMIT, __resetStoreForTesting } from '@/lib/rate-limit'

beforeEach(() => {
  __resetStoreForTesting()
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('checkRateLimit', () => {
  it('第 1 次请求 allowed=true，remaining=4', () => {
    const result = checkRateLimit('user-1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('连续 5 次请求均 allowed=true', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('user-1').allowed).toBe(true)
    }
  })

  it('第 6 次请求 allowed=false，remaining=0', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-1')
    }
    const result = checkRateLimit('user-1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('不同用户 ID 独立计数', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-1')
    }
    const result = checkRateLimit('user-2')
    expect(result.allowed).toBe(true)
  })

  it('窗口到期后计数重置', () => {
    jest.useFakeTimers()
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-1')
    }
    expect(checkRateLimit('user-1').allowed).toBe(false)
    jest.advanceTimersByTime(RATE_LIMIT.windowMs + 1)
    expect(checkRateLimit('user-1').allowed).toBe(true)
    jest.useRealTimers()
  })

  it('resetAt 为未来时间戳', () => {
    const now = Date.now()
    const result = checkRateLimit('user-1')
    expect(result.resetAt).toBeGreaterThan(now)
    expect(result.resetAt).toBeLessThanOrEqual(now + RATE_LIMIT.windowMs + 10)
  })
})
