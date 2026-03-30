/**
 * @jest-environment node
 */

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
}))

jest.mock('@/lib/url-extractor/extractor', () => ({
  extractUrl: jest.fn(),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractUrl } from '@/lib/url-extractor/extractor'

const mockCreateClient = jest.mocked(createClient)
const mockCheckRateLimit = jest.mocked(checkRateLimit)
const mockExtractUrl = jest.mocked(extractUrl)

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/extract-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockAuth(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  // 默认通过限流
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 })
})

describe('POST /api/extract-url - 认证', () => {
  it('未登录返回 401', async () => {
    mockAuth(null)
    const res = await POST(makeRequest({ url: 'https://mp.weixin.qq.com/s/abc' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /api/extract-url - 限流', () => {
  it('超出限流返回 429', async () => {
    mockAuth({ id: 'user-1' })
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 })
    const res = await POST(makeRequest({ url: 'https://mp.weixin.qq.com/s/abc' }))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error.code).toBe('RATE_LIMIT')
  })
})

describe('POST /api/extract-url - 参数校验', () => {
  it('缺少 url 字段返回 400 VALIDATION_ERROR', async () => {
    mockAuth({ id: 'user-1' })
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('url 为空字符串返回 400 VALIDATION_ERROR', async () => {
    mockAuth({ id: 'user-1' })
    const res = await POST(makeRequest({ url: '   ' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('url 格式非法（非 URL）返回 400 VALIDATION_ERROR', async () => {
    mockAuth({ id: 'user-1' })
    const res = await POST(makeRequest({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('请求体非 JSON 返回 400 VALIDATION_ERROR', async () => {
    mockAuth({ id: 'user-1' })
    const req = new Request('http://localhost/api/extract-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/extract-url - 成功提取', () => {
  it('extractUrl 返回 success:true → 200 含 text', async () => {
    mockAuth({ id: 'user-1' })
    mockExtractUrl.mockResolvedValue({ success: true, text: '提取到的文章正文内容' })
    const res = await POST(makeRequest({ url: 'https://mp.weixin.qq.com/s/abc' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.error).toBeNull()
    expect(json.data.success).toBe(true)
    expect(json.data.text).toBe('提取到的文章正文内容')
  })
})

describe('POST /api/extract-url - 业务失败', () => {
  it('extractUrl 返回 success:false → 200 业务失败响应', async () => {
    mockAuth({ id: 'user-1' })
    mockExtractUrl.mockResolvedValue({ success: false, error: '不支持该链接来源，请手动粘贴内容' })
    const res = await POST(makeRequest({ url: 'https://www.bilibili.com/video/abc' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.error).toBeNull()
    expect(json.data.success).toBe(false)
    expect(typeof json.data.error).toBe('string')
  })
})
