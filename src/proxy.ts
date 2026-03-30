import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // 1. 创建初始 response（必须先创建，setAll 中会重新赋值以携带更新的 cookies）
  let supabaseResponse = NextResponse.next({ request })

  // 2. 创建 Supabase 客户端
  // 注意：不能使用 src/lib/env.ts（含 server-only），直接读 process.env
  // P2 fix: 运行时校验，缺失时抛出明确错误而非晦涩崩溃
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('[proxy] Missing required env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 将刷新后的 session cookie 写入 request（供下游服务端代码读取）
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 重新创建 response 以携带更新的 request cookies
          supabaseResponse = NextResponse.next({ request })
          // 将 cookies 写入 response（发送给浏览器，实现 session 续期）
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. 调用 getUser() 而非 getSession()
  // getUser() 会向 Supabase Auth 发出请求验证 token，同时刷新即将过期的 token
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser()

  // P1 fix: 网络故障或 token 解析失败时返回 supabaseResponse，避免把所有已登录用户踢回 /login
  if (getUserError) {
    console.error('[proxy] getUser error:', getUserError.message)
    return supabaseResponse
  }

  const path = request.nextUrl.pathname

  // 辅助函数：将 supabaseResponse 中刷新后的 session cookie 复制到重定向 response
  // P3 fix: 避免 token 刷新与重定向并发时 cookie 丢失导致 session 续期失效
  const redirectWithCookies = (url: URL) => {
    // P6 fix: 使用 302（不保留 POST 方法），307 会导致 POST 请求被保留转发
    const redirectResponse = NextResponse.redirect(url, 302)
    supabaseResponse.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    )
    return redirectResponse
  }

  // 4. 保护路由：未登录用户访问 /app/* 跳转到 /login
  // P4 fix: 使用精确路径匹配，避免误匹配 /appstore 等非应用路径
  if ((path === '/app' || path.startsWith('/app/')) && !user) {
    return redirectWithCookies(new URL('/login', request.url))
  }

  // 4b. 管理后台路由保护：未登录跳 /login，非 admin 跳 /app
  // 仅在路径以 /admin 开头时才查询数据库，避免每次请求都查 role
  if (path === '/admin' || path.startsWith('/admin/')) {
    if (!user) {
      return redirectWithCookies(new URL('/login', request.url))
    }
    // 查询当前用户 role（使用 user session + RLS SELECT 策略 users_select_own）
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError) {
      // 查询失败时拒绝访问（fail-safe），避免 DB 故障时意外放行非 admin
      console.error('[proxy] role query error:', roleError.message)
      return redirectWithCookies(new URL('/app', request.url))
    }

    if (userData?.role !== 'admin') {
      return redirectWithCookies(new URL('/app', request.url))
    }
  }

  // 5. 已登录用户访问 /login 跳转到 /app（避免重复登录）
  if (path === '/login' && user) {
    return redirectWithCookies(new URL('/app', request.url))
  }

  // 6. 返回 supabaseResponse（包含刷新后的 session cookies）
  // 必须返回此 response 而非 NextResponse.next()，否则 session cookie 丢失
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除：
     * - _next/static （静态资源）
     * - _next/image  （图片优化）
     * - favicon.ico  （网站图标）
     * - api/         （API Routes 在各自路由中处理认证）
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
