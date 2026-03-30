/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// Mock @supabase/ssr createServerClient
const mockGetUser = jest.fn()
const mockFrom = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

// Import proxy AFTER mocks are set up
import { proxy, config } from '@/proxy'

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`))
}

/** 构建 supabase.from().select().eq().single() 链的 mock（成功路径） */
function mockRoleQuery(role: string | null) {
  const single = jest.fn().mockResolvedValue({ data: role ? { role } : null, error: null })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  mockFrom.mockReturnValue({ select })
}

/** 构建 supabase.from().select().eq().single() 链的 mock（查询失败路径） */
function mockRoleQueryError(message: string) {
  const single = jest.fn().mockResolvedValue({ data: null, error: { message } })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })
  mockFrom.mockReturnValue({ select })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('proxy - 路由守卫', () => {
  describe('未登录用户访问受保护路由', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
    })

    it('访问 /app 跳转到 /login（302）', async () => {
      const req = createRequest('/app')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('访问 /app/history 跳转到 /login', async () => {
      const req = createRequest('/app/history')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('访问 /app/settings 跳转到 /login', async () => {
      const req = createRequest('/app/settings')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('访问 /admin 跳转到 /login（未登录）', async () => {
      const req = createRequest('/admin')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('访问 /admin/users 跳转到 /login（未登录）', async () => {
      const req = createRequest('/admin/users')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/login')
    })
  })

  describe('已登录普通用户（role: user）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
      mockRoleQuery('user')
    })

    it('访问 /login 跳转到 /app（302）', async () => {
      const req = createRequest('/login')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/app')
    })

    it('访问 /app 正常通过（200）', async () => {
      const req = createRequest('/app')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })

    it('访问 /admin 被重定向到 /app（非 admin）', async () => {
      const req = createRequest('/admin')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/app')
    })

    it('访问 /admin/users 被重定向到 /app（非 admin）', async () => {
      const req = createRequest('/admin/users')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/app')
    })

    it('访问 /admin/platform-configs 被重定向到 /app（非 admin）', async () => {
      const req = createRequest('/admin/platform-configs')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/app')
    })
  })

  describe('已登录 admin 用户（role: admin）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-999' } } })
      mockRoleQuery('admin')
    })

    it('访问 /admin 正常通过（200）', async () => {
      const req = createRequest('/admin')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })

    it('访问 /admin/users 正常通过（200）', async () => {
      const req = createRequest('/admin/users')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })

    it('访问 /admin/platform-configs 正常通过（200）', async () => {
      const req = createRequest('/admin/platform-configs')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })

    it('访问 /app 正常通过（admin 也是普通用户）', async () => {
      const req = createRequest('/app')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })
  })

  describe('users 表无对应行（孤儿 Auth 用户）', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'orphan-user' } } })
      mockRoleQuery(null)
    })

    it('访问 /admin — 孤儿用户被重定向到 /app', async () => {
      const req = createRequest('/admin')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/app')
    })
  })

  describe('role 查询 DB 异常处理', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
      mockRoleQueryError('connection timeout')
    })

    it('访问 /admin — DB 查询失败时 fail-safe 重定向到 /app', async () => {
      const req = createRequest('/admin')
      const res = await proxy(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/app')
    })
  })

  describe('非 /admin 路由不触发 role 查询', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    })

    it('访问 /app 不查询 users.role', async () => {
      const req = createRequest('/app')
      await proxy(req)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('访问 / 不查询 users.role', async () => {
      const req = createRequest('/')
      await proxy(req)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('matcher 配置', () => {
    it('matcher 已定义', () => {
      expect(config.matcher).toBeDefined()
      expect(Array.isArray(config.matcher)).toBe(true)
    })
  })
})
