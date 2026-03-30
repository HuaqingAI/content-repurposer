/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    rewriteResult: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const mockCreateClient = jest.mocked(createClient)
const mockFindFirst = jest.mocked(prisma.rewriteResult.findFirst)
const mockUpdate = jest.mocked(prisma.rewriteResult.update)

const VALID_RESULT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const USER_ID = 'user-uuid-1234-5678-abcd-ef0123456789'

function makeRequest(resultId: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/rewrite/${resultId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeParams(resultId: string) {
  return { params: Promise.resolve({ resultId }) }
}

function mockAuth(user: { id: string } | null = { id: USER_ID }) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  } as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)
}

function mockAuthError() {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('auth error'),
      }),
    },
  } as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFindFirst.mockResolvedValue({ id: VALID_RESULT_ID } as Awaited<ReturnType<typeof prisma.rewriteResult.findFirst>>)
  mockUpdate.mockResolvedValue({} as Awaited<ReturnType<typeof prisma.rewriteResult.update>>)
})

// ─── 认证检查 ────────────────────────────────────────────────────────────────

describe('POST /api/rewrite/[resultId]/feedback — 认证', () => {
  it('auth 服务异常时返回 503', async () => {
    mockAuthError()
    const res = await POST(makeRequest(VALID_RESULT_ID, { feedback: 'helpful' }), makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.error.code).toBe('SERVICE_ERROR')
  })

  it('未登录时返回 401', async () => {
    mockAuth(null)
    const res = await POST(makeRequest(VALID_RESULT_ID, { feedback: 'helpful' }), makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

// ─── 路径参数校验 ─────────────────────────────────────────────────────────────

describe('POST /api/rewrite/[resultId]/feedback — resultId 校验', () => {
  it('无效 UUID 返回 400', async () => {
    mockAuth()
    const res = await POST(makeRequest('invalid-id', { feedback: 'helpful' }), makeParams('invalid-id'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

// ─── body 校验 ────────────────────────────────────────────────────────────────

describe('POST /api/rewrite/[resultId]/feedback — body 校验', () => {
  it('feedback 字段缺失返回 400', async () => {
    mockAuth()
    const req = new Request(`http://localhost/api/rewrite/${VALID_RESULT_ID}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const res = await POST(req, makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('feedback 值无效返回 400', async () => {
    mockAuth()
    const res = await POST(makeRequest(VALID_RESULT_ID, { feedback: 'bad_value' }), makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('请求体格式错误（非 JSON）返回 400', async () => {
    mockAuth()
    const req = new Request(`http://localhost/api/rewrite/${VALID_RESULT_ID}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req, makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(400)
  })
})

// ─── 权限检查 ─────────────────────────────────────────────────────────────────

describe('POST /api/rewrite/[resultId]/feedback — 权限', () => {
  it('结果不属于当前用户时返回 404', async () => {
    mockAuth()
    mockFindFirst.mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_RESULT_ID, { feedback: 'helpful' }), makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})

// ─── 正常写入 ─────────────────────────────────────────────────────────────────

describe('POST /api/rewrite/[resultId]/feedback — 正常写入', () => {
  it('写入 helpful 反馈成功，返回 200 及 resultId (AC1)', async () => {
    mockAuth()
    const res = await POST(makeRequest(VALID_RESULT_ID, { feedback: 'helpful' }), makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.resultId).toBe(VALID_RESULT_ID)
    expect(json.data.feedback).toBe('helpful')
    expect(json.error).toBeNull()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_RESULT_ID },
        data: expect.objectContaining({ feedback: 'helpful', feedbackComment: null }),
      })
    )
  })

  it('写入 not_helpful 含 comment 成功 (AC2)', async () => {
    mockAuth()
    const res = await POST(
      makeRequest(VALID_RESULT_ID, { feedback: 'not_helpful', comment: '内容不准确' }),
      makeParams(VALID_RESULT_ID)
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.feedback).toBe('not_helpful')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feedback: 'not_helpful', feedbackComment: '内容不准确' }),
      })
    )
  })

  it('写入 not_helpful 不含 comment 时 feedbackComment 为 null (AC2)', async () => {
    mockAuth()
    const res = await POST(
      makeRequest(VALID_RESULT_ID, { feedback: 'not_helpful' }),
      makeParams(VALID_RESULT_ID)
    )
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feedbackComment: null }),
      })
    )
  })

  it('DB update 失败时返回 503', async () => {
    mockAuth()
    mockUpdate.mockRejectedValue(new Error('db error'))
    const res = await POST(makeRequest(VALID_RESULT_ID, { feedback: 'helpful' }), makeParams(VALID_RESULT_ID))
    expect(res.status).toBe(503)
  })
})
