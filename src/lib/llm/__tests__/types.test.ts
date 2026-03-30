/**
 * @jest-environment node
 */
import { DEEPSEEK_MODELS } from '@/lib/llm/types'
import type { LLMProvider } from '@/lib/llm/types'
import { deepseekProvider } from '@/lib/llm/providers/deepseek'

jest.mock('@/lib/env', () => ({ env: { DEEPSEEK_API_KEY: 'test-key' } }))

describe('DEEPSEEK_MODELS', () => {
  it('CHAT 值为 deepseek-chat', () => {
    expect(DEEPSEEK_MODELS.CHAT).toBe('deepseek-chat')
  })
})

describe('DeepSeekProvider 类型约束', () => {
  it('deepseekProvider 满足 LLMProvider 接口', () => {
    // TypeScript 类型层面验证：如果不满足接口，编译会报错
    const provider: LLMProvider = deepseekProvider
    expect(typeof provider.streamChat).toBe('function')
  })
})
