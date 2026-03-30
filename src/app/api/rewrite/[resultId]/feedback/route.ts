import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const VALID_FEEDBACK = ['helpful', 'not_helpful'] as const
type FeedbackValue = (typeof VALID_FEEDBACK)[number]

// UUID v4 格式校验（防止 SQL 注入等路径参数攻击）
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resultId: string }> }
) {
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

  if (!user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }

  // 2. 校验路径参数 resultId
  const { resultId } = await params
  if (!UUID_REGEX.test(resultId)) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '无效的结果 ID' } },
      { status: 400 }
    )
  }

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

  const { feedback, comment } = body as Record<string, unknown>

  if (typeof feedback !== 'string' || !VALID_FEEDBACK.includes(feedback as FeedbackValue)) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'feedback 参数无效，应为 helpful 或 not_helpful' } },
      { status: 400 }
    )
  }

  const feedbackValue = feedback as FeedbackValue
  const feedbackComment = typeof comment === 'string' && comment.trim() ? comment.trim() : null

  // P4 fix: feedbackComment 长度上限，防止超大文本存储滥用
  if (feedbackComment && feedbackComment.length > 500) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '反馈说明不能超过 500 字符' } },
      { status: 400 }
    )
  }

  // 4. 查询并校验结果归属（防止 IDOR：只允许更新当前用户的结果）
  let existingResult
  try {
    existingResult = await prisma.rewriteResult.findFirst({
      where: {
        id: resultId,
        record: { userId: user.id },
      },
      select: { id: true },
    })
  } catch {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }

  if (!existingResult) {
    return Response.json(
      { data: null, error: { code: 'NOT_FOUND', message: '结果不存在' } },
      { status: 404 }
    )
  }

  // 5. 写入反馈
  try {
    await prisma.rewriteResult.update({
      where: { id: resultId },
      data: {
        feedback: feedbackValue,
        feedbackComment,
      },
    })
  } catch {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }

  return Response.json({
    data: { resultId, feedback: feedbackValue },
    error: null,
  })
}
