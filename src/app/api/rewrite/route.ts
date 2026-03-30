// 注意：此文件为桩实现。Story 3.4a 将替换 TODO 部分为实际 LLM 改写逻辑。

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

export async function POST(_request: Request) {
  // 1. 认证检查（必须先于限流）
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  // 认证服务异常（网络/配置错误）与未登录需区分，避免基础设施故障被误报为 401
  if (authError) {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }

  if (!user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }

  // 2. 禁用账号检查
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isBanned: true },
  })
  if (dbUser?.isBanned) {
    return Response.json(
      { data: null, error: { code: 'ACCOUNT_BANNED', message: '账号已被禁用' } },
      { status: 403 }
    )
  }

  // 3. 限流检查
  const rateLimitResult = checkRateLimit(user.id)
  if (!rateLimitResult.allowed) {
    // Math.max(1, ...) 确保 Retry-After 始终为正整数（RFC 7231 要求）
    const retryAfterSec = Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
    return Response.json(
      {
        data: null,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' },
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }
    )
  }

  // 3. TODO(Story 3.4a): 实现 LLM 串行 SSE 改写逻辑
  return Response.json(
    { data: null, error: { code: 'NOT_IMPLEMENTED', message: '改写功能即将上线' } },
    { status: 501 }
  )
}
