import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, checkIpRateLimit } from '@/lib/rate-limit'
import { llmRouter } from '@/lib/llm/llm-router'
import { assemblePrompt } from '@/lib/llm/prompt-assembler'
import { LLMOutputParser } from '@/lib/llm/output-parser'
import { DEEPSEEK_MODELS } from '@/lib/llm/types'
import type { TokenUsage } from '@/lib/llm/types'
import { parseContentType } from '@/lib/llm/content-type-parser'
import { createPlatformCostRecord } from '@/lib/llm/cost-tracker'
import type { PlatformCostRecord } from '@/lib/llm/cost-tracker'
import { prisma } from '@/lib/prisma'
import type { Platform, Tone } from '@/generated/prisma/client'

const VALID_PLATFORMS: readonly string[] = ['xiaohongshu', 'wechat', 'zhihu']
const VALID_TONES: readonly string[] = ['casual', 'standard', 'formal']

function encodeSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? ''
}

interface PlatformResult {
  platform: Platform
  body: string
  titles: string[]
  tags: string[]
  hook: string
  rawLLMOutput: string
  costRecord: PlatformCostRecord
}

// 暂存 onComplete 收集到的数据，待 Promise resolve 后再做 DB 写入和 platform_complete 发送
interface PendingPlatformData {
  titles: string[]
  tags: string[]
  hook: string
  bodyChunks: string[]
  rawLLMOutput: string
  costRecord: PlatformCostRecord
}

export async function POST(request: Request) {
  // 1. 认证检查
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }

  const isTrial = !user

  // 2. 已登录用户限流（body 解析前检查，避免频繁请求消耗解析资源）
  if (!isTrial) {
    const rateLimitResult = checkRateLimit(user!.id)
    if (!rateLimitResult.allowed) {
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
  }
  // 试用模式 IP 限流在 body 校验之后执行（避免无效请求消耗稀缺的每小时 3 次额度）

  // 3. 解析并校验 body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' } },
      { status: 400 }
    )
  }

  const { text, platforms, tone } = body as Record<string, unknown>

  if (typeof text !== 'string' || text.trim().length < 50) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '原文字数不能少于 50 字' } },
      { status: 400 }
    )
  }

  if (text.trim().length > 5000) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '原文字数不能超过 5000 字' } },
      { status: 400 }
    )
  }

  if (
    !Array.isArray(platforms) ||
    platforms.length === 0 ||
    !platforms.every((p) => VALID_PLATFORMS.includes(p))
  ) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '请至少选择一个有效的目标平台' } },
      { status: 400 }
    )
  }

  if (typeof tone !== 'string' || !VALID_TONES.includes(tone)) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '语气风格参数无效' } },
      { status: 400 }
    )
  }

  if (isTrial && platforms.length > 1) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '试用模式仅支持单平台改写' } },
      { status: 400 }
    )
  }

  // 试用模式 IP 限流（body 校验通过后执行，避免无效请求消耗额度）
  // P2 fix: ip 为空时拒绝请求，防止无法识别来源的客户端绕过限流
  if (isTrial) {
    const ip = getClientIp(request)
    if (!ip) {
      return Response.json(
        {
          data: null,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: '无法识别请求来源，请注册后使用' },
        },
        { status: 429 }
      )
    }
    const ipLimit = checkIpRateLimit(ip)
    if (!ipLimit.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000))
      return Response.json(
        {
          data: null,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: '今日试用次数已达上限，注册后可免费无限使用' },
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
      )
    }
  }

  const validatedPlatforms = platforms as Platform[]
  const validatedTone = tone as Tone
  const originalText = text.trim()

  // 4. 构建 SSE 流式响应
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        try {
          controller.enqueue(encoder.encode(encodeSSE(event, data)))
        } catch {
          // 客户端已断连，忽略写入错误
        }
      }

      let fatalError = false
      const platformResults: PlatformResult[] = []
      // 跨 platform 复用的 rewriteRecord（首个平台成功时创建）
      let rewriteRecord: { id: string } | null = null

      try {
        for (const platform of validatedPlatforms) {
          if (fatalError) break

          const platformStartTime = Date.now()
          let rawLLMOutput = ''
          const bodyChunks: string[] = []

          send('platform_start', { platform })

          let messages
          try {
            messages = await assemblePrompt({
              platform,
              tone: validatedTone,
              originalText,
            })
          } catch (err) {
            console.error(`[rewrite] assemblePrompt failed platform=${platform}:`, err)
            send('error', {
              message: err instanceof Error ? err.message : '平台配置异常，请联系管理员',
              retryable: false,
            })
            fatalError = true
            break
          }

          const parser = new LLMOutputParser()
          const abortController = new AbortController()
          let unsupportedDetected = false
          // TypeScript 5.4: 直接从 Promise 返回数据，避免闭包赋值后 never 类型推断问题
          const pendingData = await new Promise<PendingPlatformData | null>((resolve) => {
            llmRouter.streamChat({
              model: DEEPSEEK_MODELS.CHAT,
              messages,
              signal: abortController.signal,
              onChunk: (chunk: string) => {
                rawLLMOutput += chunk
                const { chunks, unsupported } = parser.processChunk(chunk)
                if (unsupported && !unsupportedDetected) {
                  unsupportedDetected = true
                  fatalError = true
                  send('error', {
                    message: '该内容暂不支持改写，请尝试其他类型的文章',
                    retryable: false,
                  })
                  abortController.abort()
                  return
                }
                if (!unsupportedDetected) {
                  for (const c of chunks) {
                    bodyChunks.push(c)
                    send('chunk', { text: c })
                  }
                }
              },
              onComplete: (usage: TokenUsage) => {
                if (!unsupportedDetected) {
                  const { remainingBodyChunks, titles, tags, hook } = parser.finalize()
                  for (const c of remainingBodyChunks) {
                    bodyChunks.push(c)
                    send('chunk', { text: c })
                  }

                  const costRecord = createPlatformCostRecord(
                    platform,
                    DEEPSEEK_MODELS.CHAT,
                    usage,
                    platformStartTime
                  )

                  // 发送 metadata 事件（不含 result_id，那需等 DB 写入后才知道）
                  send('titles', { titles })
                  send('tags', { tags })
                  send('hook', { hook })

                  // 直接 resolve 数据，供 await 后处理
                  resolve({
                    titles,
                    tags,
                    hook,
                    bodyChunks: [...bodyChunks],
                    rawLLMOutput,
                    costRecord,
                  })
                  return
                }
                // unsupportedDetected: abort 后 provider 直接回调 onComplete 时，resolve(null) 防止永久挂起
                resolve(null)
              },
              onError: (error) => {
                // CANCELLED 是 abort（如 [UNSUPPORTED_CONTENT]）的预期结果，静默处理
                // fatalError 为 true 时也不发 retryable error，避免与已发出的 error 事件冲突
                if (error.code !== 'CANCELLED' && !fatalError) {
                  fatalError = true
                  console.error(
                    `[rewrite] LLM error platform=${platform} code=${error.code} status=${error.statusCode ?? '-'}:`,
                    error.message
                  )
                  send('error', { message: error.message, retryable: true })
                }
                resolve(null)
              },
            })
          })

          // Promise resolve 后：执行 DB 写入，然后发送 platform_complete（含 result_id）
          if (pendingData && !fatalError) {
            let resultId: string | undefined

            if (!isTrial) {
              try {
                // 首个平台成功时创建 rewriteRecord
                if (!rewriteRecord) {
                  const contentType = parseContentType(pendingData.rawLLMOutput)
                  rewriteRecord = await prisma.rewriteRecord.create({
                    data: {
                      userId: user!.id,
                      originalText,
                      contentType,
                      metadata: {},
                    },
                  })
                }

                const dbResult = await prisma.rewriteResult.create({
                  data: {
                    recordId: rewriteRecord.id,
                    platform,
                    tone: validatedTone,
                    body: pendingData.bodyChunks.join(''),
                    titles: pendingData.titles,
                    tags: pendingData.tags,
                    hook: pendingData.hook,
                    apiModel: pendingData.costRecord.model,
                    apiTokensUsed: pendingData.costRecord.tokensUsed,
                    apiCostCents: pendingData.costRecord.costCents,
                    apiDurationMs: pendingData.costRecord.durationMs,
                  },
                })
                resultId = dbResult.id
              } catch (err) {
                // P3 fix: 携带 platform 和 recordId 以便排查非首平台写入失败
                console.error(
                  `[rewrite 4b-4] per-platform DB write failed platform=${platform} recordId=${rewriteRecord?.id ?? 'none'}:`,
                  err
                )
                // rewriteRecord 已创建但首个 rewriteResult 失败时，清理孤儿记录
                if (rewriteRecord && platformResults.length === 0) {
                  prisma.rewriteRecord.delete({ where: { id: rewriteRecord.id } }).catch((delErr) => {
                    console.error('[rewrite 4b-4] cleanup delete failed:', delErr)
                  })
                  rewriteRecord = null
                }
              }
            }

            send('platform_complete', {
              platform,
              tokens_used: pendingData.costRecord.tokensUsed,
              cost_cents: pendingData.costRecord.costCents,
              result_id: resultId,
            })

            platformResults.push({
              platform,
              body: pendingData.bodyChunks.join(''),
              titles: pendingData.titles,
              tags: pendingData.tags,
              hook: pendingData.hook,
              rawLLMOutput: pendingData.rawLLMOutput,
              costRecord: pendingData.costRecord,
            })
          }
        }

        if (!fatalError) {
          send('done', isTrial ? { trial: true, record_id: null } : { record_id: rewriteRecord?.id ?? null })
        } else {
          // P9 fix: fatalError 路径也传递已有的 record_id（首平台成功时非 null），
          // 避免与已发出的 platform_complete result_id 矛盾
          send('done', { record_id: rewriteRecord?.id ?? null })
        }
      } catch (err) {
        console.error('[rewrite] unexpected error in stream handler:', err)
        send('error', {
          message: err instanceof Error ? err.message : '改写服务异常，请稍后再试',
          retryable: true,
        })
        send('done', { record_id: null })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
