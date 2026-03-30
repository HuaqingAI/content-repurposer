import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params

  // 2. 查询记录（同时校验 userId 防止 IDOR；select 替代 include 以过滤内部成本字段）
  let record
  try {
    record = await prisma.rewriteRecord.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        originalText: true,
        originalUrl: true,
        contentType: true,
        createdAt: true,
        metadata: true,
        results: {
          select: {
            id: true,
            recordId: true,
            platform: true,
            tone: true,
            body: true,
            titles: true,
            tags: true,
            hook: true,
            createdAt: true,
            feedback: true,
            // apiModel / apiTokensUsed / apiCostCents / apiDurationMs 为内部字段，不暴露给前端
          },
        },
      },
    })
  } catch {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }

  if (!record) {
    return Response.json(
      { data: null, error: { code: 'NOT_FOUND', message: '记录不存在' } },
      { status: 404 }
    )
  }

  // 3. 将 results 从 record 中分离，避免响应中重复嵌套
  const { results: rawResults, ...recordData } = record

  return Response.json({
    data: {
      record: { ...recordData, createdAt: record.createdAt.toISOString() },
      results: rawResults.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    error: null,
  })
}
