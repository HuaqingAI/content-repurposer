import { env } from '@/lib/env'
import type { LLMProvider, StreamChatParams, TokenUsage, LLMError } from '@/lib/llm/types'

export const QWEN_CONFIG = {
  baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
  timeoutMs: 30000,
} as const

export const QWEN_MODELS = {
  CHAT: 'qwen-plus',
} as const

async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
  onComplete: (usage: TokenUsage) => void,
  onError: (error: LLMError) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        buffer += decoder.decode(value, { stream: true })
      }

      // 流结束时刷新 decoder 内部状态（处理末尾截断的多字节 UTF-8 序列），再追加换行强制处理残留行
      if (done) {
        buffer += decoder.decode()
        buffer += '\n'
      }

      const lines = buffer.split('\n')
      buffer = done ? '' : (lines.pop() ?? '')

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          if (finalUsage.totalTokens === 0) {
            console.warn('[QwenProvider] onComplete called with zero token usage')
          }
          onComplete(finalUsage)
          return
        }

        try {
          const parsed = JSON.parse(data) as {
            error?: { message?: string; code?: number }
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          }

          // 检查流中内嵌的 API 错误消息
          if (parsed.error) {
            onError({
              code: 'API_ERROR',
              message: parsed.error.message ?? '通义千问 API 流错误',
              statusCode: parsed.error.code,
            })
            return
          }

          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) onChunk(delta)

          if (parsed.usage) {
            finalUsage = {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0,
            }
          }
        } catch {
          // 跳过非 JSON 行（keep-alive 心跳等正常情况）
        }
      }

      if (done) break
    }

    // 流正常结束但未收到 [DONE] 标记，视为连接意外中断
    onError({ code: 'NETWORK_ERROR', message: '连接意外中断，请重试' })
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      onError({ code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络' })
    }
  } finally {
    // 释放 reader 锁，防止资源泄漏
    reader.cancel().catch(() => {})
  }
}

export class QwenProvider implements LLMProvider {
  private readonly apiKey: string

  constructor() {
    this.apiKey = env.QWEN_API_KEY
  }

  async streamChat(params: StreamChatParams): Promise<void> {
    const { model, messages, onChunk, onComplete, onError, signal } = params

    // signal 已在进入时处于 aborted 状态时，addEventListener 不会触发，需提前检测
    if (signal?.aborted) {
      onError({ code: 'CANCELLED', message: '请求已取消' })
      return
    }

    const controller = new AbortController()
    let completed = false

    // 保证 onComplete/onError 只触发一次
    const safeOnComplete = (usage: TokenUsage) => {
      if (completed) return
      completed = true
      onComplete(usage)
    }

    const safeOnError = (error: LLMError) => {
      if (completed) return
      completed = true
      onError(error)
    }

    // P5: 终态（onError/onComplete）触发后屏蔽后续 onChunk，防止超时/取消后仍有 chunk 回调
    const safeOnChunk = (text: string) => {
      if (completed) return
      onChunk(text)
    }

    const timeoutId = setTimeout(() => {
      controller.abort()
      safeOnError({ code: 'TIMEOUT', message: '请求超时，请稍后重试' })
    }, QWEN_CONFIG.timeoutMs)

    // 使用具名函数以便后续 removeEventListener
    const abortListener = () => {
      clearTimeout(timeoutId)
      controller.abort()
      safeOnError({ code: 'CANCELLED', message: '请求已取消' })
    }
    signal?.addEventListener('abort', abortListener)

    let response: Response
    try {
      response = await fetch(`${QWEN_CONFIG.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages, stream: true, max_tokens: 4096 }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abortListener)
      if (err instanceof Error && err.name === 'AbortError') {
        // 超时或取消已在各自回调中处理，此处不重复报错
        return
      }
      // 不透传原始 Error 对象，防止请求头（含 API Key）泄漏到日志
      safeOnError({ code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络' })
      return
    }

    if (!response.ok) {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abortListener)
      // 读取响应体以获取详细错误信息
      let errorDetail = ''
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        errorDetail = body?.error?.message ?? ''
      } catch {
        // 响应体非 JSON，忽略
      }
      safeOnError({
        code: 'API_ERROR',
        message: errorDetail
          ? `通义千问 API 错误：${errorDetail}`
          : `通义千问 API 请求失败（状态码 ${response.status}）`,
        statusCode: response.status,
      })
      return
    }

    if (!response.body) {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abortListener)
      safeOnError({ code: 'PARSE_ERROR', message: '响应解析失败' })
      return
    }

    try {
      await parseSSEStream(response.body, safeOnChunk, safeOnComplete, safeOnError)
    } finally {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abortListener)
    }
  }
}

export const qwenProvider = new QwenProvider()
