/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    rewriteRecord: {
      findFirst: jest.fn(),
    },
  },
}))

import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const mockCreateClient = jest.mocked(createClient)
const mockFindFirst = prisma.rewriteRecord.findFirst as jest.Mock

function makeRequest(id = 'rec-123') {
  return new Request(`http://localhost/api/rewrite/history/${id}`)
}

function makeParams(id = 'rec-123') {
  return { params: Promise.resolve({ id }) }
}

function mockAuth(user: { id: string } | null, authError: unknown = null) {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user },
    error: authError,
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
}

const fakeRecord = {
  id: 'rec-123',
  userId: 'user-1',
  originalText: '这是完整的原文内容',
  originalUrl: null,
  contentType: 'opinion',
  createdAt: new Date('2026-03-27T10:00:00Z'),
  metadata: {},
  results: [
    {
      id: 'res-1',
      recordId: 'rec-123',
      platform: 'xiaohongshu',
      tone: 'standard',
      body: '改写后的内容',
      titles: ['标题1', '标题2', '标题3'],
      tags: ['标签1', '标签2'],
      hook: '互动引导语',
      apiModel: 'deepseek',
      apiTokensUsed: 500,
      apiCostCents: 3,
      apiDurationMs: 8000,
      createdAt: new Date('2026-03-27T10:00:01Z'),
      feedback: null,
    },
  ],
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /api/rewrite/history/[id]', () => {
  it('未登录返回 401', async () => {
    mockAuth(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.data).toBeNull()
  })

  it('认证服务异常返回 503', async () => {
    mockAuth(null, { message: 'error' })
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('记录不存在返回 404', async () => {
    mockAuth({ id: 'user-1' })
    mockFindFirst.mockResolvedValue(null)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('IDOR 防护：不属于当前用户的记录返回 404', async () => {
    mockAuth({ id: 'user-evil' })
    // findFirst returns null because userId doesn't match
    mockFindFirst.mockResolvedValue(null)
    const res = await GET(makeRequest(), makeParams('rec-123'))
    expect(res.status).toBe(404)
    // 必须同时传了 userId 条件
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'rec-123', userId: 'user-evil' }),
      })
    )
  })

  it('记录存在返回 200 和完整数据', async () => {
    mockAuth({ id: 'user-1' })
    mockFindFirst.mockResolvedValue(fakeRecord)
    const res = await GET(makeRequest(), makeParams())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data.record.id).toBe('rec-123')
    expect(body.data.results).toHaveLength(1)
    expect(body.data.results[0].platform).toBe('xiaohongshu')
  })

  it('createdAt 以 ISO 字符串返回', async () => {
    mockAuth({ id: 'user-1' })
    mockFindFirst.mockResolvedValue(fakeRecord)
    const res = await GET(makeRequest(), makeParams())
    const body = await res.json()
    expect(body.data.record.createdAt).toBe('2026-03-27T10:00:00.000Z')
    expect(body.data.results[0].createdAt).toBe('2026-03-27T10:00:01.000Z')
  })
})
