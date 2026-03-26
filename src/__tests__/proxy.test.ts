/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// Mock @supabase/ssr createServerClient
const mockGetUser = jest.fn()

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

// Import proxy AFTER mocks are set up
import { proxy, config } from '@/proxy'

function createRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`))
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('proxy - 路由守卫', () => {
  describe('未登录用户访问受保护路由', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null } })
    })

    it('访问 /app 跳转到 /login', async () => {
      const req = createRequest('/app')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('访问 /app/history 跳转到 /login', async () => {
      const req = createRequest('/app/history')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/login')
    })

    it('访问 /app/settings 跳转到 /login', async () => {
      const req = createRequest('/app/settings')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/login')
    })
  })

  describe('已登录用户', () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    })

    it('访问 /login 跳转到 /app', async () => {
      const req = createRequest('/login')
      const res = await proxy(req)
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/app')
    })

    it('访问 /app 正常通过（200）', async () => {
      const req = createRequest('/app')
      const res = await proxy(req)
      expect(res.status).toBe(200)
    })
  })

  describe('matcher 配置', () => {
    it('matcher 已定义', () => {
      expect(config.matcher).toBeDefined()
      expect(Array.isArray(config.matcher)).toBe(true)
    })
  })
})
