# Story 2.4: 个人设置页

Status: done

## Story

作为已登录用户，
我想在个人设置页查看和修改我的基本信息，
以便保持账号信息的准确性。

## Acceptance Criteria

1. **Given** 用户访问 `/app/settings`，**When** 页面加载完成，**Then** 显示当前用户的 `display_name`、绑定手机号（脱敏展示，格式：`138****1234`）、注册时间

2. **Given** 用户在设置页修改 `display_name`，**When** 点击保存按钮，**Then** 保存成功，页面即时显示新名称，并显示成功提示

3. **Given** 用户在设置页修改 `display_name`，**When** 服务端返回错误，**Then** 显示错误提示，表单数据不丢失

4. **Given** 用户未绑定手机号（仅微信登录），**When** 页面加载完成，**Then** 手机号字段显示"未绑定"

## Tasks / Subtasks

- [x] **创建 API 路由 `PATCH /api/user/profile`** (AC: #2, #3)
  - [x] 新建 `src/app/api/user/profile/route.ts`
  - [x] 用 `createClient()` from `@/lib/supabase/server` 做身份校验，未登录返回 401
  - [x] 用 zod schema 校验请求体：`{ displayName: string }`（非空字符串，最大 50 字符）
  - [x] 用 `prisma.user.update()` 更新 `displayName` 字段（where: `{ id: user.id }`）
  - [x] 成功返回 `{ data: { userId: user.id }, error: null }`，失败返回 `{ data: null, error: { code, message } }`
  - [x] 编写测试：`src/app/api/user/profile/__tests__/route.test.ts`（未登录 401、参数校验失败 400、成功更新 200）

- [x] **创建设置页面 Server Component** (AC: #1, #4)
  - [x] 新建 `src/app/app/settings/page.tsx`（Server Component）
  - [x] 用 `createClient()` from `@/lib/supabase/server` 获取当前用户 `user.id`（proxy.ts 已保证已登录，`getUser()` 不应返回 null）
  - [x] 用 `prisma.user.findUnique({ where: { id: user.id } })` 查询用户记录
  - [x] 对 phone 字段脱敏：`138****1234`（保留前 3 位、后 4 位，中间替换为 `****`）；phone 为 null 时传 `null`
  - [x] 将 `displayName`、`maskedPhone`、`createdAt` 作为 props 传给 `SettingsForm` 客户端组件
  - [x] 导出 `metadata` 对象：`{ title: '个人设置 | 适文' }`

- [x] **创建 `SettingsForm` 客户端组件** (AC: #1, #2, #3, #4)
  - [x] 新建 `src/features/settings/settings-form.tsx`（`'use client'`）
  - [x] 接收 props：`{ displayName: string; maskedPhone: string | null; createdAt: Date }`
  - [x] 使用 `react-hook-form` 管理表单（native validate），`displayName` 字段（非空字符串、最大 50 字符）
  - [x] 显示只读字段：手机号（显示 `maskedPhone ?? '未绑定'`）、注册时间（格式：`YYYY-MM-DD`）
  - [x] 提交时调用 `fetch('PATCH /api/user/profile', { body: JSON.stringify({ displayName }) })`
  - [x] 成功后更新表单默认值为新名称（`form.reset({ displayName: newName })`）
  - [x] 成功/失败反馈：内联提示（纯 Tailwind，不依赖 shadcn/ui — `src/components/ui/` 目前为空）
  - [x] 编写测试：`src/features/settings/__tests__/settings-form.test.tsx`（渲染信息正确、提交调用 API、成功显示提示、失败显示错误）

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全部为代码实现，无需外部配置 | 自动 |

### 关键架构约束（必须遵守）

**Prisma 导入路径（非默认）：**
```typescript
// 客户端实例（全局单例）
import { prisma } from '@/lib/prisma'

// 类型（如需单独导入）
import type { User } from '@/generated/prisma'
```

**Supabase 客户端选择：**
```typescript
// API Route / Server Component 中（读取 session cookie）
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// 管理员操作（绕过 RLS，写操作）—— 本 Story 不需要 service_role，Prisma 直接操作
import { createServiceRoleClient } from '@/lib/supabase/server-admin'
```

**本 Story 的 DB 操作策略：**
- 读取用户信息：`prisma.user.findUnique()` — Prisma 直接操作（服务端，安全）
- 更新 displayName：`prisma.user.update()` — Prisma 直接操作，不需要 service_role

**为什么不用 Supabase admin client 做 DB 操作（参考 sync-user route）：**
- `sync-user/route.ts` 用 Supabase admin client 是因为需要 upsert（跨 auth.users 和 public.users）
- 本 Story 直接通过 Prisma 读写 `users` 表更清晰，与项目架构设计保持一致

**env.ts 可在 API Route 和 Server Component 中正常使用（非 proxy.ts）：**
- proxy.ts 不能用 env.ts（含 `server-only`），本 Story 不修改 proxy.ts
- API Route 和 Server Component 中可以用 `import { env } from '@/lib/env'`（但直接用 process.env 也可以）

### API 路由设计

```typescript
// src/app/api/user/profile/route.ts
// PATCH /api/user/profile

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1, '名称不能为空').max(50, '名称不超过 50 个字符'),
})

export async function PATCH(request: Request) {
  // 1. 身份校验
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
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
    return Response.json(
      { data: null, error: { code: 'INVALID_PARAMS', message: parsed.error.errors[0].message } },
      { status: 400 }
    )
  }

  // 3. 更新
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
```

### 设置页 Server Component 设计

```typescript
// src/app/app/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SettingsForm } from '@/features/settings/settings-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '个人设置 | 适文',
}

function maskPhone(phone: string): string {
  // 11位手机号：保留前3位 + 后4位，中间4位替换为 ****
  if (phone.length === 11) {
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }
  // 非标准长度：保留首尾各2位
  return `${phone.slice(0, 2)}****${phone.slice(-2)}`
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // proxy.ts 已保证登录，此处 user 不应为 null；但作防御性处理
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) return null

  const maskedPhone = dbUser.phone ? maskPhone(dbUser.phone) : null

  return (
    <SettingsForm
      displayName={dbUser.displayName ?? ''}
      maskedPhone={maskedPhone}
      createdAt={dbUser.createdAt}
    />
  )
}
```

### SettingsForm 客户端组件设计

**注意：`src/components/ui/` 目前为空，shadcn/ui 尚未安装。使用纯 Tailwind CSS 实现 UI，不依赖 shadcn/ui 组件。**

```typescript
// src/features/settings/settings-form.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  displayName: z.string().min(1, '名称不能为空').max(50, '名称不超过 50 个字符'),
})
type FormValues = z.infer<typeof schema>

interface SettingsFormProps {
  displayName: string
  maskedPhone: string | null
  createdAt: Date
}

export function SettingsForm({ displayName, maskedPhone, createdAt }: SettingsFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName },
  })

  async function onSubmit(values: FormValues) {
    setStatus('loading')
    setErrorMessage('')
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: values.displayName }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setStatus('error')
        setErrorMessage(json.error?.message ?? '更新失败，请稍后重试')
      } else {
        setStatus('success')
        form.reset({ displayName: values.displayName })
        setTimeout(() => setStatus('idle'), 3000)
      }
    } catch {
      setStatus('error')
      setErrorMessage('网络错误，请稍后重试')
    }
  }

  const formattedDate = createdAt.toISOString().slice(0, 10) // YYYY-MM-DD

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">个人设置</h1>

      {/* 只读字段 */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
          <p className="text-gray-900">{maskedPhone ?? '未绑定'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">注册时间</label>
          <p className="text-gray-900">{formattedDate}</p>
        </div>
      </div>

      {/* 可编辑表单 */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
            显示名称
          </label>
          <input
            id="displayName"
            {...form.register('displayName')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {form.formState.errors.displayName && (
            <p className="mt-1 text-sm text-red-500">{form.formState.errors.displayName.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? '保存中...' : '保存'}
        </button>

        {status === 'success' && (
          <p className="text-sm text-green-600 text-center">✓ 保存成功</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-500 text-center">{errorMessage}</p>
        )}
      </form>
    </div>
  )
}
```

### 手机号脱敏规则

| 输入 | 输出 | 说明 |
|---|---|---|
| `13812341234` | `138****1234` | 11位：前3后4 |
| `null` | `null` | 无手机号（仅微信登录） |

### 测试模式参考（来自 Story 2.1 / 2.2 / 2.3）

**API Route 测试：**
```typescript
// src/app/api/user/profile/__tests__/route.test.ts
// @jest-environment node

import { PATCH } from '../route'

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))
jest.mock('@/lib/prisma', () => ({
  prisma: { user: { update: jest.fn() } },
}))

// mock getUser
const mockGetUser = jest.fn()
;(createClient as jest.Mock).mockResolvedValue({
  auth: { getUser: mockGetUser },
})
```

**客户端组件测试：**
```typescript
// src/features/settings/__tests__/settings-form.test.tsx
// 使用 @testing-library/react

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// mock global fetch
global.fetch = jest.fn()
```

### 已存在文件（禁止重新创建）

| 文件 | 用途 | 状态 |
|---|---|---|
| `src/lib/supabase/server.ts` | 服务端 Supabase 客户端（`createClient()`） | 已存在 |
| `src/lib/supabase/client.ts` | 浏览器端 Supabase 客户端 | 已存在 |
| `src/lib/supabase/server-admin.ts` | 管理员 Supabase 客户端 | 已存在 |
| `src/lib/prisma.ts` | Prisma 全局单例（`prisma`） | 已存在 |
| `src/proxy.ts` | Next.js 16 路由守卫（已保护 `/app/settings`） | 已存在 |
| `src/app/app/layout.tsx` | /app 路由布局（含 AuthGuard） | 已存在 |
| `src/features/auth/auth-guard.tsx` | 客户端会话守卫 | 已存在 |

### 目录结构（本 Story 完成后新增文件）

```
src/
├── app/
│   ├── api/
│   │   └── user/
│   │       └── profile/
│   │           ├── route.ts                       ← 新增（PATCH /api/user/profile）
│   │           └── __tests__/
│   │               └── route.test.ts              ← 新增
│   └── app/
│       └── settings/
│           └── page.tsx                           ← 新增（设置页 Server Component）
└── features/
    └── settings/
        ├── settings-form.tsx                      ← 新增（Client Component）
        └── __tests__/
            └── settings-form.test.tsx             ← 新增
```

### User 数据模型（Prisma 生成，确认可用字段）

```typescript
// src/generated/prisma/models/User.ts（只读，不要修改）
type User = {
  id: string            // UUID, PK
  phone: string | null  // 手机号（可为空，仅微信登录时）
  wechatOpenid: string | null  // 微信 openid（可为空）
  displayName: string | null   // 显示名称（可编辑）
  createdAt: Date
  updatedAt: Date
}
```

**Prisma 查询示例：**
```typescript
// 查询
const user = await prisma.user.findUnique({ where: { id: userId } })

// 更新
await prisma.user.update({
  where: { id: userId },
  data: { displayName: 'new name' },
})
```

### Zod v4 注意事项（当前版本 ^4.3.6）

Zod v4 与 v3 API 基本兼容，但：
- `z.string().min(1)` 错误消息参数语法相同
- `schema.safeParse()` 返回结构不变
- `parsed.error.errors[0].message` 仍可用

### Story 2.3 遗留 — `/app/settings` 已受保护

Story 2.3 的 `proxy.ts` 已配置：
```typescript
// 未登录用户访问 /app/* → redirect /login（含 /app/settings）
if (path === '/app' || path.startsWith('/app/')) && !user) {
  return NextResponse.redirect(new URL('/login', request.url))
}
```
**本 Story 无需修改 `proxy.ts`。**

### Story 2.2 遗留 — 设置页"绑定手机号"提示

Story 2.2 中有一个被推迟的任务：微信登录后在设置页提示"可绑定手机号（可跳过）"。
**本 Story 范围**：仅展示手机号是否已绑定（`phone ?? '未绑定'`），不实现绑定功能。绑定功能超出本 Story 的 AC 范围。

### Project Structure Notes

- 本 Story 新建 `src/features/settings/` 功能模块（非 `src/features/auth/`），因设置是独立功能域
- API 路由放在 `src/app/api/user/profile/`，遵循 API 命名规范（`/api/{resource}`）
- 测试文件与源文件同目录，命名 `*.test.ts(x)`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4] — AC 原文
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Stack] — 技术栈选型
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — 目录规范
- [Source: _bmad-output/implementation-artifacts/2-3-session-management.md#Dev Notes] — proxy.ts 路由保护已覆盖 /app/settings
- [Source: _bmad-output/implementation-artifacts/2-3-session-management.md#Completion Notes] — Next.js 16 proxy.ts 命名变更
- [Source: src/lib/prisma.ts] — Prisma 单例模式和导入路径
- [Source: src/app/api/auth/sync-user/route.ts] — API Route 认证模式

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `@hookform/resolvers@3.10.0` 的 `zodResolver` 检查 `e.errors`（Zod v3 格式），但 Zod v4 只有 `e.issues`，导致 ZodError 未被捕获而直接抛出。改用 `react-hook-form` 的 `register` native validate 规则，无需 `zodResolver`（后续升级 `@hookform/resolvers` 到支持 Zod v4 的版本可回归使用 resolver）。
- `proxy.test.ts` 预存在 4 个失败：期待 HTTP 307，实际返回 302。这是 Story 2.3 代码评审后将重定向状态码从 307 改为 302，但测试未同步更新的历史遗留问题，与本 Story 无关。

### Completion Notes List

- 全部 4 条 AC 通过实现和测试验证
- 新增 15 个测试（7 API Route + 8 SettingsForm），全部通过
- `zodResolver` 与 Zod v4 不兼容，改用 `react-hook-form` native validate（见 Debug Log）
- `src/components/ui/` 为空，UI 使用纯 Tailwind CSS 实现
- Server Component 设置页从 Prisma 直接读取用户数据，不经过 Supabase admin client

### File List

- `src/app/api/user/profile/route.ts`（新增：PATCH 更新用户 displayName）
- `src/app/api/user/profile/__tests__/route.test.ts`（新增：7 个测试）
- `src/app/app/settings/page.tsx`（新增：设置页 Server Component）
- `src/features/settings/settings-form.tsx`（新增：Client Component 设置表单）
- `src/features/settings/__tests__/settings-form.test.tsx`（新增：8 个测试）

### Review Findings

- [x] [Review][Decision] PATCH 端点缺乏 CSRF 防护 — 已 defer，待 Epic 5 统一处理 API 安全层 [route.ts]
- [x] [Review][Patch] Prisma P2025（记录不存在）返回通用 500 而非 404 [route.ts:42-53] — fixed
- [x] [Review][Patch] maskPhone 对长度 < 4 的字符串结果错误（digits 未脱敏） [page.tsx:11-14] — fixed
- [x] [Review][Patch] createdAt prop 类型声明为 Date，但运行时实际为 string（Next.js RSC 序列化） [settings-form.tsx:13] — fixed
- [x] [Review][Patch] setTimeout 成功重置未在 unmount 时清除，可能更新已卸载组件状态 [settings-form.tsx:40] — fixed
- [x] [Review][Patch] 加载中按钮 disabled 但 Enter 键仍可触发重复提交 [settings-form.tsx:24] — fixed
- [x] [Review][Patch] 纯空白字符串通过客户端和服务端双层校验（未做 trim） [route.ts:6 / settings-form.tsx:75-78] — fixed
- [x] [Review][Patch] dbUser 不存在时静默返回空白页（HTTP 200），无错误提示或重定向 [page.tsx:27] — fixed
- [x] [Review][Patch] Prisma catch 块缺少服务端错误日志，DB 故障无可观测性 [route.ts:48-53] — fixed
- [x] [Review][Defer] PATCH 端点缺乏 CSRF 防护，待统一处理 [route.ts] — deferred，建议 Epic 5 安全加固阶段在中间件层统一处理
- [x] [Review][Defer] maskPhone 对非 11 位号码（国际格式）脱敏强度不足 [page.tsx:12-14] — deferred, pre-existing，本 Story 仅处理中国大陆 11 位手机号
- [x] [Review][Defer] 保存成功状态期间提交按钮未禁用，可触发冗余请求 [settings-form.tsx:88-94] — deferred, pre-existing，不影响正确性，属 UX 优化
- [x] [Review][Defer] createdAt 以 UTC 格式化显示，中国用户午夜时段可能显示前一天 [settings-form.tsx:48] — deferred, pre-existing，Spec 未规定时区，UTC 为当前一致性选择

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-26 | Story 2.4 创建：个人设置页 | create-story |
| 2026-03-26 | Story 2.4 实现完成：PATCH /api/user/profile、settings/page.tsx、SettingsForm；15 个新增测试全通过 | dev-agent |
| 2026-03-26 | Story 2.4 代码审查：1 decision-needed、8 patch、3 defer、4 dismissed | code-review |
| 2026-03-26 | 代码审查修复：8 patch 全部应用、CSRF decision-needed 转 defer | code-review |
