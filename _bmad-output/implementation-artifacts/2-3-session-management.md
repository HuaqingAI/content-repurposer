# Story 2.3: 会话管理与认证守卫

Status: done

## Story

作为已登录用户，
我想在关闭浏览器后重新打开应用仍保持登录状态，
以便不必每次都重新登录。

## Acceptance Criteria

1. **Given** 用户已完成登录，**When** 关闭浏览器后重新打开应用，**Then** 会话自动续期，用户无需重新登录，直接进入 `/app`

2. **Given** 未登录用户访问 `/app`，**When** 请求到达服务器，**Then** 自动重定向到 `/login`

3. **Given** 未登录用户访问 `/app/history`，**When** 请求到达服务器，**Then** 自动重定向到 `/login`

4. **Given** 未登录用户访问 `/app/settings`，**When** 请求到达服务器，**Then** 自动重定向到 `/login`

5. **Given** 已登录用户访问 `/login`，**When** 请求到达服务器，**Then** 自动重定向到 `/app`

6. **Given** `AuthGuard` 组件已实现，**When** 在 `/app` 布局中使用，**Then** 客户端会话过期时自动跳转到 `/login`

## Tasks / Subtasks

- [x] **实现 Next.js Middleware 路由守卫** (AC: #1, #2, #3, #4, #5)
  - [x] 创建 `src/proxy.ts`（Next.js 16 中 Middleware 改名为 Proxy，文件名为 proxy.ts）
  - [x] 使用 `@supabase/ssr` 的 `createServerClient` 在 Proxy 中检查会话（不可用 `env.ts`，直接读 `process.env`）
  - [x] 正确实现 cookie 透传：`request.cookies.getAll()` + `supabaseResponse.cookies.set()`（见 Dev Notes 标准模式）
  - [x] 调用 `supabase.auth.getUser()`（而非 `getSession()`）刷新并验证 session
  - [x] 未认证用户访问 `/app/*` 路径 → `NextResponse.redirect('/login')`
  - [x] 已认证用户访问 `/login` → `NextResponse.redirect('/app')`
  - [x] 配置 `matcher` 排除 `_next/static`、`_next/image`、`favicon.ico`、`api/` 路径
  - [x] 返回 `supabaseResponse`（含刷新后的 cookies）保证 session 续期

- [x] **创建 `/app` 路由骨架** (AC: #1, #2)
  - [x] 创建 `src/app/app/layout.tsx`（Server Component，导入 `AuthGuard`）
  - [x] 创建 `src/app/app/page.tsx`（改写工作区占位页，Epic 4a 填充）
  - [x] 在 layout 中引入 `AuthGuard` 组件

- [x] **实现 `AuthGuard` 组件** (AC: #6)
  - [x] 创建 `src/features/auth/auth-guard.tsx`（Client Component）
  - [x] 通过 `onAuthStateChange` 监听 session 过期事件
  - [x] session 过期时调用 `router.push('/login')`
  - [x] 正常状态直接渲染 `children`，不显示 loading（proxy 已保证服务端认证）
  - [x] 使用 `useRef` 防止 React Strict Mode 双重调用（见 Dev Notes）

- [x] **编写测试** (AC: all)
  - [x] `proxy.test.ts`（`@jest-environment node`，Next.js 16 命名）：
    - 未登录用户访问 `/app` → redirect `/login`（mock `getUser` 返回 null）
    - 未登录用户访问 `/app/history` → redirect `/login`
    - 未登录用户访问 `/app/settings` → redirect `/login`
    - 已登录用户访问 `/login` → redirect `/app`
    - 已登录用户访问 `/app` → 正常通过（status 200）
    - `config.matcher` 已定义且为数组
  - [x] `auth-guard.test.tsx`：
    - 正常状态渲染 children
    - 挂载后注册 onAuthStateChange 订阅
    - `SIGNED_OUT` 事件 → `router.push('/login')`
    - `TOKEN_REFRESHED` 事件 → 不跳转
    - 卸载时取消订阅

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全部为代码实现，无需外部配置 | 自动 |

### 关键技术约束：Middleware 不可使用 `env.ts`

`src/lib/env.ts` 包含 `import 'server-only'`，在 Middleware 中直接 import 会报错（Middleware 运行在 Edge Runtime 或 Node.js，但 `server-only` 限制更严格）。

**Middleware 中必须直接使用 `process.env`：**

```typescript
// ❌ 错误 - 不可用
import { env } from '@/lib/env'

// ✅ 正确
process.env.NEXT_PUBLIC_SUPABASE_URL!
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
```

### Supabase SSR Middleware 标准实现模式

必须严格遵循此模式，否则 session cookie 无法正确刷新：

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. 创建初始 response（必须先创建）
  let supabaseResponse = NextResponse.next({ request })

  // 2. 创建 Supabase 客户端（使用 process.env，不用 env.ts）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 先将 cookies 写入 request（为后续服务端代码可读）
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 重新创建 response 以携带更新的 request cookies
          supabaseResponse = NextResponse.next({ request })
          // 再将 cookies 写入 response（发送给浏览器）
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. 调用 getUser()（不要用 getSession()）
  // getUser() 会向 Supabase Auth 发出网络请求验证 token，同时刷新过期 token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // 4. 保护路由：未登录访问 /app/* 跳转到 /login
  if (path.startsWith('/app') && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 5. 已登录用户访问 /login 跳转到 /app
  if (path === '/login' && user) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  // 6. 必须返回 supabaseResponse（包含刷新后的 session cookies）
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 排除以下路径：
     * - _next/static (静态资源)
     * - _next/image (图片优化)
     * - favicon.ico
     * - api/ (API Routes 单独处理认证)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
```

### `AuthGuard` 客户端组件实现模式

```typescript
// src/features/auth/auth-guard.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  // useRef 防止 React Strict Mode 双重注册（来自 Story 2.2 经验）
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  useEffect(() => {
    // 防止 Strict Mode 双重订阅
    if (subscriptionRef.current) return

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          // TOKEN_REFRESHED: 继续，不跳转
          if (event === 'SIGNED_OUT') {
            router.push('/login')
          }
        }
      }
    )

    subscriptionRef.current = subscription

    return () => {
      subscription.unsubscribe()
      subscriptionRef.current = null
    }
  }, [router])

  // Middleware 已保证服务端认证，客户端直接渲染
  return <>{children}</>
}
```

### `/app` 布局结构

```typescript
// src/app/app/layout.tsx
import { AuthGuard } from '@/features/auth/auth-guard'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* 导航栏：Epic 4a/4b 填充 */}
        <main>{children}</main>
      </div>
    </AuthGuard>
  )
}
```

```typescript
// src/app/app/page.tsx
export default function AppPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">改写工作区（Epic 4a 实现）</p>
    </div>
  )
}
```

### 测试 Mock 方案

**Middleware 测试（Node.js 环境）：**

```typescript
// src/__tests__/middleware.test.ts
// @jest-environment node

import { middleware } from '@/middleware'
import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

const mockGetUser = jest.fn()

beforeEach(() => {
  ;(createServerClient as jest.Mock).mockReturnValue({
    auth: {
      getUser: mockGetUser,
    },
  })
})

function createRequest(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`))
}

test('未登录用户访问 /app 跳转到 /login', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } })
  const req = createRequest('/app')
  const res = await middleware(req)
  expect(res.status).toBe(307)
  expect(res.headers.get('location')).toContain('/login')
})

test('已登录用户访问 /login 跳转到 /app', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  const req = createRequest('/login')
  const res = await middleware(req)
  expect(res.status).toBe(307)
  expect(res.headers.get('location')).toContain('/app')
})
```

**AuthGuard 测试：**

```typescript
// src/features/auth/__tests__/auth-guard.test.tsx
import { render } from '@testing-library/react'
import { AuthGuard } from '../auth-guard'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let capturedCallback: ((event: string) => void) | null = null
const mockUnsubscribe = jest.fn()

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        capturedCallback = cb
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      },
    },
  }),
}))

test('正常渲染 children', () => {
  const { getByText } = render(
    <AuthGuard><span>测试内容</span></AuthGuard>
  )
  expect(getByText('测试内容')).toBeInTheDocument()
})

test('SIGNED_OUT 事件跳转到 /login', () => {
  render(<AuthGuard><span>content</span></AuthGuard>)
  capturedCallback?.('SIGNED_OUT')
  expect(mockPush).toHaveBeenCalledWith('/login')
})
```

### React Strict Mode 双重 useEffect 问题（来自 Story 2.2）

- **问题**：React 18/19 Strict Mode 会在开发环境中双重调用 `useEffect`，导致 `onAuthStateChange` 订阅两次
- **解决**：使用 `useRef` 标记是否已订阅，确保只订阅一次（见 `AuthGuard` 实现示例）
- **来源**：Story 2.2 Review Finding #12

### 已存在的 Supabase 客户端（禁止重新创建）

| 文件 | 用途 | 导入方式 |
|---|---|---|
| `src/lib/supabase/client.ts` | 浏览器端（Client Component） | `import { createClient } from '@/lib/supabase/client'` |
| `src/lib/supabase/server.ts` | 服务端（Server Component / API Route） | `import { createClient } from '@/lib/supabase/server'` |
| `src/lib/supabase/server-admin.ts` | 服务端 service_role（绕过 RLS） | `import { createServiceRoleClient } from '@/lib/supabase/server-admin'` |

Middleware 中**不能**使用上述任何文件，必须用 `createServerClient` 直接创建（见上方标准实现模式）。

### 目录结构（本 Story 完成后新增/修改文件）

```
src/
├── middleware.ts                       ← 新增（Next.js Middleware，路由守卫）
├── app/
│   └── app/
│       ├── layout.tsx                  ← 新增（/app 路由布局，引入 AuthGuard）
│       └── page.tsx                    ← 新增（改写工作区占位页）
└── features/
    └── auth/
        ├── auth-guard.tsx              ← 新增（Client 会话监听组件）
        └── __tests__/
            └── auth-guard.test.tsx     ← 新增（组件测试）
```

Middleware 测试文件推荐放在：
```
src/__tests__/middleware.test.ts        ← 新增（Node 环境测试）
```

### 与其他 Story 的依赖关系

| Story | 依赖说明 |
|---|---|
| Story 2.1 (已完成) | `/login` 页面和 `LoginForm` 已存在，本 Story Middleware 重定向目标依赖此页面 |
| Story 2.2 (已完成) | 微信登录建立的 session 格式与本 Story 使用的 session 检查方式兼容 |
| Story 2.4 (待实现) | `src/app/app/settings/page.tsx` 由 Story 2.4 创建，本 Story 的 Middleware 会保护此路径但不创建该页面 |
| Story 2.2 Task 9 (已推迟) | `/app/settings` 的"绑定手机号提示"依赖本 Story 的 `/app` 路由和 `AuthGuard` 存在 |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3] — Acceptance Criteria 原文
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — Supabase Auth 认证技术选型
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — `auth-guard.tsx` 位置、Middleware 位置
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural Boundaries] — "所有 API 通过 middleware 统一校验认证"
- [Source: _bmad-output/implementation-artifacts/2-2-wechat-oauth-login.md#Review Findings] — React Strict Mode useEffect 双重调用问题及解决方案（Finding #12）
- [Source: _bmad-output/implementation-artifacts/2-2-wechat-oauth-login.md#Completion Notes] — `wechat-session-content.tsx` 实现模式
- [Source: _bmad-output/implementation-artifacts/2-1-phone-sms-auth.md#Dev Notes] — Prisma 导入路径、`server-only` 约束
- [Source: node_modules/next/dist/docs/01-app/02-guides/authentication.md#Middleware] — Next.js Middleware 路由保护模式

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Next.js 16 关键变更：Middleware 已重命名为 Proxy，文件名必须为 `proxy.ts`（函数名 `proxy`），Story Dev Notes 中写的 `middleware.ts` 需调整为 `proxy.ts`。参考 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`。
- 测试文件名同步调整为 `proxy.test.ts`，import 路径为 `@/proxy`。

### Completion Notes List

- 所有 6 条 AC 均通过实现和测试验证
- Next.js 16 中 Middleware 已改名为 Proxy（`src/proxy.ts`），Story Dev Notes 中的 `middleware.ts` 建议在下一次 Story 创建时修正
- 48 个测试通过（7 个测试套件），0 回归
- `proxy.ts` 使用 `process.env` 直接读取 Supabase 配置（非 `env.ts`，因其含 `server-only`）
- `AuthGuard` 使用 `useRef` 防止 React Strict Mode 双重订阅（复用 Story 2.2 经验）

### File List

- `src/proxy.ts`（新增：Next.js 16 Proxy，路由守卫，保护 /app/* 路径）
- `src/app/app/layout.tsx`（新增：/app 路由布局，引入 AuthGuard）
- `src/app/app/page.tsx`（新增：改写工作区占位页）
- `src/features/auth/auth-guard.tsx`（新增：客户端会话监听组件）
- `src/__tests__/proxy.test.ts`（新增：Proxy 路由守卫测试，6 tests）
- `src/features/auth/__tests__/auth-guard.test.tsx`（新增：AuthGuard 组件测试，5 tests）

### Review Findings

- [x] [Review][Patch] getUser() 错误被静默丢弃——网络故障时所有已登录用户被踢回 /login [src/proxy.ts:47-51] ✓ fixed
- [x] [Review][Patch] process.env 非空断言无运行时校验——缺失环境变量导致晦涩崩溃 [src/proxy.ts:11-15] ✓ fixed
- [x] [Review][Patch] token 刷新与重定向并发时刷新后的 cookie 未写入 redirect response——session 续期失效 [src/proxy.ts:55-64] ✓ fixed
- [x] [Review][Patch] path.startsWith('/app') 可误匹配 /appstore 等路径——应改为 path === '/app' || path.startsWith('/app/') [src/proxy.ts:68] ✓ fixed
- [x] [Review][Patch] matcher 排除 'api' 应为 'api/'——缺少斜杠会把 /apitest 等路径排除在外 [src/proxy.ts:91] ✓ fixed
- [x] [Review][Patch] auth 重定向使用 HTTP 307（保留 POST 方法）——应改为 302 [src/proxy.ts:59] ✓ fixed
- [x] [Review][Patch] AuthGuard SIGNED_OUT 事件可重复触发多次 router.push('/login')——需加重定向防重 ref [src/features/auth/auth-guard.tsx:17,26-28] ✓ fixed
- [x] [Review][Defer] 登录重定向未保留原始目标 URL（无 ?next= 参数）[src/proxy.ts:44] — deferred, AC 未要求
- [x] [Review][Defer] /auth/wechat-session 已认证用户一跳重定向产生误导性错误提示 — deferred, Story 2.2 交互问题
- [x] [Review][Defer] matcher 未排除 /public 静态资源（png/svg 等），每次请求触发 getUser() 网络调用 [src/proxy.ts:57-68] — deferred, 性能优化
- [x] [Review][Defer] AppPage 缺少 metadata 导出 [src/app/app/page.tsx] — deferred, 占位页超出当前 AC 范围
- [x] [Review][Defer] useRouter mock 仅含 push，测试不完整 [auth-guard.test.tsx] — deferred, 不影响当前覆盖
- [x] [Review][Defer] jest.mock 与 import 顺序依赖 hoisting 行为 [proxy.test.ts] — deferred, 实际运行正常
- [x] [Review][Defer] /app 重定向目标可能形成多跳链（当 /app 本身再重定向时） [src/proxy.ts:49] — deferred, 当前路由树无此问题
- [x] [Review][Defer] /auth/* 路由未被 proxy 保护——OAuth 回调流程刻意不保护 — deferred, 设计意图
- [x] [Review][Defer] matcher 测试未验证具体排除模式内容 [proxy.test.ts] — deferred, 当前验证粒度满足 AC

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-26 | Story 2.3 创建：会话管理与认证守卫 | create-story |
| 2026-03-26 | Story 2.3 实现完成：proxy.ts、/app 路由骨架、AuthGuard 组件；11 个新增测试，48 个总测试全通过 | dev-agent |
