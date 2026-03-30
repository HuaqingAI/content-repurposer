# Story 6.1：管理员角色与访问控制

Status: review

## Story

作为系统管理员，
我想只有被授权的账号才能访问管理后台，
以便防止普通用户查看敏感运营数据或修改平台配置。

## Acceptance Criteria

1. **Given** `users` 表新增 `role` 字段（枚举：`user` / `admin`，默认 `user`）
   **When** 执行 Prisma migration
   **Then** 数据库成功添加 `role` 列，所有现有用户默认为 `user`

2. **Given** 用户访问 `/admin` 路径下的任意页面
   **When** `src/proxy.ts` 执行路由保护逻辑
   **Then** 非 `admin` 用户被重定向到 `/app`（已登录）或 `/login`（未登录）

3. **Given** admin 用户访问 `/admin/*`
   **When** proxy 校验 role
   **Then** 允许通过，展示管理后台内容

4. **Given** 管理员账号设置
   **When** 运维直接在数据库执行 `UPDATE users SET role = 'admin' WHERE phone = 'xxxx'`
   **Then** 该用户下次访问 `/admin` 时可正常进入

5. **Given** 已登录的 admin 用户访问 `/login`
   **When** proxy 执行重定向逻辑
   **Then** 重定向到 `/app`（现有行为不变）

## Tasks / Subtasks

- [x] 任务 1：Prisma schema 添加 UserRole 枚举和 role 字段 (AC: #1)
  - [x] 在 `prisma/schema.prisma` 添加 `UserRole` 枚举（`user` / `admin`）
  - [x] 在 `User` model 添加 `role UserRole @default(user) @map("role")` 字段
  - [x] 手动创建 migration 文件（无 DB 连接环境）：`prisma/migrations/20260330000002_add_user_role/migration.sql`
  - [x] 运行 `npx prisma generate`（生成到 `src/generated/prisma/`）

- [x] 任务 2：扩展 proxy.ts 添加管理后台路由保护 (AC: #2, #3)
  - [x] 在 proxy.ts 中，认证成功后（`user` 存在），对 `/admin` 和 `/admin/*` 路径查询用户 role
  - [x] 使用现有 `supabase` 客户端（anon key + user session）查询 `users` 表 `role` 字段
  - [x] 未登录访问 `/admin/*` → 重定向 `/login`
  - [x] 已登录但非 admin 访问 `/admin/*` → 重定向 `/app`
  - [x] admin 用户允许通过，返回 `supabaseResponse`
  - [x] **性能注意**：仅当路径以 `/admin` 开头时才查询数据库

- [ ] 任务 3：添加管理后台 RLS SELECT 策略（运维任务，非 dev 自动执行）(AC: #2)
  - [ ] 在 Supabase Dashboard 执行：`CREATE POLICY "用户可读自己的 role" ON users FOR SELECT USING (auth.uid() = id);`
  - [ ] 或在 `supabase/migrations/` 添加对应 SQL（若项目使用 supabase CLI 管理 RLS）

- [x] 任务 4：创建管理后台骨架页面 (AC: #3)
  - [x] 创建 `src/app/admin/layout.tsx`（简单布局，标明"管理后台"）
  - [x] 创建 `src/app/admin/page.tsx`（占位页，供 Story 6.2 替换）

- [x] 任务 5：编写测试 (AC: #2, #3)
  - [x] 更新 `src/__tests__/proxy.test.ts`：17 个测试全部通过
  - [x] 测试：未登录访问 `/admin`、`/admin/users` → 重定向 `/login`（302）
  - [x] 测试：已登录普通用户访问 `/admin`、`/admin/users`、`/admin/platform-configs` → 重定向 `/app`
  - [x] 测试：admin 用户访问 `/admin`、`/admin/users`、`/admin/platform-configs` → 200 通过
  - [x] 测试：非 /admin 路由不触发 role 查询（mockFrom 未调用）
  - [x] 同步修复已有 307→302 状态码断言错误（4 个旧测试修复）

## Dev Notes

### 关键约束

- **proxy.ts 不能使用 `server-only` 模块**。`src/lib/supabase/server-admin.ts` 有 `import 'server-only'`，不可在 proxy 中导入。直接用已有的 `supabase` 客户端（anon key + 用户 session）即可查询自己的 role。
- **proxy.ts 运行时**：Next.js 16.2.1 默认 Node.js runtime（非 Edge），可使用完整 Node.js API。
- **`middleware.ts` 已废弃**：Next.js 16.2.1 将其改名为 `proxy.ts`，函数名也改为 `proxy`。本项目已正确使用 `src/proxy.ts`，**不得创建 `middleware.ts`**。
- **Prisma 生成路径**：`src/generated/prisma/`（非默认 `node_modules/@prisma/client`），import 路径为 `@/generated/prisma`。
- **不得修改** 现有 `/app` 路由保护逻辑，只在 proxy 中追加 `/admin` 保护分支。

### proxy.ts 扩展方案

在现有 proxy.ts 的路由保护部分（步骤 4 之后）追加：

```typescript
// 5b. /admin 路由保护：未登录跳 /login，已登录非 admin 跳 /app
if (path === '/admin' || path.startsWith('/admin/')) {
  if (!user) {
    return redirectWithCookies(new URL('/login', request.url))
  }
  // 查询当前用户 role（使用 user session，走 RLS SELECT 策略）
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    return redirectWithCookies(new URL('/app', request.url))
  }
}
```

> **注意**：此代码块放在现有 "5. 已登录用户访问 /login 跳转到 /app" 之前，即步骤 4 和步骤 5 之间。

### Prisma Schema 修改

```prisma
// 新增枚举
enum UserRole {
  user
  admin

  @@map("user_role")
}

// User model 新增字段
model User {
  // ...现有字段...
  role  UserRole  @default(user)  @map("role")
  // ...
}
```

### RLS 注意事项

proxy.ts 使用 anon key + user session 查询 `users` 表，需要 SELECT RLS 策略允许用户读自己的行：

```sql
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);
```

**如果项目 `users` 表已有此策略（Story 1.3 中可能已添加），跳过此步骤。** 检查 `docs/ops/rls-policies.md`。

若不确定，可在 Supabase Dashboard SQL Editor 执行：
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'users';
```

### Prisma Migration 命令

```bash
# 开发环境
npx prisma migrate dev --name add_user_role

# 生产环境（ECS 上手动执行）
npx prisma migrate deploy
```

migration 后需运行 `npx prisma generate` 重新生成客户端（CI/CD 流程已包含此步骤）。

### 管理后台骨架页面（最简实现）

```typescript
// src/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3">
        <span className="text-sm font-medium text-gray-500">适文 · 管理后台</span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}

// src/app/admin/page.tsx
export default function AdminPage() {
  return <div className="text-gray-600">仪表盘（开发中）</div>
}
```

**注意**：layout.tsx 是 Server Component（无 `'use client'`），page.tsx 同理，保持简洁。Story 6.2 会替换 page.tsx 内容。

### 现有 proxy.ts 结构参考

现有文件路径：`src/proxy.ts`，结构如下：
1. 创建 supabaseResponse（`NextResponse.next`）
2. 创建 supabase 客户端（anon key）
3. `getUser()` 获取当前用户
4. 未登录访问 `/app/*` → 重定向 `/login`
5. 已登录访问 `/login` → 重定向 `/app`
6. 返回 `supabaseResponse`

本 story 在步骤 4 和步骤 5 之间插入新的 `/admin` 保护逻辑。

### 运维提醒（非 dev 自动执行）

- 生产环境执行 `npx prisma migrate deploy` 应用 migration
- 确认 Supabase RLS `users_select_own` 策略已存在
- 设置初始管理员：`UPDATE users SET role = 'admin' WHERE phone = '+86xxx';`

### References

- Next.js 16 proxy 文档（middleware 废弃）：[Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md]
- 现有 proxy 实现：[Source: src/proxy.ts]
- Prisma schema（User model）：[Source: prisma/schema.prisma]
- server-admin.ts（不可在 proxy 中 import）：[Source: src/lib/supabase/server-admin.ts]
- Epic 6 AC 原文：[Source: _bmad-output/planning-artifacts/epics.md#Story 6.1]
- 架构文档 admin 路由结构：[Source: _bmad-output/planning-artifacts/architecture.md#Admin Routes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Prisma 无 DB 连接，手动创建 migration SQL：`CREATE TYPE "user_role" AS ENUM ('user', 'admin')` + `ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user'`
- proxy.ts 扩展：步骤 4 和 5 之间插入 admin 路由保护，仅 `/admin` 前缀才查 DB（性能优化）
- 管理后台 RLS SELECT 策略（`users_select_own`）为运维任务，未自动执行
- proxy.test.ts 从 6 个测试扩展到 17 个，修复已有 307→302 断言错误（pre-existing bug in previous story）
- 预先存在的 3 个 `route.test.ts` 失败（guest trial 功能）与本 story 无关，由 dev 分支未提交的其他 story 代码引起

### File List

- prisma/schema.prisma（修改：添加 UserRole 枚举 + User.role 字段）
- prisma/migrations/20260330000002_add_user_role/migration.sql（新增：add_user_role migration）
- src/proxy.ts（修改：添加 /admin/* 路由保护 + admin role 查询）
- src/app/admin/layout.tsx（新增：管理后台骨架布局）
- src/app/admin/page.tsx（新增：管理后台占位页）
- src/__tests__/proxy.test.ts（修改：17 个测试，覆盖 admin 路由保护场景）
- _bmad-output/implementation-artifacts/sprint-status.yaml（修改：6-1 状态 → review）
- _bmad-output/implementation-artifacts/6-1-admin-role-access-control.md（本文件）
