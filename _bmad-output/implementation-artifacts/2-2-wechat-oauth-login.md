# Story 2.2: 微信 OAuth 快捷登录

Status: done

## Story

作为用户，
我想通过微信扫码或授权完成一键登录，
以便不需要手动输入手机号和验证码。

## Acceptance Criteria

1. **Given** 用户在 `/login` 页面，**When** 页面加载，**Then** 显示"微信登录"按钮，样式与手机号登录区分明显

2. **Given** 用户点击"微信登录"按钮，**When** 点击触发，**Then** 浏览器跳转到微信 OAuth 授权页（`https://open.weixin.qq.com/connect/oauth2/authorize`），`redirect_uri` 为 `/api/auth/wechat/callback`

3. **Given** 用户在微信端完成授权，**When** 微信回调携带 `code` 参数，**Then** 后端用 `code` 换取 `openid`，在 `public.users` 中通过 `wechat_openid` 查找或创建用户，建立 Supabase Auth 会话，重定向到 `/app`

4. **Given** 已有 `wechat_openid` 的用户再次微信登录，**When** OAuth 回调触发，**Then** 直接匹配已有 `users` 记录，进入会话，不创建重复用户

5. **Given** 微信 OAuth 授权失败（用户取消或网络错误），**When** 回调携带 `error` 参数或无 `code`，**Then** 重定向到 `/login?error=wechat_failed`，页面展示"微信登录失败，请重试"提示

6. **Given** 首次微信登录成功后用户进入 `/app/settings`，**When** 页面加载，**Then** 显示"绑定手机号"提示横幅（可一键关闭，不强制）；MVP 阶段不实现微信账号与手机号账号的合并逻辑

## Tasks / Subtasks

- [ ] **前置：确认微信开放平台配置**（人工操作，开发前需完成）
  - [ ] 在微信开放平台注册网站应用，获取 `AppID` 和 `AppSecret`
  - [ ] 在应用设置中添加授权回调域名（生产域名 + `localhost:3000`）
  - [ ] 将 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 写入 `.env.local`，并更新 `.env.example`

- [x] **更新 `env.ts` 添加微信 OAuth 环境变量** (AC: #2, #3)
  - [x] 在 `src/lib/env.ts` 的 `envSchema` 中新增：
    - `WECHAT_APP_ID: z.string().min(1)`
    - `WECHAT_APP_SECRET: z.string().min(1)`
  - [x] 将两个变量添加到 `.env.example` 的说明模板

- [x] **实现 `/api/auth/wechat/login` 路由** (AC: #2)
  - [x] 创建 `src/app/api/auth/wechat/login/route.ts`（GET handler）
  - [x] 构建微信 OAuth 授权 URL（见 Dev Notes 代码示例）
  - [x] 生成随机 `state` 参数存入 Cookie（防 CSRF），Cookie 名 `wechat_oauth_state`，`httpOnly: true, sameSite: 'lax', maxAge: 300`
  - [x] 返回 `Response.redirect(wechatAuthUrl)`

- [x] **实现 `/api/auth/wechat/callback` 路由** (AC: #3, #4, #5)
  - [x] 创建 `src/app/api/auth/wechat/callback/route.ts`（GET handler）
  - [x] 读取 Cookie 中的 `state`，校验与 query param `state` 是否一致，不一致返回 `/login?error=wechat_failed`
  - [x] 用 `code` 调用微信 API 换取 `access_token` + `openid`（见 Dev Notes）
  - [x] 用 `wechat_openid` 在 `public.users` 中查找已有用户（通过 `createServiceRoleClient`）
  - [x] 若不存在：用 `adminClient.auth.admin.createUser()` 在 `auth.users` 创建用户，再向 `public.users` upsert（写入 `wechat_openid`，`display_name` 默认 `"微信用户"`）
  - [x] 若已存在：直接复用 `users.id`
  - [x] 用 `adminClient.auth.admin.generateLink({ type: 'magiclink', email })` 获取 `hashed_token`（见 Dev Notes 会话建立方案）
  - [x] 重定向到 `/auth/wechat-session?token=<hashed_token>&email=<email>`，由前端客户端完成会话建立
  - [x] 微信 API 请求失败时重定向到 `/login?error=wechat_failed`
  - [x] 清除 `wechat_oauth_state` Cookie

- [x] **实现 `/auth/wechat-session` 页面** (AC: #3)
  - [x] 创建 `src/app/auth/wechat-session/page.tsx`（Server Component + Suspense）
  - [x] 创建 `src/app/auth/wechat-session/wechat-session-content.tsx`（Client Component）
  - [x] 读取 URL query 中的 `token` 和 `email`
  - [x] 调用 `supabase.auth.verifyOtp({ email, token, type: 'magiclink' })` 建立会话
  - [x] 成功后 `router.push('/app')`
  - [x] 失败则 `router.push('/login?error=wechat_failed')`
  - [x] 页面显示"正在登录..."加载状态，避免白屏

- [x] **实现 `WechatLoginButton` 组件** (AC: #1, #2)
  - [x] 创建 `src/features/auth/wechat-login-button.tsx`（Client Component）
  - [x] 点击后调用 `onNavigate('/api/auth/wechat/login')`（默认 `window.location.assign`，整页跳转）
  - [x] 显示微信绿色图标 + "微信登录"文字
  - [x] 按钮 loading 状态：点击后禁用，显示跳转中...

- [x] **更新 `LoginForm` 启用微信登录** (AC: #1)
  - [x] 修改 `src/features/auth/login-form.tsx`，引入 `WechatLoginButton`
  - [x] 在手机号登录区域与微信登录之间添加分隔线（"或"）

- [x] **在 `/login` 处理 `error` query 参数** (AC: #5)
  - [x] 修改 `src/app/login/page.tsx`，读取 `searchParams.error`
  - [x] 若 `error === 'wechat_failed'`，将 `errorMessage` prop 传入 `LoginForm`
  - [x] `LoginForm` 展示红色错误提示"微信登录失败，请重试"

- [ ] **在 `/app/settings` 添加绑定手机号提示** (AC: #6)
  - [ ] 该任务依赖 Story 2.4（设置页）实现；本 Story 仅在 Dev Notes 中记录需求，不创建设置页
  - [ ] 若 Story 2.4 先行，设置页加载时检查 `users.phone IS NULL AND users.wechat_openid IS NOT NULL`
  - [ ] 满足条件时展示可关闭横幅："建议绑定手机号，以便在无微信时也能登录"（按钮：绑定 / 跳过）
  - [ ] 跳过后将状态存入 `localStorage`，本会话不再提示

- [x] **编写测试** (AC: all)
  - [x] `wechat-login-button.test.tsx`：点击触发跳转（注入 `onNavigate` mock），loading 状态（4 tests）
  - [x] `wechat/callback/route.test.ts`（11 tests，`@jest-environment node`）：
    - state 校验失败 → redirect `/login?error=wechat_failed`
    - 微信 API 返回错误 → redirect `/login?error=wechat_failed`
    - 新用户：调用 `createUser` + upsert，重定向到 session 页
    - 已有用户：跳过 `createUser`，直接生成 magiclink
  - [x] `auth/wechat-session/wechat-session-content.test.tsx`：verifyOtp 成功跳转 `/app`，失败跳转 `/login`（6 tests）

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 操作说明 | 状态 |
|---|---|---|
| 微信开放平台 | 登录 `open.weixin.qq.com`，注册网站应用，获取 AppID + AppSecret | 待确认 |
| 回调域名配置 | 在微信开放平台"网站应用 → 开发配置"中填入授权回调域名 | 待确认 |
| 环境变量 | `.env.local` 添加 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` | 待确认 |

### 微信 OAuth 授权 URL 构建

```typescript
// src/app/api/auth/wechat/login/route.ts
import { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString('hex')

  const cookieStore = await cookies()
  cookieStore.set('wechat_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 300,
    path: '/',
  })

  const redirectUri = encodeURIComponent(
    `${env.NEXT_PUBLIC_APP_URL}/api/auth/wechat/callback`
  )

  const wechatAuthUrl =
    `https://open.weixin.qq.com/connect/oauth2/authorize` +
    `?appid=${env.WECHAT_APP_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=snsapi_userinfo` +
    `&state=${state}` +
    `#wechat_redirect`

  return Response.redirect(wechatAuthUrl)
}
```

### 微信 Code 换取 openid

```typescript
// callback 路由中的 code 换 token 逻辑
const tokenRes = await fetch(
  `https://api.weixin.qq.com/sns/oauth2/access_token` +
  `?appid=${env.WECHAT_APP_ID}` +
  `&secret=${env.WECHAT_APP_SECRET}` +
  `&code=${code}` +
  `&grant_type=authorization_code`
)
const tokenData = await tokenRes.json()

if (tokenData.errcode) {
  // 换取失败，重定向到错误页
  return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=wechat_failed`)
}

const { openid } = tokenData
```

### 用户创建与 Supabase Auth 会话建立

```typescript
// callback 路由：新用户流程
const adminClient = createServiceRoleClient()

// 1. 查找已有用户
const { data: existingUser } = await adminClient
  .from('users')
  .select('id, email_for_auth')
  .eq('wechat_openid', openid)
  .single()

let userId: string
let authEmail: string

if (existingUser) {
  // 已有用户：复用 id
  userId = existingUser.id
  authEmail = `wechat_${openid}@wechat.internal`
} else {
  // 新用户：在 auth.users 中创建
  authEmail = `wechat_${openid}@wechat.internal`
  const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
    email: authEmail,
    email_confirm: true,
  })
  if (createError || !newAuthUser.user) {
    return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=wechat_failed`)
  }
  userId = newAuthUser.user.id

  // 2. 同步到 public.users
  await adminClient.from('users').upsert({
    id: userId,
    wechat_openid: openid,
    display_name: '微信用户',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
}

// 3. 生成 magiclink token 用于前端建立会话
const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
  type: 'magiclink',
  email: authEmail,
})
if (linkError || !linkData) {
  return Response.redirect(`${env.NEXT_PUBLIC_APP_URL}/login?error=wechat_failed`)
}

// 4. 提取 token（email_otp 字段是一次性 OTP token）
const token = linkData.properties.email_otp
return Response.redirect(
  `${env.NEXT_PUBLIC_APP_URL}/auth/wechat-session?token=${token}&email=${encodeURIComponent(authEmail)}`
)
```

### `/auth/wechat-session` 前端会话建立

```typescript
// src/app/auth/wechat-session/page.tsx
'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function WechatSessionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const email = searchParams.get('email')
    if (!token || !email) {
      router.push('/login?error=wechat_failed')
      return
    }
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.verifyOtp({ email, token, type: 'magiclink' }).then(({ error }) => {
      if (error) {
        router.push('/login?error=wechat_failed')
      } else {
        router.push('/app')
      }
    })
  }, [])

  return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">正在登录...</p></div>
}
```

### `env.ts` 新增字段

```typescript
// 在 envSchema 中新增（服务端）
WECHAT_APP_ID: z.string().min(1),
WECHAT_APP_SECRET: z.string().min(1),
```

### 目录结构（本 Story 完成后新增/修改文件）

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx                      ← 修改（处理 error query）
│   ├── auth/
│   │   └── wechat-session/
│   │       └── page.tsx                  ← 新增（Client，建立会话后跳转）
│   └── api/
│       └── auth/
│           └── wechat/
│               ├── login/
│               │   └── route.ts          ← 新增（生成授权 URL）
│               └── callback/
│                   └── route.ts          ← 新增（处理回调，创建用户，生成 token）
├── features/
│   └── auth/
│       ├── login-form.tsx                ← 修改（启用 WechatLoginButton）
│       └── wechat-login-button.tsx       ← 新增（微信登录按钮）
└── lib/
    └── env.ts                            ← 修改（新增 WECHAT_APP_ID/SECRET）
```

### Prisma 导入路径（与 Story 2.1 保持一致）

```typescript
// 正确（Prisma 7.x 自定义输出路径）
import { PrismaClient } from '@/generated/prisma/client'
// 本 Story 不直接使用 Prisma，通过 Supabase admin client 操作数据库
```

### 复用模式（来自 Story 2.1）

- `createServiceRoleClient()` 导入自 `@/lib/supabase/server-admin`，不要在 callback 路由中重新创建
- API 错误响应格式：`{ data: null, error: { code: 'WECHAT_OAUTH_FAILED', message: '...' } }`
- `server-admin.ts` 已有 `import 'server-only'`，callback 路由无需重复

### 测试 Mock 方案

```typescript
// 测试中 mock 全局 fetch（模拟微信 API 返回）
global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ access_token: 'mock_token', openid: 'mock_openid_123' }),
})

// mock cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn((name) => name === 'wechat_oauth_state' ? { value: 'test_state' } : undefined),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}))
```

### 安全注意事项

- `state` 参数必须校验，防止 CSRF 攻击
- `WECHAT_APP_SECRET` 仅在服务端使用，不暴露给前端（通过 `env.ts` 保证，`WECHAT_APP_SECRET` 无 `NEXT_PUBLIC_` 前缀）
- `wechat_openid` 在 `public.users` 表有 `UNIQUE` 约束，upsert 时不会产生重复记录
- `/auth/wechat-session` 页面不应被搜索引擎索引（加 `noindex` meta）
- `authEmail`（`wechat_{openid}@wechat.internal`）是系统内部标识符，不向用户展示，settings 页只展示微信登录方式标识

### 微信登录与手机号账号隔离（MVP 约束）

- 微信登录用户的 `auth.users.email` 为 `wechat_{openid}@wechat.internal`（内部标识，非真实邮箱）
- `public.users.phone` 保持 NULL，`wechat_openid` 有值
- MVP 阶段不实现微信账号与手机号账号合并
- 设置页提示"绑定手机号"仅为引导，用户可跳过

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- jest.config.ts 新增 `setupFiles: ['jest.env-setup.js']` + `moduleNameMapper` 覆盖 `react-dom/test-utils`，解决 React 19 生产包中 `React.act` 不可用问题
- jsdom 26 中 `window.location.assign` 为 non-configurable/non-writable，无法通过 `jest.spyOn` mock；改用 `onNavigate` prop 注入 + 默认值模式解决可测试性问题

### Completion Notes List

- Task 9（`/app/settings` 绑定手机号提示）依赖 Story 2.4，已推迟
- Task 1（微信开放平台注册）为人工操作，需在部署前手动完成
- `WechatLoginButton` 新增可选 `onNavigate?: (url: string) => void` prop（默认 `window.location.assign`），生产行为不变，测试可注入 mock

### File List

- `src/lib/env.ts`（修改：新增 WECHAT_APP_ID / WECHAT_APP_SECRET）
- `.env.example`（修改：新增微信 OAuth 说明）
- `src/app/api/auth/wechat/login/route.ts`（新增）
- `src/app/api/auth/wechat/callback/route.ts`（新增）
- `src/app/api/auth/wechat/exchange/route.ts`（新增，code review patch P0/P1）
- `src/app/api/auth/wechat/callback/__tests__/route.test.ts`（新增，11 tests）
- `src/app/auth/wechat-session/page.tsx`（新增）
- `src/app/auth/wechat-session/wechat-session-content.tsx`（新增）
- `src/app/auth/wechat-session/__tests__/wechat-session-content.test.tsx`（新增，6 tests）
- `src/features/auth/wechat-login-button.tsx`（新增）
- `src/features/auth/__tests__/wechat-login-button.test.tsx`（新增，4 tests）
- `src/features/auth/login-form.tsx`（修改：引入 WechatLoginButton + errorMessage prop）
- `src/app/login/page.tsx`（修改：处理 error query param）
- `jest.config.ts`（修改：setupFiles + react-dom/test-utils mapper）
- `jest.env-setup.js`（新增：确保 NODE_ENV=test）

### Review Findings

- [x] [Review][Patch] Token 传输方式改用 Cookie 中转：callback 将 token 存入 httpOnly Cookie（`wechat_pending_token`，maxAge=60s），`/auth/wechat-session` 从 Cookie 读取而非 URL 参数，URL 不再暴露敏感 token [callback/route.ts:94-96, wechat-session-content.tsx] — 已决策：方案 A

- [x] [Review][Patch] `verifyOtp` 类型与字段不匹配：`generateLink` 返回的是 `email_otp` 字段，应配合 `type: 'email'` 使用，而非 `type: 'magiclink'`，否则会话建立将失败 [callback/route.ts:93, wechat-session-content.tsx:21]
- [x] [Review][Patch] State cookie 缺少 `secure: true` 标志，在非 HTTPS 环境下可被拦截 [login/route.ts:11]
- [x] [Review][Patch] `data.properties.email_otp` 在使用前未检查 `data.properties` 是否存在，可能传入 `undefined` token [callback/route.ts:93]
- [x] [Review][Patch] `auth.users` 创建成功后 `public.users` upsert 失败会产生孤儿 auth 用户，下次登录时 `createUser` 重复 email 导致永久锁定 [callback/route.ts:68-80]
- [x] [Review][Patch] 未检查 WeChat 回调中的 `error` query 参数（用户取消时微信直接返回 `error=access_denied`，没有 `code`）[callback/route.ts]
- [x] [Review][Patch] `tokenRes.ok` 未检查即直接调用 `.json()`，非 2xx 响应可能返回 HTML 导致解析失败 [callback/route.ts:37]
- [x] [Review][Patch] WeChat API fetch 无超时限制（无 AbortController/signal），挂起请求会耗尽 serverless 并发 [callback/route.ts:30]
- [x] [Review][Patch] 并发新用户注册竞态：两个请求同时通过 `existingUser = null` 检查，第二个 `createUser` 因 email 重复失败，用户被重定向到错误页 [callback/route.ts:56]
- [x] [Review][Patch] `NEXT_PUBLIC_APP_URL` 末尾有斜杠时，拼接路径产生双斜杠（`//login?error=...`），浏览器解析为协议相对 URL [callback/route.ts, login/route.ts 所有 redirect 调用]
- [x] [Review][Patch] `WECHAT_APP_ID` 拼入授权 URL 前未经 URI 编码，异常值会产生格式错误的 URL [login/route.ts:24]
- [x] [Review][Patch] `useEffect` 在 React Strict Mode 双重调用时执行两次 `verifyOtp`，第二次因 OTP 已消费而失败，误重定向到错误页 [wechat-session-content.tsx:11]
- [x] [Review][Patch] SVG 同时设置 `aria-hidden="true"` 和 `aria-label="微信"`，`aria-hidden` 使 `aria-label` 完全失效 [wechat-login-button.tsx:38]
- [x] [Review][Patch] `redirecting` 状态在导航失败后永远不会重置，按钮将永久禁用 [wechat-login-button.tsx:14]

- [x] [Review][Defer] 微信 email 命名空间碰撞风险（接入第二个微信应用时 `wechat_{openid}@wechat.internal` 可能重复）— deferred，MVP 阶段单应用不涉及
- [x] [Review][Defer] `/api/auth/wechat/login` 缺乏速率限制 — deferred，跨切面关注点，需独立故事处理
- [x] [Review][Defer] AC6 `/app/settings` 绑定手机号提示横幅 — deferred，已在 Dev Notes 中注明依赖 Story 2.4
- [x] [Review][Defer] 所有错误路径均重定向到通用 `wechat_failed`，缺乏服务端结构化日志 — deferred，运维监控范畴
- [x] [Review][Defer] 已有用户 `auth.users` 被外部删除后 `generateLink` 失败场景 — deferred，已有 wechat_openid 的孤儿 public.users 记录处理
- [x] [Review][Defer] WeChat API secret 通过 GET 请求 query 参数传递给微信服务器 — deferred，微信官方接口规范要求，无替代方案
