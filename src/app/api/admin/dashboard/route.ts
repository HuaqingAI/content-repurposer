import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/features/admin/admin-service'
import type { DateRange } from '@/features/admin/admin-service'

export async function GET(request: Request) {
  // 1. 认证检查
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }

  // 2. 管理员权限校验
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (roleError) {
    console.error('[dashboard] role query error:', roleError.message)
    return Response.json(
      { data: null, error: { code: 'FORBIDDEN', message: '无权限' } },
      { status: 403 }
    )
  }

  if (userData?.role !== 'admin') {
    return Response.json(
      { data: null, error: { code: 'FORBIDDEN', message: '无权限' } },
      { status: 403 }
    )
  }

  // 3. 解析 range 参数
  const url = new URL(request.url)
  const rangeParam = url.searchParams.get('range') ?? 'today'
  const validRanges: DateRange[] = ['today', '7d', '30d']
  const range: DateRange = validRanges.includes(rangeParam as DateRange)
    ? (rangeParam as DateRange)
    : 'today'

  // 4. 查询聚合数据
  try {
    const stats = await getDashboardStats(range)
    return Response.json({ data: stats, error: null })
  } catch (err) {
    console.error('[dashboard] getDashboardStats error:', err)
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '数据查询失败，请稍后重试' } },
      { status: 500 }
    )
  }
}
