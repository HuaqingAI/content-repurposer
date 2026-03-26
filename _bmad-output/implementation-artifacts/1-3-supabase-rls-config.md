# Story 1.3: Supabase Row Level Security 策略配置

Status: done

## Story

作为产品运营团队，
我想确保用户只能访问自己的改写数据，
以便平台满足用户隐私和数据安全要求。

## Acceptance Criteria

1. **Given** Supabase 数据库已完成 Story 1.2 的 schema 创建，**When** RLS 策略配置完成后，用户 A 尝试查询用户 B 的 `rewrite_records`，**Then** 查询返回空结果，不报错也不暴露其他用户数据。

2. **Given** RLS 策略已配置，**When** 已认证用户查询 `platform_configs`，**Then** 可正常读取所有激活配置；**And** 未认证用户（匿名请求）尝试访问 `platform_configs`，**Then** 访问被拒绝（返回空结果或 PGRST116 错误）。

3. **Given** RLS 策略已配置，**When** 在 Supabase Dashboard > Authentication > Policies 中查看，**Then** 四张表均显示 RLS Enabled，且各表策略说明清晰。

4. **Given** RLS 策略已配置，**When** 查看 `docs/ops/rls-policies.md`，**Then** 文档中记录了各表的 RLS 策略说明，包括策略名称、目标操作、条件表达式。

## Tasks / Subtasks

- [ ] 前置：确认数据库迁移已实际执行 (AC: 全部) — ⚠️ 需要真实 Supabase 连接后执行
  - [ ] 确认 `.env.local` 中 `DATABASE_URL` 已配置为真实 Supabase 连接字符串（当前为占位值）
  - [ ] 确认 `npx prisma migrate dev --name init` 已执行成功（四张表在 Supabase Dashboard 可见）
  - [ ] 若迁移未执行，先完成 Story 1.2 的遗留任务再继续本 Story

- [x] 创建 RLS 策略 Prisma 迁移文件 (AC: #1, #2, #3)
  - [x] 迁移文件已手动创建：`prisma/migrations/20260325000001_add_rls_policies/migration.sql`（DATABASE_URL 为占位值，`prisma migrate dev` 无法执行，迁移文件已预先创建，待连接真实 DB 后通过 `npx prisma migrate deploy` 应用）
  - [x] 迁移文件包含：对四张表启用 RLS + 创建各表的所有策略

- [x] 创建 RLS SQL 参考脚本 `supabase/rls.sql` (AC: #1, #2, #3)
  - [x] `users` 表：SELECT（自己）、UPDATE（自己），INSERT 通过服务端 service_role 完成，不开放给匿名用户
  - [x] `rewrite_records` 表：SELECT / INSERT / UPDATE / DELETE 均限制为 `auth.uid() = user_id`
  - [x] `rewrite_results` 表：SELECT/UPDATE 允许记录所有者通过 subquery 验证；INSERT/DELETE 仅 service_role（由 API Route 完成）
  - [x] `platform_configs` 表：SELECT 允许所有已认证用户；写入不对用户开放（由 service_role 完成）

- [ ] 在 Supabase Dashboard 验证 RLS (AC: #3) — ⚠️ 需要真实 Supabase 连接后执行
  - [ ] 进入 Supabase Dashboard > Authentication > Policies，确认四张表均显示 "RLS Enabled"
  - [ ] 在 SQL Editor 中用测试脚本（见 Dev Notes）模拟普通用户查询，验证数据隔离效果
  - [ ] 确认 `platform_configs` 策略：已认证用户可读，匿名用户不可读

- [x] 编写 RLS 文档 (AC: #4)
  - [x] 创建 `docs/ops/rls-policies.md`
  - [x] 文档包含：各表策略表格（策略名、操作类型、条件表达式）+ 设计说明 + 测试方法

## Dev Notes

### 核心架构说明：users.id 与 auth.uid() 的关系

**关键约束：** 本项目的 `users.id`（我们自定义用户表的主键）必须等于 Supabase Auth 的 `auth.uid()`。

- Supabase Auth 在认证时生成唯一 UUID，存储在 `auth.users.id`
- 我们的 `users.id` 在用户首次登录时由 Story 2.1/2.2 创建，**必须使用 `auth.uid()` 作为 id 值**（即 `users.id = auth.uid()`）
- 只有这样，`auth.uid() = user_id` 的 RLS 策略才能正确生效
- Story 2.1/2.2 在实现时务必遵守此约束：创建 `users` 记录时 `id` 必须从 `supabase.auth.getUser()` 获取，不得使用 `uuid()` 随机生成

### 完整 RLS SQL 脚本

以下 SQL 在 Supabase SQL Editor 或 Prisma 迁移文件中执行：

```sql
-- ============================================================
-- 启用所有核心表的 Row Level Security
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- users 表策略
-- 用户只能读取和修改自己的记录
-- 注意：INSERT 通过服务端 service_role 完成，不对普通用户开放
-- ============================================================

-- 允许已认证用户读取自己的记录
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 允许已认证用户更新自己的记录（仅 display_name 等可修改字段）
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- rewrite_records 表策略
-- 用户只能访问自己发起的改写记录
-- ============================================================

-- 读取自己的改写记录
CREATE POLICY "rewrite_records_select_own"
  ON rewrite_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 创建改写记录（user_id 必须等于当前用户）
CREATE POLICY "rewrite_records_insert_own"
  ON rewrite_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 更新改写记录（如元数据更新）
CREATE POLICY "rewrite_records_update_own"
  ON rewrite_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 删除自己的改写记录
CREATE POLICY "rewrite_records_delete_own"
  ON rewrite_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- rewrite_results 表策略
-- 通过关联 rewrite_records 验证归属
-- INSERT/UPDATE/DELETE 由服务端 service_role 完成，不对用户开放
-- ============================================================

-- 读取属于自己改写记录的结果
CREATE POLICY "rewrite_results_select_own"
  ON rewrite_results
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id
      FROM rewrite_records
      WHERE id = rewrite_results.record_id
    )
  );

-- UPDATE（反馈字段 feedback/comment）：用户可更新自己记录的结果
CREATE POLICY "rewrite_results_update_own"
  ON rewrite_results
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id
      FROM rewrite_records
      WHERE id = rewrite_results.record_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id
      FROM rewrite_records
      WHERE id = rewrite_results.record_id
    )
  );

-- ============================================================
-- platform_configs 表策略
-- 所有已认证用户可读；写入仅 service_role（管理员操作）
-- ============================================================

-- 已认证用户可读取激活的平台配置
CREATE POLICY "platform_configs_select_authenticated"
  ON platform_configs
  FOR SELECT
  TO authenticated
  USING (true);
```

### 服务端 service_role 使用说明

**重要：** API Routes（如 `/api/rewrite`、`/api/rewrite/:id/feedback`）在写入数据库时必须使用 **service_role** 客户端，绕过 RLS。

```typescript
// src/lib/supabase/server.ts 中新增 service_role 客户端（用于服务端写操作）
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

// 注意：此客户端拥有完整权限，只能在服务端使用！
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY, // 使用 service_role key，不是 anon key
  )
}
```

- **普通用户操作**（读取自己的数据）：使用 `createClient()`（基于 session token，受 RLS 约束）
- **服务端写操作**（创建改写记录、写入结果、更新反馈）：使用 `createServiceRoleClient()`（绕过 RLS，完全信任）
- `SUPABASE_SERVICE_ROLE_KEY` 绝不能暴露给前端（已在 `env.ts` 的服务端变量列表中，前缀无 `NEXT_PUBLIC_`）

### Prisma 迁移方式（推荐）

将 RLS SQL 通过 Prisma 迁移文件版本化管理：

```bash
# 创建空迁移文件（不改 schema.prisma）
npx prisma migrate dev --name add-rls-policies --create-only

# 然后在生成的迁移文件中（prisma/migrations/TIMESTAMP_add_rls_policies/migration.sql）
# 将上方完整 SQL 粘贴进去

# 最后应用迁移
npx prisma migrate dev
```

迁移文件路径示例：`prisma/migrations/20260325000000_add_rls_policies/migration.sql`

### 测试 RLS 的 SQL 脚本（在 Supabase SQL Editor 中执行）

```sql
-- 测试步骤 1：以用户 A 的身份设置 JWT（替换为真实 UUID）
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "USER_A_UUID", "role": "authenticated"}';

-- 测试步骤 2：查询 rewrite_records，应只返回 user_id = USER_A_UUID 的记录
SELECT * FROM rewrite_records;

-- 测试步骤 3：尝试查询 user_id = USER_B_UUID 的记录，应返回空
SELECT * FROM rewrite_records WHERE user_id = 'USER_B_UUID';

-- 测试步骤 4：查询 platform_configs，应正常返回（已认证用户可读）
SELECT id, platform, is_active FROM platform_configs;

-- 重置角色
RESET role;
RESET "request.jwt.claims";
```

### 与 Prisma 的关系

- Prisma 负责 schema 结构（建表、字段、索引）
- Supabase RLS 是 PostgreSQL 层的访问控制，Prisma schema 中无法声明
- Prisma 的服务端查询（通过 `@prisma/adapter-pg` 连接池）在生产中使用 `DATABASE_URL`（对应 Supabase 的 pooler 连接），**默认走 service_role 权限**，不受 RLS 限制
- 直接使用 Supabase JS client（`createClient()` / `createServerClient()`）的查询会携带用户 JWT，**受 RLS 限制**
- 建议：数据读取考虑用 Supabase client（自动应用 RLS），数据写入考虑用 Prisma（service_role 权限，绕过 RLS 直接操作）

### 前序 Story 关键教训

来自 Story 1.2 的 Dev Agent Record：

| 教训 | 影响 |
|---|---|
| DATABASE_URL 为占位值，迁移未执行 | 本 Story 必须先完成真实 Supabase 连接配置 |
| Prisma 7.x 使用 `@prisma/adapter-pg`，通过 `PrismaPg` 初始化 | 服务端数据库写入走 Prisma，绕过 RLS |
| `src/lib/supabase/server.ts` 已创建，用于 SSR | 用户读操作通过此客户端，受 RLS 保护 |
| `SUPABASE_SERVICE_ROLE_KEY` 在 env.ts 中已声明为服务端变量 | 创建 service_role 客户端时直接使用 `env.SUPABASE_SERVICE_ROLE_KEY` |

来自 Story 1.1 的教训：
- Next.js 版本为 16.2.1（实际安装版本），Prisma 7.5.0，`@supabase/ssr` 0.9.0
- 每次 `npm install` 后需要 `--include=dev` 保证 devDependencies 正确安装

### Project Structure Notes

本 Story 新增/修改的文件：

```
content-repurposer/
├── prisma/
│   └── migrations/
│       └── TIMESTAMP_add_rls_policies/
│           └── migration.sql          ← 新增：RLS 策略 SQL
├── supabase/
│   └── rls.sql                        ← 新增：RLS 参考脚本（与迁移同步）
├── src/
│   └── lib/
│       └── supabase/
│           └── server.ts              ← 更新：新增 createServiceRoleClient()
└── docs/
    └── ops/
        └── rls-policies.md            ← 新增：RLS 策略文档
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — RLS 策略是核心安全机制，用户数据隔离要求
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — 四张表结构和 user_id 外键关系
- [Source: _bmad-output/planning-artifacts/architecture.md#Service Boundaries] — `src/lib/supabase/` 是唯一数据库访问模块
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3] — Acceptance Criteria（NFR6 用户数据隔离）
- [Source: _bmad-output/implementation-artifacts/1-2-database-schema-supabase.md#Dev Agent Record] — Prisma 7.x 适配细节、迁移未执行问题、service.ts 实现
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — 环境变量通过 env.ts 统一读取

## Review Findings

- [x] [Review][Decision] `platform_configs` SELECT 策略未过滤 `is_active` — 决定保持现状（USING true），应用层过滤 is_active；当前无草稿风险，Story 6.4 管理后台需读全量配置
- [x] [Review][Patch] Migration 文件缺少幂等保护 [`prisma/migrations/20260325000001_add_rls_policies/migration.sql`] — 已修复：每条 CREATE POLICY 前加 DROP POLICY IF EXISTS，确保重复执行不报错
- [x] [Review][Patch] env var 无运行时空值校验 [`src/lib/supabase/server.ts`] — 已修复：模块顶层提取三个 env var 并加 throw new Error 明确提示
- [x] [Review][Defer] `rewrite_results` 策略子查询 N+1 性能隐患 [`supabase/rls.sql`] — 相关子查询对每行执行一次，高并发下性能下降；标准 RLS 模式，优化属架构迭代范畴 — deferred, pre-existing architecture concern
- [x] [Review][Defer] `users` 无 DELETE 策略（账号注销场景未覆盖）[`supabase/rls.sql`] — Story 1.3 未涉及账号注销需求，留待后续 Story 处理 — deferred, out of story scope
- [x] [Review][Defer] `rewrite_records` 删除级联风险（依赖 Story 1.2 schema FK 定义）[`supabase/rls.sql`] — 若 `rewrite_results.record_id` FK 无 `ON DELETE CASCADE`，用户删除 `rewrite_records` 将触发 FK 违约；需与 Story 1.2 schema 确认 — deferred, cross-story dependency
- [x] [Review][Defer] `createServiceRoleClient` 与普通 client 同文件 — 未来误用风险 [`src/lib/supabase/server.ts`] — 可拆分为独立模块加强隔离，当前故事范围内可接受 — deferred, architecture refactor
- [x] [Review][Defer] `rewrite_records_update_own` 允许修改不可变字段（无列级安全）[`supabase/rls.sql`] — 用户可变更 `original_text` 等历史不可变字段，列级安全超出本 Story 范围 — deferred, column-level security out of scope
- [x] [Review][Defer] `rewrite_results_update_own` TOCTOU 竞态 [`supabase/rls.sql`] — READ COMMITTED 下理论竞态，实际风险极低 — deferred, theoretical race condition
- [x] [Review][Defer] `createServiceRoleClient` 使用 `process.env` 而非 `env.ts`（Dev Notes 偏差）[`src/lib/supabase/server.ts`] — 已在 Dev Agent Record 记录原因（循环依赖），`env.ts` 启动校验提供兜底 — deferred, documented design decision

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **DATABASE_URL 为占位值** — `npx prisma migrate dev --create-only` 在无真实 DB 连接时无法执行。采用手动创建迁移目录和 SQL 文件的方式（与 Story 1.2 的处理方式一致）。待用户配置真实 Supabase 连接后，执行 `npx prisma migrate deploy` 应用迁移。
- **createServiceRoleClient 使用 process.env 直接读取** — Dev Notes 示例中使用了 `import { env } from '@/lib/env'`，但 `env.ts` 有 `server-only` 守卫，在 `src/lib/supabase/server.ts` 中引入会产生循环依赖风险。改用 `process.env.SUPABASE_SERVICE_ROLE_KEY!`（与 `createClient()` 中的 `NEXT_PUBLIC_*` 处理方式一致），安全性由 `env.ts` 在服务端启动时校验保证。

### Completion Notes List

- ✅ `supabase/rls.sql` 参考脚本创建，包含四张表的完整 RLS 策略（启用 RLS + 策略定义）
- ✅ `prisma/migrations/20260325000001_add_rls_policies/migration.sql` 迁移文件手动创建，内容与 rls.sql 一致
- ✅ `src/lib/supabase/server.ts` 新增 `createServiceRoleClient()`，供 API Routes 绕过 RLS 进行写操作
- ✅ `docs/ops/rls-policies.md` 文档创建，包含策略表格、架构说明、使用规范和验证方法
- ✅ `npx tsc --noEmit` 零错误（TypeScript 类型检查通过）
- ⚠️ 任务1（前置确认）和任务4（Dashboard 验证）需要真实 Supabase 连接后执行，当前 DATABASE_URL 为占位值，已延迟

### File List

- supabase/rls.sql（新建）
- prisma/migrations/20260325000001_add_rls_policies/migration.sql（新建）
- src/lib/supabase/server.ts（更新：新增 createServiceRoleClient()）
- docs/ops/rls-policies.md（新建）
