/**
 * @jest-environment node
 */

// jest.mock 调用会被 babel-jest 提升到文件顶部执行，
// 因此不能在 mock factory 中引用文件顶层的 const 变量（TDZ 问题）。
// 正确做法：在 mock factory 中使用 jest.fn()，再通过 jest.mocked() 获取类型化引用。

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  checkIpRateLimit: jest.fn(),
}))

jest.mock('@/lib/llm/llm-router', () => ({
  llmRouter: {
    streamChat: jest.fn(),
  },
}))

jest.mock('@/lib/llm/prompt-assembler', () => ({
  assemblePrompt: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    rewriteRecord: {
      create: jest.fn(),
    },
    rewriteResult: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/llm/cost-tracker', () => ({
  createPlatformCostRecord: jest.fn().mockReturnValue({
    platform: 'xiaohongshu',
    model: 'deepseek-chat',
    tokensUsed: 100,
    costCents: 1,
    durationMs: 50,
  }),
  calculateCostCents: jest.fn().mockReturnValue(1),
}))

jest.mock('@/lib/llm/content-type-parser', () => ({
  parseContentType: jest.fn().mockReturnValue('opinion'),
}))

import { POST } from '../route'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, checkIpRateLimit } from '@/lib/rate-limit'
import { llmRouter } from '@/lib/llm/llm-router'
import { assemblePrompt } from '@/lib/llm/prompt-assembler'
import { prisma } from '@/lib/prisma'

const mockCreateClient = jest.mocked(createClient)
const mockCheckRateLimit = jest.mocked(checkRateLimit)
const mockCheckIpRateLimit = jest.mocked(checkIpRateLimit)
const mockStreamChat = jest.mocked(llmRouter.streamChat)
const mockAssemblePrompt = jest.mocked(assemblePrompt)
const mockRewriteRecordCreate = jest.mocked(prisma.rewriteRecord.create)
const mockRewriteResultCreate = jest.mocked(prisma.rewriteResult.create)

// 长度 >= 50 字符，用于通过字数校验
const VALID_TEXT = '这是测试文章内容。'.repeat(6)

// ─── 请求构造辅助 ───────────────────────────────────────────────────────────

/** 短 text（< 50 字）请求，用于认证 / 限流相关测试 */
function makeRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '测试',
      platforms: ['xiaohongshu'],
      tone: 'standard',
      ...overrides,
    }),
  })
}

/** 完全合法的请求，用于需要通过全部校验的测试 */
function makeValidRequest(overrides: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: VALID_TEXT,
      platforms: ['xiaohongshu'],
      tone: 'standard',
      ...overrides,
    }),
  })
}

// ─── SSE 事件消费辅助 ────────────────────────────────────────────────────────

async function collectSSEEvents(response: Response): Promise<Array<{ event: string; data: unknown }>> {
  const text = await response.text()
  const events: Array<{ event: string; data: unknown }> = []
  const blocks = text.split('\n\n').filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    let event = 'message'
    let dataStr = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7)
      else if (line.startsWith('data: ')) dataStr = line.slice(6)
    }
    if (dataStr) {
      try {
        events.push({ event, data: JSON.parse(dataStr) })
      } catch {
        events.push({ event, data: dataStr })
      }
    }
  }
  return events
}

// ─── Mock 状态设置辅助 ───────────────────────────────────────────────────────

function setupLoggedInUser(userId = 'user-1') {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
}

function setupGuestUser() {
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user: null },
    error: null,
  })
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)
}

function setupLlmSuccess() {
  mockAssemblePrompt.mockResolvedValue([{ role: 'user', content: 'test' }] as never)
  mockStreamChat.mockImplementation(({ onChunk, onComplete }: Parameters<typeof llmRouter.streamChat>[0]) => {
    onChunk(
      '[CONTENT_TYPE]: 观点分析\n[BODY]:\n这是正文内容\n[TITLE_1]: 标题1\n[TITLE_2]: 标题2\n[TITLE_3]: 标题3\n[TAGS]: 标签1\n[HOOK]: 引导语'
    )
    onComplete({ totalTokens: 100, promptTokens: 50, completionTokens: 50 })
  })
}

// ─── 测试 ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  // 默认 Prisma mock：写入成功，返回真实 UUID 格式的 id
  mockRewriteRecordCreate.mockResolvedValue({ id: 'test-record-uuid-1234' } as never)
  mockRewriteResultCreate.mockResolvedValue({} as never)
})

describe('POST /api/rewrite', () => {
  // ── 认证与限流 ────────────────────────────────────────────────────────────

  it('认证服务异常返回 503', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'connection error' },
    })
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } } as never)

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVICE_ERROR')
  })

  it('已登录 + 超限返回 429，含正确 error body', async () => {
    setupLoggedInUser()
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })

    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(body.data).toBeNull()
  })

  it('超限时响应包含 Retry-After header', async () => {
    setupLoggedInUser()
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })

    const res = await POST(makeRequest())
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('限流通过时以 user.id 调用 checkRateLimit', async () => {
    setupLoggedInUser('user-abc')
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 3, resetAt: Date.now() + 60000 })
    // assemblePrompt 抛错，避免进入完整 LLM 流程
    mockAssemblePrompt.mockRejectedValue(new Error('平台配置不存在'))

    await POST(makeValidRequest())
    expect(mockCheckRateLimit).toHaveBeenCalledWith('user-abc')
  })

  // ── 请求体校验 ───────────────────────────────────────────────────────────

  describe('请求体校验', () => {
    beforeEach(() => {
      setupLoggedInUser()
      mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })
    })

    it('缺少 text 字段返回 400', async () => {
      // 显式构造不含 text 键的请求体，避免依赖 JSON.stringify 对 undefined 的隐式忽略行为
      const res = await POST(new Request('http://localhost/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: ['xiaohongshu'], tone: 'standard' }),
      }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('text 少于 50 字返回 400', async () => {
      const res = await POST(makeRequest({ text: '短文本' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('platforms 为空数组返回 400', async () => {
      const res = await POST(makeValidRequest({ platforms: [] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('platforms 含非法值返回 400', async () => {
      const res = await POST(makeValidRequest({ platforms: ['invalid_platform'] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('tone 非法返回 400', async () => {
      const res = await POST(makeValidRequest({ tone: 'ultra_formal' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── 正常 SSE 流程 ─────────────────────────────────────────────────────────

  describe('正常 SSE 流程', () => {
    beforeEach(() => {
      setupLoggedInUser()
      mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })
      setupLlmSuccess()
    })

    it('已登录 + 限流通过返回 200 + text/event-stream', async () => {
      const res = await POST(makeValidRequest())
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('单平台正常流程 SSE 事件序列包含 platform_start / chunk / titles / tags / hook / platform_complete / done', async () => {
      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const eventNames = events.map((e) => e.event)

      expect(eventNames).toContain('platform_start')
      expect(eventNames).toContain('chunk')
      expect(eventNames).toContain('titles')
      expect(eventNames).toContain('tags')
      expect(eventNames).toContain('hook')
      expect(eventNames).toContain('platform_complete')
      expect(eventNames).toContain('done')
    })

    it('titles 事件包含 3 个标题', async () => {
      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const titlesEvent = events.find((e) => e.event === 'titles')
      expect(titlesEvent).toBeDefined()
      expect((titlesEvent!.data as { titles: string[] }).titles).toHaveLength(3)
    })

    it('done 事件（已登录）包含 record_id 字段', async () => {
      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const doneEvent = events.find((e) => e.event === 'done')
      expect(doneEvent).toBeDefined()
      expect(doneEvent!.data).toHaveProperty('record_id')
    })
  })

  // ── LLM 错误处理 ──────────────────────────────────────────────────────────

  describe('LLM 错误处理', () => {
    beforeEach(() => {
      setupLoggedInUser()
      mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })
      mockAssemblePrompt.mockResolvedValue([{ role: 'user', content: 'test' }] as never)
    })

    it('LLM onError 触发时 SSE 发送 error 事件 retryable:true', async () => {
      mockStreamChat.mockImplementation(({ onError }: Parameters<typeof llmRouter.streamChat>[0]) => {
        onError({ code: 'NETWORK_ERROR', message: '网络超时' })
      })

      const res = await POST(makeValidRequest())
      expect(res.status).toBe(200)
      const events = await collectSSEEvents(res)
      const errorEvent = events.find((e) => e.event === 'error')
      expect(errorEvent).toBeDefined()
      expect((errorEvent!.data as { retryable: boolean }).retryable).toBe(true)
    })
  })

  // ── UNSUPPORTED_CONTENT 处理 ──────────────────────────────────────────────

  describe('UNSUPPORTED_CONTENT 处理', () => {
    beforeEach(() => {
      setupLoggedInUser()
      mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })
      mockAssemblePrompt.mockResolvedValue([{ role: 'user', content: 'test' }] as never)
    })

    it('LLM 输出含 [UNSUPPORTED_CONTENT] 时 SSE 发送 error 事件 retryable:false（AC#3）', async () => {
      mockStreamChat.mockImplementation(({ onChunk, onError }: Parameters<typeof llmRouter.streamChat>[0]) => {
        onChunk('[CONTENT_TYPE]: 其他\n[UNSUPPORTED_CONTENT]\n此内容无法改写')
        onError({ code: 'CANCELLED', message: 'aborted' })
      })

      const res = await POST(makeValidRequest())
      expect(res.status).toBe(200)
      const events = await collectSSEEvents(res)
      const errorEvent = events.find((e) => e.event === 'error')
      expect(errorEvent).toBeDefined()
      expect((errorEvent!.data as { retryable: boolean; message: string }).retryable).toBe(false)
      expect((errorEvent!.data as { message: string }).message).toBe('该内容暂不支持改写，请尝试其他类型的文章')
    })

    it('UNSUPPORTED_CONTENT 后 LLM onError 非 CANCELLED 不发额外 error 事件（AC#3 + Finding#7）', async () => {
      mockStreamChat.mockImplementation(({ onChunk, onError }: Parameters<typeof llmRouter.streamChat>[0]) => {
        onChunk('[CONTENT_TYPE]: 其他\n[UNSUPPORTED_CONTENT]')
        // abort 后 provider 返回非 CANCELLED 错误码（边界情况）
        onError({ code: 'NETWORK_ERROR', message: '网络中断' })
      })

      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const errorEvents = events.filter((e) => e.event === 'error')
      // 只应有一个 error 事件（UNSUPPORTED 的，retryable:false），不应叠加 NETWORK_ERROR 事件
      expect(errorEvents).toHaveLength(1)
      expect((errorEvents[0].data as { retryable: boolean }).retryable).toBe(false)
    })
  })

  // ── 试用模式 ──────────────────────────────────────────────────────────────

  describe('试用模式', () => {
    beforeEach(() => {
      setupGuestUser()
    })

    it('IP 限流通过时返回 200 + text/event-stream', async () => {
      mockCheckIpRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 3600000 })
      setupLlmSuccess()

      const res = await POST(makeValidRequest())
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    })

    it('done 事件包含 trial:true', async () => {
      mockCheckIpRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 3600000 })
      setupLlmSuccess()

      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const doneEvent = events.find((e) => e.event === 'done')
      expect(doneEvent).toBeDefined()
      expect((doneEvent!.data as { trial: boolean }).trial).toBe(true)
    })

    it('IP 超限时返回 429', async () => {
      mockCheckIpRateLimit.mockReturnValue({ allowed: false, resetAt: Date.now() + 3600000 })

      // IP 限流在 body 校验之后执行，需使用合法请求；
      // 必须携带 x-forwarded-for 以触发 IP 识别（空 IP 时跳过限流）
      const res = await POST(new Request('http://localhost/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify({ text: VALID_TEXT, platforms: ['xiaohongshu'], tone: 'standard' }),
      }))
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    })

    it('试用模式选择多平台返回 400', async () => {
      mockCheckIpRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 3600000 })

      const res = await POST(makeValidRequest({ platforms: ['xiaohongshu', 'wechat'] }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ── 落库逻辑（Story 3.4b）────────────────────────────────────────────────

  describe('落库逻辑', () => {
    beforeEach(() => {
      setupLoggedInUser()
      mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })
      setupLlmSuccess()
    })

    it('已登录用户改写完成后 done 事件包含非 null 的 record_id', async () => {
      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const doneEvent = events.find((e) => e.event === 'done')
      expect(doneEvent).toBeDefined()
      expect((doneEvent!.data as { record_id: string | null }).record_id).toBe('test-record-uuid-1234')
    })

    it('已登录用户改写完成后调用 Prisma rewriteRecord.create', async () => {
      // 必须消费 SSE 流（collectSSEEvents），否则 ReadableStream 的 start 回调
      // 是异步的，DB 写入在流读完前不会执行
      const res = await POST(makeValidRequest())
      await collectSSEEvents(res)
      expect(mockRewriteRecordCreate).toHaveBeenCalledTimes(1)
      expect(mockRewriteRecordCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            originalText: VALID_TEXT,
          }),
        })
      )
    })

    it('试用模式改写完成后 done 事件 record_id 为 null，Prisma 未调用', async () => {
      setupGuestUser()
      mockCheckIpRateLimit.mockReturnValue({ allowed: true, resetAt: Date.now() + 3600000 })

      const res = await POST(makeValidRequest())
      const events = await collectSSEEvents(res)
      const doneEvent = events.find((e) => e.event === 'done')
      expect(doneEvent).toBeDefined()
      expect((doneEvent!.data as { trial: boolean; record_id: null }).trial).toBe(true)
      expect((doneEvent!.data as { record_id: null }).record_id).toBeNull()
      expect(mockRewriteRecordCreate).not.toHaveBeenCalled()
    })

    it('Prisma 写入失败时 done 事件降级为 record_id: null，SSE 流正常完成不发送 error 事件', async () => {
      mockRewriteRecordCreate.mockRejectedValue(new Error('DB connection failed'))

      const res = await POST(makeValidRequest())
      expect(res.status).toBe(200)
      const events = await collectSSEEvents(res)

      const doneEvent = events.find((e) => e.event === 'done')
      expect(doneEvent).toBeDefined()
      expect((doneEvent!.data as { record_id: null }).record_id).toBeNull()

      // SSE 流不应因 DB 失败而发送 error 事件
      const dbErrorEvent = events.find(
        (e) => e.event === 'error' && (e.data as { retryable?: boolean }).retryable === undefined
      )
      expect(dbErrorEvent).toBeUndefined()
    })
  })
})
