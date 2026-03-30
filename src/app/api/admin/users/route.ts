import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/enums'
import { getUserList } from '@/features/admin/admin-service'

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

  // 2. 管理员权限校验（Prisma 直连，绕过 RLS）
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  })
  if (!dbUser || dbUser.role !== UserRole.admin) {
    return Response.json(
      { data: null, error: { code: 'FORBIDDEN', message: '无权限' } },
      { status: 403 }
    )
  }

  // 3. 解析查询参数
  const url = new URL(request.url)
  const rawSearch = url.searchParams.get('search')?.trim()
  const search = rawSearch || undefined
  const rawPage = parseInt(url.searchParams.get('page') ?? '1', 10)
  const rawPageSize = parseInt(url.searchParams.get('pageSize') ?? '20', 10)
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage)
  const pageSize = Math.min(100, Math.max(1, isNaN(rawPageSize) ? 20 : rawPageSize))
  const skip = (page - 1) * pageSize

  // 4. 查询用户列表
  try {
    const { users, total } = await getUserList({ search, skip, take: pageSize })
    return Response.json({ data: { users, total, page, pageSize }, error: null })
  } catch (err) {
    console.error('[admin/users] getUserList error:', err)
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '查询失败，请稍后重试' } },
      { status: 500 }
    )
  }
}
