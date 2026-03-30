# Story 6.3：用户管理

Status: done

## Story

作为运营团队，
我想查看所有注册用户并能对异常账号进行处理，
以便应对滥用行为保护平台正常运营。

## Acceptance Criteria

1. **Given** 管理员访问 `/admin/users`，**When** 页面加载完成，**Then** 展示用户列表，包含：注册时间、手机号（脱敏）、改写次数、最后活跃时间、账号状态
2. **Given** 用户列表页已加载，**When** 管理员在搜索框输入手机号，**Then** 列表实时过滤，仅展示匹配的用户
3. **Given** 管理员点击某用户的"禁用"按钮，**When** 操作确认，**Then** 该用户 `is_banned` 字段置为 `true`，列表状态立即更新，无需刷新页面
4. **Given** 用户账号已被禁用，**When** 该用户调用任意改写相关 API（`POST /api/rewrite`），**Then** API 返回 403，body 为 `{ data: null, error: { code: "ACCOUNT_BANNED", message: "账号已被禁用" } }`
5. **Given** 非管理员用户请求 `GET /api/admin/users` 或 `PATCH /api/admin/users/[id]`，**Then** 返回 403

## Tasks / Subtasks

- [x] 任务 1：Schema 迁移 — 添加 `isBanned` 字段（AC: #3, #4）
  - [x] 1.1 在 `prisma/schema.prisma` 的 `User` model 中添加 `isBanned Boolean @default(false) @map("is_banned")`
  - [x] 1.2 手动创建迁移文件 `prisma/migrations/20260330000003_add_user_is_banned/migration.sql`（DB URL 为占位符，无法连接真实库；运维需手动执行 `ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;`）
  - [x] 1.3 重新生成 Prisma Client：`npx prisma generate`（`isBanned` 已在生成客户端中确认）

- [x] 任务 2：扩展 `admin-service.ts` — 添加用户管理查询函数（AC: #1, #2, #3）
  - [x] 2.1 添加 `getUserList(options: { search?: string; skip?: number; take?: number })` 函数，返回用户列表及总数，内含手机号脱敏
  - [x] 2.2 添加 `toggleUserBan(userId: string, banned: boolean)` 函数，更新 `isBanned`

- [x] 任务 3：创建管理后台用户 API（AC: #1, #2, #3, #5）
  - [x] 3.1 创建 `src/app/api/admin/users/route.ts`，实现 `GET /api/admin/users`（支持 `?search=` 和分页参数）
  - [x] 3.2 创建 `src/app/api/admin/users/[id]/route.ts`，实现 `PATCH /api/admin/users/[id]`（接收 `{ banned: boolean }`，Next.js 16 `params` 为 Promise）
  - [x] 3.3 两个路由均在内部校验 admin 权限

- [x] 任务 4：创建用户管理前端组件（AC: #1, #2, #3）
  - [x] 4.1 创建 `src/features/admin/user-table.tsx`（Client Component）：展示用户列表，支持搜索和禁用/启用操作，乐观更新
  - [x] 4.2 创建 `src/app/admin/users/page.tsx`（Server Component）：渲染 `<UserTable />`

- [x] 任务 5：改写 API 禁用拦截（AC: #4）
  - [x] 5.1 在 `src/app/api/rewrite/route.ts` 的认证通过后、限流检查前，查询 `prisma.user.findUnique` 检查 `isBanned`，禁用则返回 403 ACCOUNT_BANNED

- [x] 任务 6：编写测试（AC: #1, #3, #4, #5）
  - [x] 6.1 创建 `src/app/api/admin/users/__tests__/route.test.ts`：11 个用例覆盖 GET（401/503/403/200）、PATCH（401/403/400/200/404）场景
  - [x] 6.2 在 `src/app/api/rewrite/__tests__/route.test.ts` 中补充禁用用户 403 测试用例 + prisma mock

## Dev Notes

### 关键架构背景

**管理后台 admin API 权限校验模式（继承自 Story 6.2）：**

```typescript
// 所有 /api/admin/* 路由必须在内部自行校验 admin 权限
// proxy.ts 的 matcher 排除了 api/ 路径，不对 API 路由生效
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()

if (authError) {
  return Response.json({ data: null, error: { code: 'SERVICE_ERROR', message: '服务异常' } }, { status: 503 })
}
if (!user) {
  return Response.json({ data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 })
}

// 查询 role（使用 prisma 直连，绕过 RLS；非 admin 返回 403）
const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
if (!dbUser || dbUser.role !== UserRole.admin) {
  return Response.json({ data: null, error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
}
```

**Prisma 相关规范（全局约定）：**
- Import：`import { prisma } from '@/lib/prisma'`
- 枚举从 `@/generated/prisma/enums` 单独导入：`import { UserRole } from '@/generated/prisma/enums'`
- `@/generated/prisma` 无 `index.ts`，不能直接 `import { ... } from '@/generated/prisma'`
- server-only 文件加 `import 'server-only'`

**现有文件结构（本 story 需要了解）：**
```
src/
├── features/admin/
│   ├── admin-service.ts      ← 本 story 扩展，添加用户管理函数
│   └── dashboard-stats.tsx   ← 已存在，勿修改
├── app/
│   ├── admin/
│   │   ├── layout.tsx        ← 已存在（Story 6.1）
│   │   └── page.tsx          ← 已存在，仪表盘（Story 6.2）
│   └── api/admin/
│       └── dashboard/
│           └── route.ts      ← 已存在（Story 6.2），参考其权限校验模式
└── proxy.ts                  ← 已存在，保护 /admin/* 页面路由（非 API 路由）
```

### Schema 变更细节

**需要在 `prisma/schema.prisma` 的 `User` model 中添加：**

```prisma
model User {
  id           String    @id @default(uuid()) @db.Uuid
  phone        String?   @unique @db.VarChar(20)
  wechatOpenid String?   @unique @map("wechat_openid") @db.VarChar(100)
  displayName  String    @map("display_name") @db.VarChar(50)
  role         UserRole  @default(user) @map("role")
  isBanned     Boolean   @default(false) @map("is_banned")   // ← 新增
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  rewriteRecords RewriteRecord[]

  @@index([createdAt], name: "idx_users_created_at")
  @@map("users")
}
```

> **运维提醒**：迁移完成后需同步更新 Supabase 生产数据库的 `users` 表（添加 `is_banned BOOLEAN DEFAULT FALSE NOT NULL`），并检查 RLS 策略是否需要为新字段添加保护规则。

### admin-service.ts 扩展

**新增 `UserListItem` 类型和查询函数：**

```typescript
export type UserListItem = {
  id: string
  phone: string | null           // 脱敏后
  displayName: string
  role: string
  isBanned: boolean
  createdAt: Date
  rewriteCount: number           // rewriteRecords 关联计数
  lastActiveAt: Date | null      // 最近一条 rewriteRecord 的 createdAt
}

// 手机号脱敏：138****1234（保留前3位和后4位）
function maskPhone(phone: string | null): string | null {
  if (!phone || phone.length < 8) return phone
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

export async function getUserList(options: {
  search?: string
  skip?: number
  take?: number
}): Promise<{ users: UserListItem[]; total: number }> {
  // 用 prisma.user.findMany + _count + orderBy createdAt desc
  // search 参数：使用 startsWith 匹配手机号前缀（注意：搜索原始 phone，不是脱敏后的）
}

export async function toggleUserBan(userId: string, banned: boolean): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { isBanned: banned } })
}
```

**用户列表查询需要同时获取改写次数和最后活跃时间：**

```typescript
const users = await prisma.user.findMany({
  where: search ? { phone: { startsWith: search } } : {},
  select: {
    id: true,
    phone: true,
    displayName: true,
    role: true,
    isBanned: true,
    createdAt: true,
    rewriteRecords: {
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    },
  },
  orderBy: { createdAt: 'desc' },
  skip: options.skip ?? 0,
  take: options.take ?? 20,
})
```

> **性能注意**：这种方式会一次性加载所有 rewriteRecords 关联，用户量大时有性能风险。当前阶段管理员用量小可接受；后续可改为 `prisma.$queryRaw` 用 COUNT + MAX 聚合。

### API 路由规范

**GET `/api/admin/users`：**
- Query 参数：`search`（可选，手机号搜索）、`page`（默认 1）、`pageSize`（默认 20，上限 100）
- 响应：`{ data: { users: UserListItem[], total: number, page: number, pageSize: number }, error: null }`

**PATCH `/api/admin/users/[id]`：**
- Body：`{ banned: boolean }`
- 响应：`{ data: { id: string, isBanned: boolean }, error: null }`
- 错误：用户不存在返回 404

### 用户管理前端（user-table.tsx）

**组件结构：**
- Client Component，使用 `useEffect` + `useState` 获取用户列表
- 搜索框：`<input>` 配合 `useState`，用 `useCallback` 包裹 fetch，防抖或直接 onChange 触发
- 用户列表：`<table>`，展示：注册时间（`createdAt` 格式化）、手机号（脱敏，已在 service 层处理）、改写次数、最后活跃时间、状态标签（"正常"/"已禁用"）、操作按钮（"禁用"/"启用"）
- 禁用/启用：调用 `PATCH /api/admin/users/[id]`，成功后 `optimistic update` 或重新 fetch 列表
- Loading 状态和空状态展示

**UI 风格参考：** 与 dashboard-stats.tsx 保持一致（Tailwind CSS，简洁表格风格）

### 改写 API 禁用拦截（rewrite/route.ts）

**在认证通过后（获得 `user.id`）、限流检查前插入：**

```typescript
// 检查用户是否被禁用
const dbUser = await prisma.user.findUnique({
  where: { id: user.id },
  select: { isBanned: true },
})
if (dbUser?.isBanned) {
  return Response.json(
    { data: null, error: { code: 'ACCOUNT_BANNED', message: '账号已被禁用' } },
    { status: 403 }
  )
}
```

> **注意**：`src/app/api/rewrite/route.ts` 目前还有 `TODO(Story 3.4a)` 桩代码，但认证模式已完整（`createClient` + `getUser`）。Story 3.4a 在 sprint 中标记为 done，实际 LLM 改写逻辑已在其他方式实现（mock-rewrite 等）。禁用检查添加在认证之后、限流之前即可，不影响现有逻辑。

### 统一 API 响应格式

所有 admin API 遵循全局规范：
```typescript
// 成功
{ data: T, error: null }
// 错误
{ data: null, error: { code: "ERROR_CODE", message: "..." } }
```

### Project Structure Notes

**本 story 新增/修改文件：**
```
prisma/
└── schema.prisma                                  ← 修改：User model 添加 isBanned
    migrations/
    └── {timestamp}_add_user_is_banned/
        └── migration.sql                          ← 自动生成

src/
├── features/admin/
│   └── admin-service.ts                           ← 修改：添加 getUserList, toggleUserBan
├── app/
│   ├── admin/
│   │   └── users/
│   │       └── page.tsx                           ← 新增：用户管理页
│   └── api/admin/
│       └── users/
│           ├── route.ts                           ← 新增：GET 用户列表
│           ├── __tests__/
│           │   └── route.test.ts                  ← 新增：API 测试
│           └── [id]/
│               └── route.ts                       ← 新增：PATCH 禁用/启用
├── app/api/rewrite/
│   └── route.ts                                   ← 修改：添加禁用用户拦截
└── features/admin/
    └── user-table.tsx                             ← 新增：用户管理表格组件
```

### References

- Story 6.2 Dev Notes（6-2-system-dashboard.md）：admin API 权限校验模式、`server-only` 用法、Prisma 字段映射
- `src/app/api/admin/dashboard/route.ts`：参考权限校验代码实现
- `src/features/admin/admin-service.ts`：参考现有 service 结构和 `getDateRange` 工具函数
- `prisma/schema.prisma`：User model 完整字段定义
- Architecture.md：FR28-31 管理后台目录结构、API Boundaries 规范
- `src/proxy.ts`：了解页面路由保护范围（不保护 API 路由）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Schema 迁移无法通过 `prisma migrate dev` 执行（DATABASE_URL 为占位符）；改为手动创建迁移 SQL 文件 + `prisma generate`
- Next.js 16 动态路由 `params` 为 Promise，`[id]/route.ts` 中用 `await params` 获取

### Completion Notes List

- `prisma/schema.prisma`：User model 新增 `isBanned Boolean @default(false) @map("is_banned")`
- `prisma/migrations/20260330000003_add_user_is_banned/migration.sql`：手动创建，运维需在 Supabase 执行
- `src/generated/prisma/`：Prisma Client 已重新生成，`isBanned` 字段已包含
- `src/features/admin/admin-service.ts`：新增 `UserListItem` 类型、`maskPhone`、`getUserList`、`toggleUserBan`
- `src/app/api/admin/users/route.ts`：GET 用户列表（auth + admin 校验 + 分页 + 搜索）
- `src/app/api/admin/users/[id]/route.ts`：PATCH 禁用/启用（auth + admin 校验 + P2025 404 处理）
- `src/features/admin/user-table.tsx`：Client Component，搜索 + 分页 + 乐观更新禁用状态
- `src/app/admin/users/page.tsx`：Server Component 入口
- `src/app/api/rewrite/route.ts`：认证后添加 `isBanned` 检查，返回 403 ACCOUNT_BANNED
- 新增测试：`src/app/api/admin/users/__tests__/route.test.ts`（11 个用例，全部通过）
- 修改测试：`src/app/api/rewrite/__tests__/route.test.ts`（新增 prisma mock + 禁用用户测试，7 个用例全部通过）
- 回归测试：114 个用例通过，0 个新增回归（`content-package.test.tsx` 为预先存在的失败，与本 story 无关）

### File List

- `prisma/schema.prisma`（修改）
- `prisma/migrations/20260330000003_add_user_is_banned/migration.sql`（新增）
- `src/features/admin/admin-service.ts`（修改）
- `src/app/api/admin/users/route.ts`（新增）
- `src/app/api/admin/users/[id]/route.ts`（新增）
- `src/app/api/admin/users/__tests__/route.test.ts`（新增）
- `src/features/admin/user-table.tsx`（新增）
- `src/app/admin/users/page.tsx`（新增）
- `src/app/api/rewrite/route.ts`（修改）
- `src/app/api/rewrite/__tests__/route.test.ts`（修改）
- `_bmad-output/implementation-artifacts/6-3-user-management.md`（本文件）
- `_bmad-output/implementation-artifacts/sprint-status.yaml`（状态更新）

---

### Review Findings

> 代码审查于 2026-03-30，by bmad-code-review（Blind Hunter + Edge Case Hunter + Acceptance Auditor 三层并行审查）

**待决策（Decision Needed）：**

- [x] [Review][Decision] 禁用操作缺少确认步骤 — 已解决：在 handleToggleBan 添加 window.confirm 确认对话框 [`src/features/admin/user-table.tsx`]

**待修复（Patch）：**

- [x] [Review][Patch] Admin 权限校验使用 Supabase RLS 客户端，已改用 Prisma 直连 [`src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`]
- [x] [Review][Patch] getUserList 加载全量 rewriteRecords，已改用 `_count` 聚合 + `take: 1` 取 lastActiveAt [`src/features/admin/admin-service.ts`]
- [x] [Review][Patch] maskPhone 对 < 7 位手机号返回 '***' 替代原始值 [`src/features/admin/admin-service.ts:maskPhone`]
- [x] [Review][Patch] parseInt NaN 问题，已加 isNaN 守卫 [`src/app/api/admin/users/route.ts`]
- [x] [Review][Patch] 搜索框已添加 300ms 防抖，debouncedSearch 驱动 fetch [`src/features/admin/user-table.tsx`]
- [x] [Review][Patch] PATCH 路由已添加自禁保护（targetUserId === user.id 返回 403） [`src/app/api/admin/users/[id]/route.ts`]
- [x] [Review][Patch] 乐观更新已改用服务端返回的 `json.data.isBanned` [`src/features/admin/user-table.tsx`]
- [x] [Review][Patch] P2025 错误检查已改用 `instanceof PrismaClientKnownRequestError` [`src/app/api/admin/users/[id]/route.ts`]
- [x] [Review][Patch] 空字符串 search 参数已在 service 层过滤（trim + || undefined） [`src/features/admin/admin-service.ts`]

**已延期（Defer）：**

- [x] [Review][Defer] 禁用拦截仅覆盖 /api/rewrite，其他 API 路由（历史记录等）未检查禁用状态 — deferred，本 story AC4 明确范围为 /api/rewrite，其他路由为独立需求
- [x] [Review][Defer] 无防止封禁最后一个 admin 的逻辑，可能导致后台锁死 — deferred，超出本 story 范围，需独立需求规划
