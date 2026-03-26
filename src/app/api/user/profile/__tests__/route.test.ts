/**
 * @jest-environment node
 */
const mockGetUser = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
  },
}))

import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'

const mockPrismaUpdate = prisma.user.update as jest.Mock

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PATCH /api/user/profile', () => {
  it('未登录用户返回 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'not authenticated' } })
    const req = makeRequest({ displayName: '测试名称' })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.data).toBeNull()
  })

  it('displayName 为空字符串返回 400', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const req = makeRequest({ displayName: '' })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_PARAMS')
  })

  it('displayName 超过 50 字符返回 400', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const req = makeRequest({ displayName: 'a'.repeat(51) })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_PARAMS')
  })

  it('请求体缺少 displayName 字段返回 400', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const req = makeRequest({})
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('INVALID_PARAMS')
  })

  it('更新成功返回 200 和 userId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockPrismaUpdate.mockResolvedValue({ id: 'user-123', displayName: '新名称' })
    const req = makeRequest({ displayName: '新名称' })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.userId).toBe('user-123')
    expect(body.error).toBeNull()
  })

  it('更新时调用 prisma.user.update 带正确参数', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockPrismaUpdate.mockResolvedValue({ id: 'user-123', displayName: '新名称' })
    const req = makeRequest({ displayName: '新名称' })
    await PATCH(req)
    expect(mockPrismaUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { displayName: '新名称' },
    })
  })

  it('Prisma 抛出异常返回 500', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    mockPrismaUpdate.mockRejectedValue(new Error('DB connection failed'))
    const req = makeRequest({ displayName: '新名称' })
    const res = await PATCH(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('UPDATE_FAILED')
    expect(body.data).toBeNull()
  })
})
