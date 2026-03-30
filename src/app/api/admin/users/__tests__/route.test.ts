/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/features/admin/admin-service', () => ({
  getUserList: jest.fn(),
  toggleUserBan: jest.fn(),
}))

import { GET } from '../route'
import { PATCH } from '../[id]/route'
import { createClient } from '@/lib/supabase/server'
import { getUserList, toggleUserBan } from '@/features/admin/admin-service'

const mockCreateClient = jest.mocked(createClient)
const mockGetUserList = jest.mocked(getUserList)
const mockToggleUserBan = jest.mocked(toggleUserBan)

const mockUserList = [
  {
    id: 'user-1',
    phone: '138****1234',
    displayName: '测试用户',
    role: 'user',
    isBanned: false,
    createdAt: new Date('2026-01-01'),
    rewriteCount: 5,
    lastActiveAt: new Date('2026-03-01'),
  },
]

/** 构建 supabase mock 链：getUser + from().select().eq().single() */
function mockSupabase(
  user: { id: string } | null,
  role: string | null,
  authError = false,
  roleError = false
) {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user },
    error: authError ? { message: 'auth error' } : null,
  })
  const single = jest.fn().mockResolvedValue({
    data: role ? { role } : null,
    error: roleError ? { message: 'db error' } : null,
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
  mockGetUserList.mockResolvedValue({ users: mockUserList, total: 1 })
  mockToggleUserBan.mockResolvedValue({ id: 'user-1', isBanned: true })
})

// ── GET /api/admin/users ───────────────────────────────────────────

describe('GET /api/admin/users', () => {
  it('未登录返回 401', async () => {
    mockSupabase(null, null)
    const req = new Request('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('认证服务异常返回 503', async () => {
    mockSupabase(null, null, true)
    const req = new Request('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('非 admin 用户返回 403', async () => {
    mockSupabase({ id: 'user-1' }, 'user')
    const req = new Request('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('role 查询失败返回 403', async () => {
    mockSupabase({ id: 'user-1' }, null, false, true)
    const req = new Request('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('admin 用户返回 200 + 用户列表', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')
    const req = new Request('http://localhost/api/admin/users')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data.users).toHaveLength(1)
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
    expect(mockGetUserList).toHaveBeenCalledWith({ search: undefined, skip: 0, take: 20 })
  })

  it('admin 用户带 search 参数时传给 getUserList', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')
    const req = new Request('http://localhost/api/admin/users?search=138&page=2&pageSize=10')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockGetUserList).toHaveBeenCalledWith({ search: '138', skip: 10, take: 10 })
  })
})

// ── PATCH /api/admin/users/[id] ────────────────────────────────────

describe('PATCH /api/admin/users/[id]', () => {
  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) }
  }

  it('未登录返回 401', async () => {
    mockSupabase(null, null)
    const req = new Request('http://localhost/api/admin/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({ banned: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('user-1'))
    expect(res.status).toBe(401)
  })

  it('非 admin 返回 403', async () => {
    mockSupabase({ id: 'user-1' }, 'user')
    const req = new Request('http://localhost/api/admin/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({ banned: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('user-1'))
    expect(res.status).toBe(403)
  })

  it('banned 字段类型错误返回 400', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')
    const req = new Request('http://localhost/api/admin/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({ banned: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('user-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('admin 禁用用户返回 200', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')
    const req = new Request('http://localhost/api/admin/users/user-1', {
      method: 'PATCH',
      body: JSON.stringify({ banned: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('user-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data).toEqual({ id: 'user-1', isBanned: true })
    expect(mockToggleUserBan).toHaveBeenCalledWith('user-1', true)
  })

  it('用户不存在返回 404', async () => {
    mockSupabase({ id: 'admin-1' }, 'admin')
    mockToggleUserBan.mockRejectedValue({ code: 'P2025', message: 'Record not found' })
    const req = new Request('http://localhost/api/admin/users/non-existent', {
      method: 'PATCH',
      body: JSON.stringify({ banned: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, makeParams('non-existent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
