export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface LLMError {
  code: 'TIMEOUT' | 'API_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'CANCELLED'
  message: string
  statusCode?: number
}

export interface StreamChatParams {
  model: string
  messages: ChatMessage[]
  onChunk: (text: string) => void
  onComplete: (usage: TokenUsage) => void
  onError: (error: LLMError) => void
  signal?: AbortSignal
}

export interface LLMProvider {
  streamChat(params: StreamChatParams): Promise<void>
}

export const DEEPSEEK_MODELS = {
  CHAT: 'deepseek-chat',
} as const
