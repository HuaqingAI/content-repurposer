/**
 * @jest-environment node
 */
// Mock must be defined before imports
const mockGetUser = jest.fn()
const mockUpsert = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

jest.mock('@/lib/supabase/server-admin', () => ({
  createServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: mockUpsert,
    })),
  })),
}))

import { POST } from '../route'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/auth/sync-user', () => {
  it('未登录用户返回 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'not authenticated' } })
    const response = await POST()
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('已登录用户 upsert 成功返回 userId', async () => {
    const mockUser = { id: 'test-uuid-123', phone: '+8613800000001' }
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockUpsert.mockResolvedValue({ error: null })

    const response = await POST()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.userId).toBe('test-uuid-123')
    expect(body.error).toBeNull()
  })

  it('upsert 调用携带正确的用户字段', async () => {
    const mockUser = { id: 'test-uuid-123', phone: '+8613800000001' }
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockUpsert.mockResolvedValue({ error: null })

    await POST()

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-uuid-123',
        phone: '+8613800000001',
        display_name: expect.stringContaining('0001'),
      }),
      { onConflict: 'id' }
    )
  })

  it('重复调用幂等（第二次也成功）', async () => {
    const mockUser = { id: 'test-uuid-123', phone: '+8613800000001' }
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockUpsert.mockResolvedValue({ error: null })

    const res1 = await POST()
    const res2 = await POST()

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
  })

  it('phone 为空时 display_name 使用默认值"新用户"', async () => {
    const mockUser = { id: 'test-uuid-no-phone', phone: undefined }
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
    mockUpsert.mockResolvedValue({ error: null })

    await POST()

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: '新用户',
        phone: null,
      }),
      { onConflict: 'id' }
    )
  })
})
