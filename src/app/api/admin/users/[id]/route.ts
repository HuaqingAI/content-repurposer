import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/enums'
import { PrismaClientKnownRequestError } from '@/generated/prisma/runtime/library'
import { toggleUserBan } from '@/features/admin/admin-service'

export async function PATCH(
  request: Request,
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

  // 2. 管理员权限校验（Prisma 直连，绕过 RLS）
  const dbAdmin = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  })
  if (!dbAdmin || dbAdmin.role !== UserRole.admin) {
    return Response.json(
      { data: null, error: { code: 'FORBIDDEN', message: '无权限' } },
      { status: 403 }
    )
  }

  // 3. 解析请求体
  let banned: boolean
  try {
    const body = await request.json()
    if (typeof body.banned !== 'boolean') {
      return Response.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: 'banned 字段必须为布尔值' } },
        { status: 400 }
      )
    }
    banned = body.banned
  } catch {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' } },
      { status: 400 }
    )
  }

  // 4. 自禁保护
  const { id: targetUserId } = await params
  if (targetUserId === user.id) {
    return Response.json(
      { data: null, error: { code: 'FORBIDDEN', message: '不能禁用自己的账号' } },
      { status: 403 }
    )
  }

  // 5. 更新用户状态
  try {
    const result = await toggleUserBan(targetUserId, banned)
    return Response.json({ data: result, error: null })
  } catch (err: unknown) {
    // Prisma P2025：记录不存在
    if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
      return Response.json(
        { data: null, error: { code: 'NOT_FOUND', message: '用户不存在' } },
        { status: 404 }
      )
    }
    console.error('[admin/users/[id]] toggleUserBan error:', err)
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '操作失败，请稍后重试' } },
      { status: 500 }
    )
  }
}
