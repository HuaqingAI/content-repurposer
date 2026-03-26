/**
 * @jest-environment node
 */

// ── Mocks must be defined before imports ──────────────────────────────────────

const mockCookiesGet = jest.fn()
const mockCookiesSet = jest.fn()
const mockCookiesDelete = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  })),
}))

jest.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    WECHAT_APP_ID: 'test_app_id',
    WECHAT_APP_SECRET: 'test_app_secret',
  },
}))

const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockUpsert = jest.fn()
const mockCreateUser = jest.fn()
const mockDeleteUser = jest.fn()
const mockGenerateLink = jest.fn()

jest.mock('@/lib/supabase/server-admin', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
        generateLink: mockGenerateLink,
      },
    },
  })),
}))

// ── Import after mocks ─────────────────────────────────────────────────────────

import { NextRequest } from 'next/server'
import { GET } from '../route'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/auth/wechat/callback')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url.toString())
}

function mockWechatSuccess(openid = 'test_openid_abc') {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: 'mock_token', openid }),
  })
}

function mockWechatError(errcode = 40029) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ errcode, errmsg: 'invalid code' }),
  })
}

// ── Test setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn()
  // Default: valid state cookie
  mockCookiesGet.mockImplementation((name: string) =>
    name === 'wechat_oauth_state' ? { value: 'valid_state_123' } : undefined
  )
  // Default: no existing user
  mockSingle.mockResolvedValue({ data: null, error: null })
  // Default: createUser success
  mockCreateUser.mockResolvedValue({
    data: { user: { id: 'new-user-uuid' } },
    error: null,
  })
  // Default: upsert success
  mockUpsert.mockResolvedValue({ error: null })
  // Default: deleteUser success
  mockDeleteUser.mockResolvedValue({ error: null })
  // Default: generateLink success (includes both fields)
  mockGenerateLink.mockResolvedValue({
    data: { properties: { email_otp: 'mock_otp_token', hashed_token: 'mock_hashed_token' } },
    error: null,
  })
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/auth/wechat/callback', () => {
  describe('CSRF state validation', () => {
    it('state 不匹配时重定向到登录错误页', async () => {
      const req = makeRequest({ code: 'auth_code', state: 'wrong_state' })
      const res = await GET(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe(
        'http://localhost:3000/login?error=wechat_failed'
      )
    })

    it('无 state cookie 时重定向到登录错误页', async () => {
      mockCookiesGet.mockReturnValue(undefined)
      const req = makeRequest({ code: 'auth_code', state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })

    it('总是调用 cookie delete 清除 state', async () => {
      const req = makeRequest({ code: 'auth_code', state: 'wrong_state' })
      await GET(req)
      expect(mockCookiesDelete).toHaveBeenCalledWith('wechat_oauth_state')
    })
  })

  describe('WeChat error param (用户取消授权)', () => {
    it('回调携带 error 参数时重定向到错误页', async () => {
      const req = makeRequest({
        error: 'access_denied',
        state: 'valid_state_123',
      })
      const res = await GET(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })
  })

  describe('缺少 code 参数', () => {
    it('没有 code（用户取消授权）时重定向到错误页', async () => {
      const req = makeRequest({ state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })
  })

  describe('微信 API 失败', () => {
    it('微信 API 返回 errcode 时重定向到错误页', async () => {
      mockWechatError()
      const req = makeRequest({ code: 'bad_code', state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })

    it('微信 API 返回非 2xx 状态时重定向到错误页', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })
      const req = makeRequest({ code: 'auth_code', state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })

    it('微信 API 抛出异常时重定向到错误页', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network error'))
      const req = makeRequest({ code: 'auth_code', state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })
  })

  describe('新用户流程', () => {
    it('新用户：调用 createUser + upsert + generateLink，设置 pending cookie，重定向到 session 页', async () => {
      mockWechatSuccess('new_openid_xyz')
      mockSingle.mockResolvedValueOnce({ data: null, error: null })

      const req = makeRequest({ code: 'valid_code', state: 'valid_state_123' })
      const res = await GET(req)

      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'wechat_new_openid_xyz@wechat.internal',
        email_confirm: true,
      })
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'new-user-uuid',
          wechat_openid: 'new_openid_xyz',
          display_name: '微信用户',
        }),
        { onConflict: 'id' }
      )
      expect(mockGenerateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email: 'wechat_new_openid_xyz@wechat.internal',
      })
      // P0: token stored in cookie, not URL
      expect(mockCookiesSet).toHaveBeenCalledWith(
        'wechat_pending_otp',
        expect.stringContaining('mock_hashed_token'),
        expect.objectContaining({ httpOnly: true })
      )
      const location = res.headers.get('location') ?? ''
      expect(location).toBe('http://localhost:3000/auth/wechat-session')
      expect(location).not.toContain('token=')
    })

    it('createUser 失败时重定向到错误页', async () => {
      mockWechatSuccess()
      mockCreateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'create failed' },
      })

      const req = makeRequest({ code: 'valid_code', state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })

    it('upsert 失败时调用 deleteUser 清除孤儿，重定向到错误页', async () => {
      mockWechatSuccess()
      mockUpsert.mockResolvedValueOnce({ error: { message: 'upsert failed' } })

      const req = makeRequest({ code: 'valid_code', state: 'valid_state_123' })
      const res = await GET(req)
      // P4: orphaned auth user must be cleaned up
      expect(mockDeleteUser).toHaveBeenCalledWith('new-user-uuid')
      expect(res.headers.get('location')).toContain('wechat_failed')
    })
  })

  describe('已有用户流程', () => {
    it('已有用户：跳过 createUser，直接 generateLink，重定向到 session 页', async () => {
      mockWechatSuccess('existing_openid')
      mockSingle.mockResolvedValueOnce({ data: { id: 'existing-uuid' }, error: null })

      const req = makeRequest({ code: 'valid_code', state: 'valid_state_123' })
      const res = await GET(req)

      expect(mockCreateUser).not.toHaveBeenCalled()
      expect(mockGenerateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email: 'wechat_existing_openid@wechat.internal',
      })
      const location = res.headers.get('location') ?? ''
      expect(location).toBe('http://localhost:3000/auth/wechat-session')
    })
  })

  describe('generateLink 失败', () => {
    it('generateLink 失败时重定向到错误页', async () => {
      mockWechatSuccess()
      mockSingle.mockResolvedValueOnce({ data: { id: 'some-uuid' }, error: null })
      mockGenerateLink.mockResolvedValueOnce({
        data: null,
        error: { message: 'link failed' },
      })

      const req = makeRequest({ code: 'valid_code', state: 'valid_state_123' })
      const res = await GET(req)
      expect(res.headers.get('location')).toContain('wechat_failed')
    })
  })
})
