/**
 * @jest-environment node
 */

import { calculateCostCents, createPlatformCostRecord, MODEL_PRICING } from '../cost-tracker'
import type { TokenUsage } from '../types'

describe('calculateCostCents', () => {
  it('deepseek-chat: 1000 tokens → 1 分', () => {
    expect(calculateCostCents('deepseek-chat', 1000)).toBe(1)
  })

  it('deepseek-chat: 1500 tokens → 2 分（向上取整）', () => {
    expect(calculateCostCents('deepseek-chat', 1500)).toBe(2)
  })

  it('deepseek-chat: 0 tokens → 0 分', () => {
    expect(calculateCostCents('deepseek-chat', 0)).toBe(0)
  })

  it('qwen-plus: 1000 tokens → 2 分', () => {
    expect(calculateCostCents('qwen-plus', 1000)).toBe(2)
  })

  it('未知 model 使用默认定价 0.001，1000 tokens → 1 分', () => {
    expect(calculateCostCents('unknown-model-xyz', 1000)).toBe(1)
  })

  it('未知 model: 500 tokens → 1 分（Math.ceil(0.5)）', () => {
    expect(calculateCostCents('unknown-model-xyz', 500)).toBe(1)
  })
})

describe('MODEL_PRICING', () => {
  it('包含 deepseek-chat 定价', () => {
    expect(MODEL_PRICING['deepseek-chat']).toBeDefined()
    expect(MODEL_PRICING['deepseek-chat']).toBeGreaterThan(0)
  })

  it('包含 qwen-plus 定价', () => {
    expect(MODEL_PRICING['qwen-plus']).toBeDefined()
    expect(MODEL_PRICING['qwen-plus']).toBeGreaterThan(0)
  })
})

describe('createPlatformCostRecord', () => {
  const mockUsage: TokenUsage = {
    promptTokens: 50,
    completionTokens: 150,
    totalTokens: 200,
  }

  it('返回正确的 platform 和 model', () => {
    const startTime = Date.now()
    const record = createPlatformCostRecord('xiaohongshu', 'deepseek-chat', mockUsage, startTime)
    expect(record.platform).toBe('xiaohongshu')
    expect(record.model).toBe('deepseek-chat')
  })

  it('tokensUsed 等于 totalTokens', () => {
    const startTime = Date.now()
    const record = createPlatformCostRecord('wechat', 'deepseek-chat', mockUsage, startTime)
    expect(record.tokensUsed).toBe(200)
  })

  it('costCents 使用 calculateCostCents 计算', () => {
    const startTime = Date.now()
    const record = createPlatformCostRecord('zhihu', 'deepseek-chat', mockUsage, startTime)
    expect(record.costCents).toBe(calculateCostCents('deepseek-chat', 200))
  })

  it('durationMs >= 0', () => {
    const startTime = Date.now() - 100
    const record = createPlatformCostRecord('xiaohongshu', 'deepseek-chat', mockUsage, startTime)
    expect(record.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('durationMs 反映真实经过时间', () => {
    const startTime = Date.now() - 500
    const record = createPlatformCostRecord('xiaohongshu', 'deepseek-chat', mockUsage, startTime)
    expect(record.durationMs).toBeGreaterThanOrEqual(490) // 允许少许误差
  })
})
