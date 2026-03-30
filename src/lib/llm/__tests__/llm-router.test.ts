/**
 * @jest-environment node
 */
import { LLMRouter } from '@/lib/llm/llm-router'
import type { LLMProvider, StreamChatParams, TokenUsage, LLMError } from '@/lib/llm/types'

jest.mock('@/lib/env', () => ({
  env: { DEEPSEEK_API_KEY: 'test-key', QWEN_API_KEY: 'test-key' },
}))

// 辅助函数：创建 mock provider，可以配置 streamChat 行为
function makeMockProvider(
  behavior: (params: StreamChatParams) => void,
): LLMProvider {
  return {
    streamChat: jest.fn().mockImplementation(async (params: StreamChatParams) => {
      behavior(params)
    }),
  }
}

const defaultParams: Omit<StreamChatParams, 'onChunk' | 'onComplete' | 'onError'> = {
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: 'Hi' }],
}

describe('LLMRouter.streamChat', () => {
  it('primary 成功：onChunk + onComplete 正常触发，fallback 未被调用', async () => {
    const usage: TokenUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 }

    const primary = makeMockProvider((params) => {
      params.onChunk('Hello')
      params.onChunk(' world')
      params.onComplete(usage)
    })
    const fallback = makeMockProvider(() => {
      // fallback 不应被调用
    })

    const router = new LLMRouter(primary, fallback)

    const chunks: string[] = []
    let receivedUsage: TokenUsage | null = null
    let receivedError: LLMError | null = null

    await router.streamChat({
      ...defaultParams,
      onChunk: (text) => chunks.push(text),
      onComplete: (u) => { receivedUsage = u },
      onError: (err) => { receivedError = err },
    })

    expect(receivedError).toBeNull()
    expect(chunks).toEqual(['Hello', ' world'])
    expect(receivedUsage).toEqual(usage)
    expect(fallback.streamChat).not.toHaveBeenCalled()
  })

  it('primary onError（非 CANCELLED）→ 自动切换 fallback，fallback 正常完成', async () => {
    const fallbackUsage: TokenUsage = { promptTokens: 8, completionTokens: 4, totalTokens: 12 }

    const primary = makeMockProvider((params) => {
      params.onChunk('partial')
      params.onError({ code: 'API_ERROR', message: 'primary failed' })
    })
    const fallback = makeMockProvider((params) => {
      params.onChunk('fallback chunk')
      params.onComplete(fallbackUsage)
    })

    const router = new LLMRouter(primary, fallback)

    const chunks: string[] = []
    let receivedUsage: TokenUsage | null = null
    let receivedError: LLMError | null = null

    await router.streamChat({
      ...defaultParams,
      onChunk: (text) => chunks.push(text),
      onComplete: (u) => { receivedUsage = u },
      onError: (err) => { receivedError = err },
    })

    // 上层不应收到 primary 的错误
    expect(receivedError).toBeNull()
    // 上层收到了两个 provider 的 chunk（primary 失败前的 + fallback 的）
    expect(chunks).toContain('fallback chunk')
    expect(receivedUsage).toEqual(fallbackUsage)
    expect(fallback.streamChat).toHaveBeenCalledTimes(1)
  })

  it('primary + fallback 均 onError → 上层 onError 被调用，message 含"两个 LLM 提供商均不可用"', async () => {
    const primary = makeMockProvider((params) => {
      params.onError({ code: 'API_ERROR', message: 'primary failed' })
    })
    const fallback = makeMockProvider((params) => {
      params.onError({ code: 'NETWORK_ERROR', message: 'fallback failed' })
    })

    const router = new LLMRouter(primary, fallback)

    let receivedError: LLMError | null = null
    let receivedComplete = false

    await router.streamChat({
      ...defaultParams,
      onChunk: () => {},
      onComplete: () => { receivedComplete = true },
      onError: (err) => { receivedError = err },
    })

    expect(receivedComplete).toBe(false)
    expect(receivedError).not.toBeNull()
    expect(receivedError?.message).toContain('两个 LLM 提供商均不可用')
    expect(fallback.streamChat).toHaveBeenCalledTimes(1)
  })

  it('primary CANCELLED 时不触发 fallback，直接透传 onError', async () => {
    const primary = makeMockProvider((params) => {
      params.onError({ code: 'CANCELLED', message: '请求已取消' })
    })
    const fallback = makeMockProvider(() => {
      // fallback 不应被调用
    })

    const router = new LLMRouter(primary, fallback)

    let receivedError: LLMError | null = null

    await router.streamChat({
      ...defaultParams,
      onChunk: () => {},
      onComplete: () => {},
      onError: (err) => { receivedError = err },
    })

    expect(receivedError).not.toBeNull()
    expect(receivedError?.code).toBe('CANCELLED')
    expect(fallback.streamChat).not.toHaveBeenCalled()
  })
})
