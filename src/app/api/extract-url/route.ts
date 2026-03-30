import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { extractUrl } from '@/lib/url-extractor/extractor'

export async function POST(request: Request) {
  // 1. 认证校验
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }

  // 2. 限流
  const limitResult = checkRateLimit(user.id)
  if (!limitResult.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((limitResult.resetAt - Date.now()) / 1000))
    return Response.json(
      { data: null, error: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' } },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  // 3. 解析 body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' } },
      { status: 400 }
    )
  }

  const { url } = (body ?? {}) as Record<string, unknown>

  if (typeof url !== 'string' || !url.trim()) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'URL 格式不正确' } },
      { status: 400 }
    )
  }

  // 4. 验证 URL 格式
  try {
    new URL(url)
  } catch {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'URL 格式不正确' } },
      { status: 400 }
    )
  }

  // 5. 提取内容（服务端 10 秒熔断）
  const result = await extractUrl(url.trim(), AbortSignal.timeout(10_000))

  if (result.success) {
    return Response.json({ data: { text: result.text, success: true }, error: null })
  }

  // 业务失败用 200，不用 4xx/5xx
  return Response.json({
    data: { success: false, error: result.error },
    error: null,
  })
}
