/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/features/admin/admin-service', () => ({
  getDashboardStats: jest.fn(),
}))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/features/admin/admin-service'

const mockCreateClient = jest.mocked(createClient)
const mockGetDashboardStats = jest.mocked(getDashboardStats)

const mockStats = {
  dau: 10,
  totalRewrites: 50,
  totalApiCalls: 120,
  totalCostYuan: 1.5,
  satisfactionRate: 0.875,
}

function makeRequest(range?: string) {
  const url = range
    ? `http://localhost/api/admin/dashboard?range=${range}`
    : 'http://localhost/api/admin/dashboard'
  return new Request(url, { method: 'GET' })
}

/** 构建 supabase mock 链：getUser + from().select().eq().single() */
function mockSupabase(user: { id: string } | null, role: string | null, authError = false) {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user },
    error: authError ? { message: 'auth error' } : null,
  })
  const single = jest.fn().mockResolvedValue({
    data: role ? { role } : null,
    error: null,
  })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  const mockFrom = jest.fn().mockReturnValue({ select })

  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetDashboardStats.mockResolvedValue(mockStats)
})

describe('GET /api/admin/dashboard', () => {
  it('未登录返回 401', async () => {
    mockSupabase(null, null)

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('认证异常返回 401', async () => {
    mockSupabase(null, null, true)

    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('非 admin 用户返回 403', async () => {
    mockSupabase({ id: 'user-1' }, 'user')

    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('users 表无数据时返回 403（孤儿用户）', async () => {
    mockSupabase({ id: 'user-1' }, null)

    const res = await GET(makeRequest())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('admin 用户无 range 参数返回 200，默认 today 数据', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(mockStats)
    expect(body.error).toBeNull()
    expect(mockGetDashboardStats).toHaveBeenCalledWith('today')
  })

  it('admin 用户 range=7d 返回 200，调用正确 range', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')

    const res = await GET(makeRequest('7d'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(mockStats)
    expect(mockGetDashboardStats).toHaveBeenCalledWith('7d')
  })

  it('admin 用户 range=30d 返回 200，调用正确 range', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')

    const res = await GET(makeRequest('30d'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(mockStats)
    expect(mockGetDashboardStats).toHaveBeenCalledWith('30d')
  })

  it('admin 用户传入非法 range 值时默认 today', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')

    const res = await GET(makeRequest('invalid'))
    expect(res.status).toBe(200)
    expect(mockGetDashboardStats).toHaveBeenCalledWith('today')
  })
})
