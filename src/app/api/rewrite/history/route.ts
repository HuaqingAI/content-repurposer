import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { PAGE_SIZE } from '@/features/history/types'

export async function GET(request: Request) {
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

  // 2. 解析分页参数（防御 NaN：parseInt 对非数字返回 NaN，Math.max(1, NaN) = NaN）
  const url = new URL(request.url)
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10)
  const page = isNaN(rawPage) ? 1 : Math.max(1, rawPage)

  // 3. 查询历史记录（userId 过滤保证数据隔离）
  let records, total
  try {
    ;[records, total] = await Promise.all([
      prisma.rewriteRecord.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          originalText: true,
          contentType: true,
          createdAt: true,
          results: {
            select: { id: true, platform: true },
          },
        },
      }),
      prisma.rewriteRecord.count({ where: { userId: user.id } }),
    ])
  } catch {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }

  // 4. 截取 originalText 前 100 字（Unicode 安全）
  const recordsWithPreview = records.map((r) => ({
    ...r,
    originalText: [...r.originalText].slice(0, 100).join(''),
    createdAt: r.createdAt.toISOString(),
  }))

  return Response.json({
    data: { records: recordsWithPreview, total, page, pageSize: PAGE_SIZE },
    error: null,
  })
}
