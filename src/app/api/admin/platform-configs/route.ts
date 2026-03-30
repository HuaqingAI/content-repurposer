import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { UserRole, Platform } from '@/generated/prisma/enums'
import {
  getPlatformConfigs,
  updatePlatformConfig,
} from '@/features/admin/admin-service'

// 合法的平台枚举值
const VALID_PLATFORMS: Platform[] = [Platform.xiaohongshu, Platform.wechat, Platform.zhihu]

/** 复用：认证 + admin 权限校验，成功返回 userId，失败返回 Response */
async function requireAdmin(): Promise<{ userId: string } | Response> {
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

  return { userId: user.id }
}

export async function GET() {
  const authResult = await requireAdmin()
  if (authResult instanceof Response) return authResult

  try {
    const configs = await getPlatformConfigs()
    return Response.json({ data: { configs }, error: null })
  } catch (err) {
    console.error('[admin/platform-configs] getPlatformConfigs error:', err)
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '查询失败，请稍后重试' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin()
  if (authResult instanceof Response) return authResult
  const { userId } = authResult

  // 解析请求体
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' } },
      { status: 400 }
    )
  }

  // P2: 守卫 body 必须为普通对象
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: '请求体格式错误' } },
      { status: 400 }
    )
  }

  const { platform, styleRules, promptTemplate, fewShotExamples } = body as Record<
    string,
    unknown
  >

  // 校验 platform
  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return Response.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `platform 无效，必须为 ${VALID_PLATFORMS.join(' | ')}`,
        },
      },
      { status: 400 }
    )
  }

  // 校验 promptTemplate
  if (typeof promptTemplate !== 'string' || promptTemplate.trim() === '') {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'promptTemplate 不能为空' } },
      { status: 400 }
    )
  }

  // P3: 校验 fewShotExamples 必须为数组（若提供）
  if (fewShotExamples !== undefined && !Array.isArray(fewShotExamples)) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'fewShotExamples 必须为数组' } },
      { status: 400 }
    )
  }

  // P4: 校验 styleRules 必须为对象（若提供）
  if (styleRules !== undefined && (typeof styleRules !== 'object' || Array.isArray(styleRules))) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'styleRules 必须为对象' } },
      { status: 400 }
    )
  }

  try {
    const newConfig = await updatePlatformConfig(
      platform as Platform,
      {
        styleRules: styleRules ?? {},
        promptTemplate: promptTemplate.trim(),
        fewShotExamples: fewShotExamples ?? [],
      },
      userId
    )
    return Response.json({
      data: {
        id: newConfig.id,
        platform: newConfig.platform,
        configVersion: newConfig.configVersion,
        updatedAt: newConfig.updatedAt,
      },
      error: null,
    })
  } catch (err) {
    console.error('[admin/platform-configs] updatePlatformConfig error:', err)
    return Response.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: '保存失败，请稍后重试' } },
      { status: 500 }
    )
  }
}
