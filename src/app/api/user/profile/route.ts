import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, '名称不能为空').max(50, '名称不超过 50 个字符'),
})

export async function PATCH(request: Request) {
  // 1. 身份校验
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

  // 2. 参数校验
  const body = await request.json().catch(() => null)
  const parsed = UpdateProfileSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return Response.json(
      {
        data: null,
        error: {
          code: 'INVALID_PARAMS',
          message: firstIssue?.message ?? '参数无效',
        },
      },
      { status: 400 }
    )
  }

  // 3. 更新用户 displayName
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: parsed.data.displayName },
    })
    return Response.json({ data: { userId: user.id }, error: null })
  } catch {
    return Response.json(
      { data: null, error: { code: 'UPDATE_FAILED', message: '更新失败，请稍后重试' } },
      { status: 500 }
    )
  }
}
