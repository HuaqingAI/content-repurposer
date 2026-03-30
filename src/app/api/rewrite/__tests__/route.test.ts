/**
 * @jest-environment node
 */

// jest.mock 调用会被 babel-jest 提升到文件顶部执行，
// 因此不能在 mock factory 中引用文件顶层的 const 变量（TDZ 问题）。
// 正确做法：在 mock factory 中使用 jest.fn()，再通过 jest.mocked() 获取类型化引用。

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

const mockCreateClient = jest.mocked(createClient)
const mockCheckRateLimit = jest.mocked(checkRateLimit)
const mockPrismaUserFindUnique = jest.mocked(prisma.user.findUnique)

function makeRequest() {
  return new Request('http://localhost/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '测试', platforms: ['xiaohongshu'], tone: 'standard' }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  // 默认：用户未被禁用
  mockPrismaUserFindUnique.mockResolvedValue({ isBanned: false } as never)
})

describe('POST /api/rewrite', () => {
  it('未登录返回 401', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('认证服务异常返回 503', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'connection error' },
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('已登录 + 限流通过返回 501（桩）', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })

    const res = await POST(makeRequest())
    expect(res.status).toBe(501)
  })

  it('已登录 + 超限返回 429，含正确 error body', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })

    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(body.data).toBeNull()
  })

  it('超限时响应包含 Retry-After header', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })

    const res = await POST(makeRequest())
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('限流通过时以 user.id 调用 checkRateLimit', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 3, resetAt: Date.now() + 60000 })

    await POST(makeRequest())
    expect(mockCheckRateLimit).toHaveBeenCalledWith('user-abc')
  })

  it('已禁用用户返回 403 ACCOUNT_BANNED', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'banned-user' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockPrismaUserFindUnique.mockResolvedValue({ isBanned: true } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_BANNED')
    expect(body.data).toBeNull()
  })
})
