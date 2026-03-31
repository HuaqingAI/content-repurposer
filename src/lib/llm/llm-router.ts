import type { LLMProvider, StreamChatParams, LLMError } from '@/lib/llm/types'
import { deepseekProvider } from '@/lib/llm/providers/deepseek'
import { qwenProvider, QWEN_MODELS } from '@/lib/llm/providers/qwen'

export class LLMRouter implements LLMProvider {
  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
  ) {}

  async streamChat(params: StreamChatParams): Promise<void> {
    const { onError } = params

    return new Promise<void>((resolve) => {
      // P4: 缓冲 primary 的 chunks，仅在 primary 成功时转发给上层，避免 fallback 切换时产生混合输出
      const primaryChunkBuffer: string[] = []

      // primary onError 拦截器：CANCELLED 时直接透传，其余静默切换 fallback
      const primaryOnError = (error: LLMError) => {
        if (error.code === 'CANCELLED') {
          onError(error)
          resolve()
          return
        }

        // 丢弃 primary 已缓冲的 chunks，切换到 fallback 从头生成
        primaryChunkBuffer.length = 0
        console.warn(
          `[LLMRouter] primary failed (code=${error.code} status=${error.statusCode ?? '-'}), switching to fallback: ${error.message}`
        )

        // 静默切换到 fallback，替换 model 为 fallback 的 model
        void this.fallback
          .streamChat({
            ...params,
            model: QWEN_MODELS.CHAT,
            onError: (fallbackError) => {
              // P2: 强制覆盖 code 为 API_ERROR，不透传 fallback 的原始 code
              console.error(
                `[LLMRouter] fallback also failed (code=${fallbackError.code} status=${fallbackError.statusCode ?? '-'}): ${fallbackError.message}`
              )
              onError({ code: 'API_ERROR', message: '两个 LLM 提供商均不可用，请稍后重试' })
              resolve()
            },
            onComplete: (usage) => {
              params.onComplete(usage)
              resolve()
            },
          })
          .catch((err: unknown) => {
            // P1: .catch() 分支同样使用 API_ERROR
            console.error('[LLMRouter] fallback threw exception:', err)
            onError({ code: 'API_ERROR', message: '两个 LLM 提供商均不可用，请稍后重试' })
            resolve()
          })
      }

      void this.primary
        .streamChat({
          ...params,
          onChunk: (text) => primaryChunkBuffer.push(text),
          onError: primaryOnError,
          onComplete: (usage) => {
            // primary 成功：将缓冲的 chunks 转发给上层，再通知完成
            for (const chunk of primaryChunkBuffer) {
              params.onChunk(chunk)
            }
            params.onComplete(usage)
            resolve()
          },
        })
        .catch((err: unknown) => {
          // P3: primary 抛出异常时也走 fallback 路径，而非直接透传错误
          console.warn('[LLMRouter] primary threw exception, switching to fallback:', err)
          primaryOnError({ code: 'NETWORK_ERROR', message: 'primary failed' })
        })
    })
  }
}

export const llmRouter = new LLMRouter(deepseekProvider, qwenProvider)
