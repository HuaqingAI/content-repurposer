/**
 * @jest-environment node
 */
import { QwenProvider } from '@/lib/llm/providers/qwen'
import { QWEN_MODELS } from '@/lib/llm/providers/qwen'
import type { TokenUsage, LLMError } from '@/lib/llm/types'

jest.mock('@/lib/env', () => ({ env: { QWEN_API_KEY: 'test-key' } }))

// 辅助函数：将 SSE 文本行组合成 ReadableStream
function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const text = lines.join('\n') + '\n'
  const encoder = new TextEncoder()
  const encoded = encoder.encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
}

function makeMockResponse(status: number, body: ReadableStream<Uint8Array> | null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    json: async () => ({}),
  } as unknown as Response
}

describe('QwenProvider.streamChat', () => {
  let provider: QwenProvider
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    provider = new QwenProvider()
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    jest.useRealTimers()
    fetchSpy.mockRestore()
  })

  it('正常流式响应：onChunk 收到多个文本片段，onComplete 收到正确 token 用量', async () => {
    const sseLines = [
      'data: {"id":"1","choices":[{"delta":{"content":"你好"},"finish_reason":null}],"usage":null}',
      'data: {"id":"2","choices":[{"delta":{"content":"世界"},"finish_reason":null}],"usage":null}',
      'data: {"id":"3","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
      'data: [DONE]',
    ]
    const stream = makeSSEStream(sseLines)
    fetchSpy.mockResolvedValueOnce(makeMockResponse(200, stream))

    const chunks: string[] = []
    let receivedUsage: TokenUsage | null = null
    let receivedError: LLMError | null = null

    await provider.streamChat({
      model: QWEN_MODELS.CHAT,
      messages: [{ role: 'user', content: 'Hi' }],
      onChunk: (text) => chunks.push(text),
      onComplete: (usage) => { receivedUsage = usage },
      onError: (err) => { receivedError = err },
    })

    expect(receivedError).toBeNull()
    expect(chunks).toEqual(['你好', '世界'])
    expect(receivedUsage).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    })
  })

  it('30 秒超时触发 onError({ code: TIMEOUT })', async () => {
    jest.useFakeTimers()

    fetchSpy.mockImplementationOnce(
      (_url: string, options?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        }),
    )

    let receivedError: LLMError | null = null

    const streamPromise = provider.streamChat({
      model: QWEN_MODELS.CHAT,
      messages: [{ role: 'user', content: 'Hi' }],
      onChunk: () => {},
      onComplete: () => {},
      onError: (err) => { receivedError = err },
    })

    jest.advanceTimersByTime(30001)
    await Promise.resolve()
    await Promise.resolve()

    expect(receivedError).not.toBeNull()
    expect(receivedError?.code).toBe('TIMEOUT')

    jest.useRealTimers()
    await streamPromise
  })

  it('API 返回 401 时触发 onError({ code: API_ERROR, statusCode: 401 })', async () => {
    fetchSpy.mockResolvedValueOnce({
      ...makeMockResponse(401, null),
      json: async () => ({ error: { message: '无效的 API Key' } }),
    } as unknown as Response)

    let receivedError: LLMError | null = null

    await provider.streamChat({
      model: QWEN_MODELS.CHAT,
      messages: [{ role: 'user', content: 'Hi' }],
      onChunk: () => {},
      onComplete: () => {},
      onError: (err) => { receivedError = err },
    })

    expect(receivedError).not.toBeNull()
    expect(receivedError?.code).toBe('API_ERROR')
    expect(receivedError?.statusCode).toBe(401)
    expect(receivedError?.message).toContain('无效的 API Key')
  })

  it('fetch 网络异常触发 onError({ code: NETWORK_ERROR })', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network failure'))

    let receivedError: LLMError | null = null

    await provider.streamChat({
      model: QWEN_MODELS.CHAT,
      messages: [{ role: 'user', content: 'Hi' }],
      onChunk: () => {},
      onComplete: () => {},
      onError: (err) => { receivedError = err },
    })

    expect(receivedError).not.toBeNull()
    expect(receivedError?.code).toBe('NETWORK_ERROR')
  })

  it('流截断（无 [DONE]）触发 onError({ code: NETWORK_ERROR })', async () => {
    const sseLines = [
      'data: {"id":"1","choices":[{"delta":{"content":"你好"},"finish_reason":null}],"usage":null}',
      // 流在此处意外关闭，没有 [DONE]
    ]
    const stream = makeSSEStream(sseLines)
    fetchSpy.mockResolvedValueOnce(makeMockResponse(200, stream))

    const chunks: string[] = []
    let receivedError: LLMError | null = null
    let receivedComplete = false

    await provider.streamChat({
      model: QWEN_MODELS.CHAT,
      messages: [{ role: 'user', content: 'Hi' }],
      onChunk: (text) => chunks.push(text),
      onComplete: () => { receivedComplete = true },
      onError: (err) => { receivedError = err },
    })

    expect(chunks).toEqual(['你好'])
    expect(receivedComplete).toBe(false)
    expect(receivedError).not.toBeNull()
    expect(receivedError?.code).toBe('NETWORK_ERROR')
  })
})
