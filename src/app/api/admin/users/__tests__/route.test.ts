/**
 * @jest-environment node
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/features/admin/admin-service', () => ({
  getUserList: jest.fn(),
  toggleUserBan: jest.fn(),
}))

// mock @/generated/prisma/client 的 Prisma 命名空间（PATCH 路由用于 instanceof 检查）
jest.mock('@/generated/prisma/client', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string
    constructor(message: string, { code }: { code: string; clientVersion: string }) {
      super(message)
      this.name = 'PrismaClientKnownRequestError'
      this.code = code
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } }
})

// ── Import after mocks ─────────────────────────────────────────────────────────

import { GET } from '../route'
import { PATCH } from '../[id]/route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getUserList, toggleUserBan } from '@/features/admin/admin-service'

const mockCreateClient = jest.mocked(createClient)
const mockPrismaUserFindUnique = jest.mocked(prisma.user.findUnique)
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

/**
 * 构建 auth mock + Prisma role mock。
 * 路由用 supabase.auth.getUser() 做身份验证，用 prisma.user.findUnique() 检查管理员角色。
 */
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
  mockCreateClient.mockResolvedValue({
    auth: { getUser: mockGetUser },
  } as never)

  // 配置 Prisma role 查询
  if (!user || roleError) {
    mockPrismaUserFindUnique.mockResolvedValue(null)
  } else {
    mockPrismaUserFindUnique.mockResolvedValue({ role: role ?? 'user' } as never)
  }
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
    const { Prisma } = jest.requireMock('@/generated/prisma/client')
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '7.5.0',
    })
    mockToggleUserBan.mockRejectedValue(err)
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
