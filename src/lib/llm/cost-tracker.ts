import type { Platform } from '@/generated/prisma/client'
import type { TokenUsage } from './types'

/** 每千 token 成本（分） */
export const MODEL_PRICING: Record<string, number> = {
  'deepseek-chat': 0.001,
  'qwen-plus': 0.002,
}

const DEFAULT_COST_PER_1K_TOKENS = 0.001

export interface PlatformCostRecord {
  platform: Platform
  model: string
  tokensUsed: number
  costCents: number
  durationMs: number
}

export function calculateCostCents(model: string, totalTokens: number): number {
  const pricePerK = MODEL_PRICING[model] ?? DEFAULT_COST_PER_1K_TOKENS
  return Math.ceil(totalTokens * pricePerK)
}

export function createPlatformCostRecord(
  platform: Platform,
  model: string,
  usage: TokenUsage,
  startTime: number
): PlatformCostRecord {
  return {
    platform,
    model,
    tokensUsed: usage.totalTokens,
    costCents: calculateCostCents(model, usage.totalTokens),
    durationMs: Math.max(0, Date.now() - startTime),
  }
}
