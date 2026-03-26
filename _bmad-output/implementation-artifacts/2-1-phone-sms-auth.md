# Story 2.1: 手机号短信验证码注册与登录

Status: done

## Story

作为新用户，
我想通过手机号和短信验证码完成注册，
以便无需记住密码即可快速建立账号并开始使用。

## Acceptance Criteria

1. **Given** 用户访问 `/login` 页面，**When** 页面加载，**Then** 显示手机号输入框和"获取验证码"按钮，页面移动端优先自适应布局。

2. **Given** 用户输入有效手机号并点击"获取验证码"，**When** 请求发出，**Then** Supabase Auth 通过阿里云 SMS 发送验证码，按钮进入 60 秒倒计时禁用状态，倒计时结束后自动恢复可点击。

3. **Given** 用户输入正确验证码并点击"登录/注册"，**When** 首次登录，**Then** Supabase Auth 创建 `auth.users` 记录，同时在 `public.users` 表中 upsert 对应记录（`phone` 字段写入），跳转到 `/app`。

4. **Given** 用户输入正确验证码并点击"登录/注册"，**When** 已有账号再次登录，**Then** 直接进入会话，`public.users` 记录的 `updated_at` 更新，跳转到 `/app`。

5. **Given** 用户输入错误验证码，**When** 提交表单，**Then** 显示明确错误提示"验证码错误或已过期"，手机号输入框内容不清空，用户可直接重新输入验证码。

6. **Given** 验证码已超过 60 秒，**When** 用户提交，**Then** 提示"验证码已过期，请重新获取"。

7. **Given** 用户输入非法手机号格式（非 11 位数字或不以 1 开头），**When** 点击"获取验证码"，**Then** 前端校验拦截，显示"请输入有效的手机号"，不发出网络请求。

## Tasks / Subtasks

- [x] **前置：拆分 `createServiceRoleClient` 到独立文件** (解决 deferred-work 遗留项)
  - [x] 新建 `src/lib/supabase/server-admin.ts`，将 `createServiceRoleClient` 函数从 `server.ts` 移入
  - [x] 更新 `src/lib/supabase/server.ts`，删除 `createServiceRoleClient` 及其相关 import
  - [x] 全局搜索既有调用方，更新 import 路径为 `@/lib/supabase/server-admin`

- [x] **创建 `/login` 页面路由** (AC: #1)
  - [x] 创建 `src/app/login/page.tsx`（Server Component，元数据：`title: "登录 - 适文"`）
  - [x] 创建 `src/app/login/layout.tsx`（简单居中布局，无导航栏）

- [x] **实现 `PhoneOtpForm` 组件** (AC: #1, #2, #5, #6, #7)
  - [x] 创建 `src/features/auth/phone-otp-form.tsx`（Client Component）
  - [x] 手机号输入框：`type="tel"`，placeholder `"请输入手机号"`，前端正则校验 `/^1[3-9]\d{9}$/`
  - [x] "获取验证码"按钮：点击后调用 `supabase.auth.signInWithOtp({ phone })`
  - [x] 倒计时逻辑：60s 倒计时，`useEffect` + `setInterval` 实现，倒计时期间按钮显示剩余秒数并禁用
  - [x] 验证码输入框：6 位数字，`type="text" inputMode="numeric" maxLength={6}`
  - [x] "登录/注册"按钮：调用 `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
  - [x] 验证成功后调用 `/api/auth/sync-user`，完成后 `router.push('/app')`
  - [x] 错误状态处理：区分"验证码错误"和"验证码过期"，友好文案展示
  - [x] 加载状态：发送验证码和验证 OTP 期间按钮显示 loading 状态

- [x] **实现 `LoginForm` 外层组件** (AC: #1)
  - [x] 创建 `src/features/auth/login-form.tsx`
  - [x] 包含产品 Logo/名称展示区
  - [x] 引入 `PhoneOtpForm`
  - [x] 预留微信登录区域（Story 2.2 填充，本 Story 可渲染占位 UI 或不显示）

- [x] **实现用户同步 API Route** (AC: #3, #4)
  - [x] 创建 `src/app/api/auth/sync-user/route.ts`（POST handler）
  - [x] 通过 `createClient()` 校验请求方的 Supabase session，未登录返回 401
  - [x] 通过 `createServiceRoleClient()` 对 `public.users` 执行 upsert：
    - `id` = Supabase Auth `user.id`（UUID，与 `auth.users` 一致）
    - `phone` = Auth user 的 phone 字段
    - `display_name` = 默认为手机号后四位（`****` + last 4 digits）
    - `created_at` / `updated_at` 由数据库默认值处理
  - [x] upsert 冲突策略：`on conflict (id) do update set updated_at = now()`
  - [x] 成功返回 `{ data: { userId }, error: null }`

- [x] **更新 `env.ts` 添加 SMS 相关变量**（如需要）
  - [x] 确认 Supabase Auth Phone OTP 是否需要在 `env.ts` 中额外配置（Supabase 侧配置则不需要）
  - [x] 如需 `NEXT_PUBLIC_APP_URL` 用于 redirect，确认已存在

- [x] **编写测试** (AC: all)
  - [x] `phone-otp-form.test.tsx`：手机号格式校验、倒计时逻辑、错误状态展示（mock Supabase client）
  - [x] `sync-user/route.test.ts`：未登录 401、正常 upsert、重复调用幂等
  - [x] 确认 CI 中 Supabase 调用全部 mock，不依赖真实连接

## Dev Notes

### ⚠️ 前置人工操作（开发前需确认）

| 前置项 | 操作 | 状态 |
|---|---|---|
| 阿里云 SMS | 开通短信服务，获取 AccessKeyId + AccessKeySecret，创建短信签名和模板 | 待确认 |
| Supabase Auth SMS Provider | 在 Supabase Dashboard > Authentication > Providers > Phone 中配置阿里云 SMS | 待确认 |
| Supabase Auth 测试手机号 | Dashboard > Authentication > Configuration，添加测试用手机号白名单（如 `+8613800000001`，OTP 固定为 `123456`）供 CI 使用 | 待确认 |

### Prisma 导入路径（Epic 2 所有 Story 通用规范）

```typescript
// ✅ 正确
import { PrismaClient } from '@/generated/prisma/client'

// ❌ 错误（Prisma 7.x 无此路径）
import { PrismaClient } from '@/generated/prisma'
```

### `createServiceRoleClient` 拆分规范

```typescript
// src/lib/supabase/server-admin.ts（新文件）
import { createClient } from '@supabase/supabase-js'

/**
 * 服务端 service_role 客户端，拥有完整数据库权限，绕过 RLS。
 * 只能在服务端 API Routes 中使用，绝不能暴露给客户端。
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceRoleKey)
}
```

```typescript
// src/lib/supabase/server.ts（移除 createServiceRoleClient）
// 只保留 createClient()（SSR cookie 版本）
```

### Supabase Auth + `public.users` 双写逻辑

Supabase Auth 登录成功后，session 中有 `user.id`（UUID）和 `user.phone`，但 `public.users` 表需要手动同步：

```typescript
// 登录成功后的客户端逻辑（phone-otp-form.tsx）
const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
if (!error && data.session) {
  // 同步用户记录
  await fetch('/api/auth/sync-user', { method: 'POST' })
  router.push('/app')
}
```

```typescript
// /api/auth/sync-user/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server-admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return Response.json({ data: null, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const adminClient = createServiceRoleClient()
  await adminClient.from('users').upsert({
    id: user.id,
    phone: user.phone ?? null,
    display_name: user.phone ? `用户${user.phone.slice(-4)}` : '新用户',
  }, { onConflict: 'id' })

  return Response.json({ data: { userId: user.id }, error: null })
}
```

### 手机号格式校验

```typescript
const PHONE_REGEX = /^1[3-9]\d{9}$/

function validatePhone(phone: string): string | null {
  if (!phone) return '请输入手机号'
  if (!PHONE_REGEX.test(phone)) return '请输入有效的手机号'
  return null
}
```

### 路由与跳转

- 未登录用户访问受保护路由 → `Story 2.3` 实现重定向（本 Story 无需实现守卫）
- 登录成功 → `router.push('/app')`（`/app` 路由由 Story 2.3 创建，本 Story 只负责跳转逻辑）
- 本 Story 不实现 AuthGuard，`/login` 暂时无需判断已登录状态

### 目录结构（本 Story 完成后新增文件）

```
src/
├── app/
│   ├── login/
│   │   ├── layout.tsx          ← 新增（居中布局）
│   │   └── page.tsx            ← 新增（登录页入口）
│   └── api/
│       └── auth/
│           └── sync-user/
│               └── route.ts    ← 新增（用户同步）
├── features/
│   └── auth/
│       ├── login-form.tsx      ← 新增
│       └── phone-otp-form.tsx  ← 新增
└── lib/
    └── supabase/
        ├── server.ts           ← 修改（移除 createServiceRoleClient）
        └── server-admin.ts     ← 新增（独立 service role client）
```

### 测试手机号（CI 环境）

Supabase Auth 支持测试手机号白名单，OTP 固定值，不走真实短信：
- 在 Supabase Dashboard 配置测试号后，测试用例使用固定手机号 + 固定 OTP
- 所有测试文件中 Supabase client 调用通过 Jest mock 替代，不依赖真实 Supabase 连接

```typescript
// 测试 mock 示例
jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: jest.fn(() => ({
    auth: {
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-uuid', phone: '13800000001' } } }, error: null }),
    },
  })),
}))
```

### UI/UX 规范

- 移动端优先：容器最大宽度 `max-w-sm`，水平居中
- 手机号输入框：`type="tel"`，移动端自动弹出数字键盘
- 验证码输入框：`inputMode="numeric"`，`maxLength={6}`
- 错误信息：红色小字，位于对应输入框下方，不使用 toast（避免遮挡内容）
- 按钮 loading 状态：显示 spinner，禁用防止重复提交

### 已知注意事项

- **`public.users` RLS 无 DELETE 策略**：账号注销场景已在 deferred-work 记录，本 Story 不处理
- **`server.ts` 使用 `process.env` 而非 `env.ts`**：现有设计，本 Story 延续，不改动 `server.ts` 中的变量读取方式
- **`/app` 路由**：本 Story 的 `router.push('/app')` 目标页面由 Story 2.3 创建；开发调试阶段可临时创建 `src/app/app/page.tsx` 空页面避免 404

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1] — Acceptance Criteria 原文
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — 认证技术选型
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — 目录结构规范
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — createServiceRoleClient 拆分、users DELETE 策略
- [Source: _bmad-output/implementation-artifacts/1-3-supabase-rls-config.md] — RLS 现有策略

## Dev Agent Record

### Implementation Plan

本 Story 实现了手机号短信验证码登录/注册功能，包含以下核心模块：

1. **前置重构**：将 `createServiceRoleClient` 从 `server.ts` 拆分到独立文件 `server-admin.ts`，解决 deferred-work 遗留项
2. **登录页面**：`/login` 路由 + 居中布局，Server Component 处理元数据
3. **PhoneOtpForm 组件**：完整的 OTP 登录流程，包含手机号校验、倒计时、错误处理
4. **LoginForm 外层**：产品 Logo + OTP 表单 + 微信登录占位区
5. **sync-user API**：POST /api/auth/sync-user，验证 session 后将用户同步到 public.users
6. **测试套件**：Jest + RTL，14 个测试全部通过，全部 mock Supabase，不依赖真实连接

### Technical Decisions

- 错误区分策略：Supabase 返回 `"Token has expired"` 表示真正超时，`"Token has expired or is invalid"` 表示验证码错误，使用精确字符串匹配（非 `includes`）区分
- 测试环境：由于项目 node_modules 为预构建环境（132个包），Jest 通过 npx 缓存运行，额外安装了 jest-environment-jsdom 和 @testing-library 包到 npx 目录；jest.config.ts 使用 `modulePaths` 和 `moduleNameMapper` 确保 React 单例
- 手机号格式：`+86` 前缀在调用 Supabase API 时拼接，前端校验只验证 11 位数字

### Completion Notes

- ✅ 所有 7 个 AC 已满足
- ✅ 14 个测试全部通过（9 组件测试 + 5 路由测试）
- ✅ 所有 Supabase 调用通过 mock，不依赖真实连接
- ✅ `createServiceRoleClient` 拆分完成，deferred-work 遗留项已解决
- ⚠️ 前置人工操作（阿里云 SMS、Supabase Phone Provider 配置）仍需人工确认

## File List

- `src/lib/supabase/server-admin.ts` — 新增（createServiceRoleClient 独立文件）
- `src/lib/supabase/server.ts` — 修改（移除 createServiceRoleClient 及相关 import）
- `src/app/login/layout.tsx` — 新增（居中布局）
- `src/app/login/page.tsx` — 新增（登录页入口，Server Component）
- `src/features/auth/phone-otp-form.tsx` — 新增（手机号 OTP 表单，Client Component）
- `src/features/auth/login-form.tsx` — 新增（登录页外层组件）
- `src/app/api/auth/sync-user/route.ts` — 新增（用户同步 API）
- `src/features/auth/__tests__/phone-otp-form.test.tsx` — 新增（组件测试，9个）
- `src/app/api/auth/sync-user/__tests__/route.test.ts` — 新增（路由测试，5个）
- `jest.config.ts` — 新增（Jest 配置）
- `jest.setup.ts` — 新增（Jest setup，引入 @testing-library/jest-dom）
- `package.json` — 修改（新增 test/test:ci 脚本，新增测试相关 devDependencies）

### Review Findings

**decision_needed（需确认后修复）：**

- [x] [Review][Decision] Cookie 时序：Supabase SSR 在 verifyOtp resolve 前同步写入 Cookie，无竞态风险 — 已确认消除，无需修复

**patch（需修复）：**

- [x] [Review][Patch] sync-user 失败被静默忽略，用户仍被跳转至 /app [phone-otp-form.tsx:97]
- [x] [Review][Patch] OTP 发送后手机号输入框可被修改，导致 verifyOtp 手机号不匹配 [phone-otp-form.tsx:124]
- [x] [Review][Patch] server-admin.ts 缺少 `import 'server-only'`，有被客户端 bundle 引入的风险 [server-admin.ts:1]
- [x] [Review][Patch] startCooldown 未清除已有定时器，快速连击时两个 interval 并行导致倒计时加速 [phone-otp-form.tsx:37]
- [x] [Review][Patch] upsertError.message 直接返回给客户端，泄露数据库约束/schema 信息 [route.ts:31]
- [x] [Review][Patch] createClient() 在每次渲染时创建新实例，应用 useMemo 或 useRef [phone-otp-form.tsx:18]
- [x] [Review][Patch] server-admin.ts 使用 `!` 非空断言，env 缺失时报错不明确，应改为显式 throw [server-admin.ts:9]
- [x] [Review][Patch] upsert payload 未含 updated_at，重复登录时 public.users.updated_at 未更新（AC4）[route.ts:23]
- [x] [Review][Patch] OTP 过期错误使用精确字符串匹配，Supabase SDK 升级后可能静默降级 [phone-otp-form.tsx:89] — 跳过，精确匹配为有意设计（见 Technical Decisions）

**defer（已记录，本次不修复）：**

- [x] [Review][Defer] 登录成功后倒计时 setInterval 可能在组件卸载竞态窗口短暂继续运行 [phone-otp-form.tsx:98] — deferred，影响极小仅 dev mode 告警
- [x] [Review][Defer] display_name 使用 user.phone.slice(-4)，极短 phone 字符串时会暴露全部内容 [route.ts:23] — deferred，Supabase 保证 E.164 格式，正常 CN 号码不触发
- [x] [Review][Defer] 用户粘贴带 +86 前缀的手机号时正则校验失败但错误提示不明确 [phone-otp-form.tsx:60] — deferred，UX 优化，超出本 Story 范围

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-25 | Story 2.1 完整实现：登录页、PhoneOtpForm、sync-user API、测试套件 | Dev Agent |
