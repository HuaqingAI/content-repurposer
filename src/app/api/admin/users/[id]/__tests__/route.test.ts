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
  toggleUserBan: jest.fn(),
}))

// PrismaClientKnownRequestError 来自 prisma runtime，jest 环境下需要 virtual mock
// 注意：jest.mock factory 会被提升，class 必须定义在 factory 内部
jest.mock('@/generated/prisma/runtime/library', () => {
  class PrismaClientKnownRequestError extends Error {
    code: string
    constructor(message: string, { code }: { code: string; clientVersion: string }) {
      super(message)
      this.name = 'PrismaClientKnownRequestError'
      this.code = code
    }
  }
  return { PrismaClientKnownRequestError }
}, { virtual: true })

// ── Import after mocks ─────────────────────────────────────────────────────────

import { PATCH } from '../route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { toggleUserBan } from '@/features/admin/admin-service'

const mockCreateClient = jest.mocked(createClient)
const mockFindUnique = jest.mocked(prisma.user.findUnique)
const mockToggleUserBan = jest.mocked(toggleUserBan)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown = { banned: true }) {
  return new Request('http://localhost/api/admin/users/target-user-id', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(id = 'target-user-id') {
  return { params: Promise.resolve({ id }) }
}

function setupAdminUser(userId = 'admin-user-id') {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
  mockFindUnique.mockResolvedValue({ role: 'admin' } as never)
}

function setupAuthError() {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user: null },
    error: { message: 'service error' },
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
}

function setupUnauthenticated() {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PATCH /api/admin/users/[id]', () => {
  // ── 认证与权限 ────────────────────────────────────────────────────────────

  it('认证服务异常 → 503', async () => {
    setupAuthError()
    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('未登录 → 401', async () => {
    setupUnauthenticated()
    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('非管理员用户 → 403', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'regular-user' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockFindUnique.mockResolvedValue({ role: 'user' } as never)

    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('用户不在 DB 中（角色查询返回 null）→ 403', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'ghost-user' } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
    mockFindUnique.mockResolvedValue(null)

    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(403)
  })

  // ── 请求体校验 ───────────────────────────────────────────────────────────

  it('banned 非布尔值 → 400', async () => {
    setupAdminUser()
    const req = new Request('http://localhost/api/admin/users/target-user-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: 'yes' }),
    })
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('请求体非 JSON → 400', async () => {
    setupAdminUser()
    const req = new Request('http://localhost/api/admin/users/target-user-id', {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })
    const res = await PATCH(req, makeParams())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ── 自禁保护 ──────────────────────────────────────────────────────────────

  it('管理员禁用自己 → 403', async () => {
    setupAdminUser('same-user-id')
    const res = await PATCH(makeRequest(), makeParams('same-user-id'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
    expect(body.error.message).toContain('自己')
  })

  // ── 业务逻辑 ──────────────────────────────────────────────────────────────

  it('用户不存在（Prisma P2025）→ 404', async () => {
    setupAdminUser()
    const { PrismaClientKnownRequestError: MockPrismaError } = jest.requireMock('@/generated/prisma/runtime/library') as { PrismaClientKnownRequestError: new (msg: string, opts: { code: string; clientVersion: string }) => Error & { code: string } }
    const prismaError = new MockPrismaError('Record not found', {
      code: 'P2025',
      clientVersion: '7.0.0',
    })
    mockToggleUserBan.mockRejectedValueOnce(prismaError)

    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('toggleUserBan 未知异常 → 500', async () => {
    setupAdminUser()
    mockToggleUserBan.mockRejectedValueOnce(new Error('DB failure'))

    const res = await PATCH(makeRequest(), makeParams())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('成功封禁 → 200 + {data, error:null}', async () => {
    setupAdminUser()
    mockToggleUserBan.mockResolvedValueOnce({ id: 'target-user-id', banned: true })

    const res = await PATCH(makeRequest({ banned: true }), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data).toEqual({ id: 'target-user-id', banned: true })
  })

  it('成功解封 → 200', async () => {
    setupAdminUser()
    mockToggleUserBan.mockResolvedValueOnce({ id: 'target-user-id', banned: false })

    const res = await PATCH(makeRequest({ banned: false }), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.banned).toBe(false)
  })

  it('以正确参数调用 toggleUserBan', async () => {
    setupAdminUser()
    mockToggleUserBan.mockResolvedValueOnce({ id: 'target-user-id', banned: true })

    await PATCH(makeRequest({ banned: true }), makeParams('target-user-id'))
    expect(mockToggleUserBan).toHaveBeenCalledWith('target-user-id', true)
  })
})
