/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    rewriteRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const mockCreateClient = jest.mocked(createClient)
const mockFindMany = prisma.rewriteRecord.findMany as jest.Mock
const mockCount = prisma.rewriteRecord.count as jest.Mock

function makeRequest(query = '') {
  return new Request(`http://localhost/api/rewrite/history${query}`)
}

function mockAuth(user: { id: string } | null, authError: unknown = null) {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user },
    error: authError,
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/rewrite/history', () => {
  it('未登录返回 401', async () => {
    mockAuth(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.data).toBeNull()
  })

  it('认证服务异常返回 503', async () => {
    mockAuth(null, { message: 'connection error' })
    const res = await GET(makeRequest())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('已登录且有记录，返回分页数据', async () => {
    mockAuth({ id: 'user-1' })
    const fakeRecords = [
      {
        id: 'rec-1',
        originalText: '这是一段测试原文内容，超过一百字的测试内容' + '测'.repeat(100),
        contentType: 'opinion',
        createdAt: new Date('2026-03-27T10:00:00Z'),
        results: [{ id: 'res-1', platform: 'xiaohongshu' }],
      },
    ]
    mockFindMany.mockResolvedValue(fakeRecords)
    mockCount.mockResolvedValue(1)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data.records).toHaveLength(1)
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  it('originalText 超过 100 字时截断为 100 字', async () => {
    mockAuth({ id: 'user-1' })
    const longText = '测'.repeat(200)
    mockFindMany.mockResolvedValue([
      {
        id: 'rec-1',
        originalText: longText,
        contentType: 'opinion',
        createdAt: new Date(),
        results: [],
      },
    ])
    mockCount.mockResolvedValue(1)

    const res = await GET(makeRequest())
    const body = await res.json()
    const preview = body.data.records[0].originalText
    expect([...preview].length).toBe(100)
  })

  it('originalText 不足 100 字时原样返回', async () => {
    mockAuth({ id: 'user-1' })
    const shortText = '测'.repeat(50)
    mockFindMany.mockResolvedValue([
      {
        id: 'rec-1',
        originalText: shortText,
        contentType: 'opinion',
        createdAt: new Date(),
        results: [],
      },
    ])
    mockCount.mockResolvedValue(1)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.records[0].originalText).toBe(shortText)
  })

  it('分页参数 page=2 时传递正确的 skip', async () => {
    mockAuth({ id: 'user-1' })
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(25)

    await GET(makeRequest('?page=2'))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 })
    )
  })

  it('无历史记录时返回空数组和 total=0', async () => {
    mockAuth({ id: 'user-1' })
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.records).toEqual([])
    expect(body.data.total).toBe(0)
  })

  it('查询时使用当前用户的 userId（数据隔离）', async () => {
    mockAuth({ id: 'user-abc' })
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await GET(makeRequest())
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-abc' } })
    )
    expect(mockCount).toHaveBeenCalledWith({ where: { userId: 'user-abc' } })
  })

  it('createdAt 以 ISO 字符串返回', async () => {
    mockAuth({ id: 'user-1' })
    const date = new Date('2026-03-27T10:00:00Z')
    mockFindMany.mockResolvedValue([
      { id: 'rec-1', originalText: '测'.repeat(50), contentType: 'opinion', createdAt: date, results: [] },
    ])
    mockCount.mockResolvedValue(1)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data.records[0].createdAt).toBe(date.toISOString())
  })
})
