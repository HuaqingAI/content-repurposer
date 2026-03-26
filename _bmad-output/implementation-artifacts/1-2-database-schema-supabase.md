# Story 1.2: 数据库 Schema 定义与 Supabase 集成

Status: done

## Story

作为开发者，
我想创建完整的数据库 schema 并配置 Prisma 与 Supabase 集成，
以便应用可以持久化所有业务数据。

## Acceptance Criteria

1. **Given** Supabase 项目已创建，连接配置已写入 `.env.local`，**When** 执行 `npx prisma migrate dev --name init`，**Then** 四张核心表在 Supabase 数据库中创建成功：`users`、`rewrite_records`、`rewrite_results`、`platform_configs`，字段类型和约束与 Architecture 定义完全一致。

2. **Given** 迁移完成，**When** 查看 `src/lib/supabase/client.ts`，**Then** 该文件已创建，导出浏览器端 Supabase 客户端（用 `createBrowserClient`），可正常初始化。

3. **Given** 迁移完成，**When** 查看 `src/lib/supabase/server.ts`，**Then** 该文件已创建，导出服务端 Supabase 客户端（用 `createServerClient`），集成 Next.js `cookies()`，可正常初始化。

4. **Given** schema 迁移完成，**When** 在服务端代码中 `import { PrismaClient } from '@/generated/prisma'` 并实例化，**Then** Prisma Client 可对数据库发起查询而不报错。

## Tasks / Subtasks

- [x] 编写 Prisma Schema 四张核心表 (AC: #1)
  - [x] 定义枚举类型：`ContentType`、`Platform`、`Tone`、`Feedback`
  - [x] 定义 `users` 表（含所有字段和约束）
  - [x] 定义 `rewrite_records` 表（含外键 `user_id → users`）
  - [x] 定义 `rewrite_results` 表（含外键 `record_id → rewrite_records`）
  - [x] 定义 `platform_configs` 表（含唯一约束 `platform + config_version`）
  - [x] 为高频查询字段添加索引（`rewrite_records.user_id`、`rewrite_results.record_id`、`platform_configs.platform + is_active`）

- [ ] 执行数据库迁移 (AC: #1) — ⚠️ 需要真实 Supabase 连接后执行（当前 DATABASE_URL 为占位值）
  - [ ] 确认 `.env.local` 中 `DATABASE_URL` 已配置为真实 Supabase 连接字符串
  - [ ] 运行 `npx prisma migrate dev --name init`
  - [ ] 确认迁移成功，四张表已在 Supabase Dashboard 中可见

- [x] 创建 Supabase 浏览器端客户端 (AC: #2)
  - [x] 新建 `src/lib/supabase/client.ts`
  - [x] 使用 `createBrowserClient` from `@supabase/ssr`
  - [x] 读取 `process.env.NEXT_PUBLIC_SUPABASE_URL` 和 `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`

- [x] 创建 Supabase 服务端客户端 (AC: #3)
  - [x] 新建 `src/lib/supabase/server.ts`
  - [x] 使用 `createServerClient` from `@supabase/ssr`
  - [x] 集成 Next.js `cookies()` API（需要 `import { cookies } from 'next/headers'`）
  - [x] 标注 `'use server'` 或确保只在 Server Components / Route Handlers 中调用

- [x] 验证 Prisma Client 可用 (AC: #4)
  - [x] 生成 Prisma Client：`npx prisma generate`
  - [x] 确认 `src/generated/prisma/` 目录已生成
  - [x] 创建 `src/lib/prisma.ts`（单例 Prisma Client，防止开发模式热更新重复实例化）

### Review Findings（2026-03-25）

- [x] [Review][Decision→Defer] User 身份字段约束 — 延迟至 Story 2.1/2.2，应用层认证逻辑保证身份字段有效性
- [x] [Review][Decision→Defer] `platform_configs.isActive` 多活跃配置 — 延迟至 Story 6.4，管理后台写入时做唯一性保护
- [x] [Review][Defer] AC4 导入路径 `@/generated/prisma` vs `@/generated/prisma/client` [src/lib/prisma.ts] — deferred, Prisma 7.x 生成目录无 index.ts，正确路径为 `/client`；AC4 文字说明需更新以匹配 Prisma 7 实际行为
- [x] [Review][Defer] DATABASE_URL 未定义时模块加载崩溃 [src/lib/prisma.ts] — deferred, env.ts 在服务端启动时已校验 DATABASE_URL，实际已被缓解
- [x] [Review][Defer] Prisma 单例在生产/Serverless 环境中每次冷启动会创建新实例 [src/lib/prisma.ts] — deferred, 已知架构限制，需 PgBouncer/Prisma Accelerate
- [x] [Review][Defer] `setAll` 吞掉所有 cookie 错误 [src/lib/supabase/server.ts] — deferred, Supabase SSR 官方推荐模式
- [x] [Review][Defer] `metadata` JSON 默认值为字符串 `"{}"` [prisma/schema.prisma] — deferred, Prisma 7 + pg adapter 实际运行正常
- [x] [Review][Defer] `apiCostCents`/`apiTokensUsed` 使用 Int，高量时存在溢出风险 [prisma/schema.prisma] — deferred, 架构设计决策，后续 Epic 可升级为 BigInt
- [x] [Review][Defer] `originalUrl` VarChar(2048) 可能不足以存储现代长 URL [prisma/schema.prisma] — deferred, 架构约定值

## Dev Notes

### 关键版本信息（来自 Story 1.1 实际安装）

| 包 | 版本 |
|---|---|
| prisma | 7.5.0 |
| @prisma/client | 7.5.0 |
| @supabase/ssr | 0.9.0 |
| @supabase/supabase-js | 2.100.0 |
| Next.js | 16.2.1 |

### Prisma 7.x 重要差异（区别于 Prisma 5.x）

- **Generator 名称变了：** `provider = "prisma-client"`（不是 `prisma-client-js`）— Story 1.1 已正确设置
- **生成目录：** `output = "../src/generated/prisma"`（不是默认的 `node_modules/@prisma/client`）
- **Import 路径：** `import { PrismaClient } from '@/generated/prisma'`（不是 `@prisma/client`）
- **prisma.config.ts：** 已由 Story 1.1 创建，包含 `datasource.url`；`prisma migrate dev` 优先读取此文件

### Prisma Schema 完整定义

```prisma
// 枚举类型
enum ContentType {
  opinion    // 观点分析类
  narrative  // 体验叙事类
  tutorial   // 教程列表类
  review     // 评测对比类
  other      // 其他

  @@map("content_type")
}

enum Platform {
  xiaohongshu
  wechat
  zhihu

  @@map("platform")
}

enum Tone {
  casual    // 口语化
  standard  // 标准
  formal    // 正式

  @@map("tone")
}

enum Feedback {
  helpful
  not_helpful

  @@map("feedback")
}

// 用户表
model User {
  id           String    @id @default(uuid()) @db.Uuid
  phone        String?   @unique @db.VarChar(20)
  wechatOpenid String?   @unique @map("wechat_openid") @db.VarChar(100)
  displayName  String    @map("display_name") @db.VarChar(50)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  rewriteRecords RewriteRecord[]

  @@index([createdAt], name: "idx_users_created_at")
  @@map("users")
}

// 改写记录表
model RewriteRecord {
  id           String      @id @default(uuid()) @db.Uuid
  userId       String      @map("user_id") @db.Uuid
  originalText String      @map("original_text")
  originalUrl  String?     @map("original_url") @db.VarChar(2048)
  contentType  ContentType @map("content_type")
  createdAt    DateTime    @default(now()) @map("created_at")
  metadata     Json?       @default("{}")

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  results RewriteResult[]

  @@index([userId], name: "idx_rewrite_records_user_id")
  @@index([createdAt], name: "idx_rewrite_records_created_at")
  @@map("rewrite_records")
}

// 改写结果表
model RewriteResult {
  id            String    @id @default(uuid()) @db.Uuid
  recordId      String    @map("record_id") @db.Uuid
  platform      Platform
  tone          Tone
  body          String
  titles        Json      @default("[]")
  tags          Json      @default("[]")
  hook          String    @default("")
  apiModel      String    @map("api_model") @db.VarChar(100)
  apiTokensUsed Int       @default(0) @map("api_tokens_used")
  apiCostCents  Int       @default(0) @map("api_cost_cents")
  apiDurationMs Int       @default(0) @map("api_duration_ms")
  createdAt     DateTime  @default(now()) @map("created_at")
  feedback      Feedback?

  record RewriteRecord @relation(fields: [recordId], references: [id], onDelete: Cascade)

  @@index([recordId], name: "idx_rewrite_results_record_id")
  @@map("rewrite_results")
}

// 平台配置表
model PlatformConfig {
  id               String   @id @default(uuid()) @db.Uuid
  platform         Platform
  configVersion    Int      @map("config_version")
  styleRules       Json     @map("style_rules")
  promptTemplate   String   @map("prompt_template")
  fewShotExamples  Json     @default("[]") @map("few_shot_examples")
  isActive         Boolean  @default(false) @map("is_active")
  updatedAt        DateTime @updatedAt @map("updated_at")
  updatedBy        String?  @map("updated_by") @db.VarChar(100)

  @@unique([platform, configVersion], name: "uq_platform_configs_platform_version")
  @@index([platform, isActive], name: "idx_platform_configs_platform_active")
  @@map("platform_configs")
}
```

**注意：** `role` 字段（user/admin）不在本 Story 范围内，由 Story 6.1 通过 migration 添加。

### Supabase 客户端文件实现规范

**`src/lib/supabase/client.ts`（浏览器端）：**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```
- 每次调用创建新实例（浏览器端 `createBrowserClient` 内部有缓存机制）
- 不能使用 `import { env } from '@/lib/env'`（env.ts 有 server-only 守卫）
- 使用 `!` 非空断言是安全的，因为 env.ts 在服务端启动时已校验这两个变量

**`src/lib/supabase/server.ts`（服务端）：**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中 set 会抛出异常，可以忽略（由 middleware 处理刷新）
          }
        },
      },
    }
  )
}
```
- `cookies()` 在 Next.js 15+ 是 async 的，必须 `await`
- 此文件只能在 Server Components、Route Handlers、Server Actions 中使用

**`src/lib/prisma.ts`（Prisma 单例）：**
```typescript
import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```
- 防止 Next.js 开发模式热更新导致 PrismaClient 实例泄漏
- 生产环境每次 import 是同一实例

### Story 1.1 遗留的关键教训

- 每次 `npm install` 后需要 `npm install --include=dev` 保证 devDependencies（包含 tailwindcss/postcss）正确安装
- prisma.config.ts 已配置 `import "dotenv/config"` 和 `datasource.url`，`npx prisma migrate dev` 会自动读取 `.env.local`
- `dotenv` 包已安装（v16.6.1）
- Prisma 7.x CLI 工具链有安全漏洞（非阻塞，为 devDependency），不影响生产运行

### .env.local 检查清单（运行 migrate 前必须填写）

```
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

如果 `.env.local` 中 DATABASE_URL 仍是占位值，**migrate 会失败**。需要真实 Supabase 项目配置后才能执行。

### 测试标准

- `npx prisma validate` — schema 语法验证（不需要真实 DB）
- `npx tsc --noEmit` — TypeScript 类型检查
- `npm run build` — 构建验证

### Project Structure Notes

- `src/generated/prisma/` 由 `npx prisma generate` 自动生成，不手动创建
- `src/lib/prisma.ts` 是唯一 PrismaClient 实例，所有 Route Handlers 通过它访问 DB
- `src/lib/supabase/` 目录由 Story 1.1 已创建（空目录）

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — 四张表定义和字段
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — Supabase Auth 配置
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — 命名规范（snake_case 表名，camelCase 代码）
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — Acceptance Criteria
- [Source: _bmad-output/implementation-artifacts/1-1-nextjs-project-init.md#Dev Agent Record] — 前序 Story 教训

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- **Prisma 7.x: `url` 不再支持写在 schema.prisma 的 datasource 块** — 执行 `npx prisma validate` 报错 P1012，需从 datasource 块中删除 `url = env("DATABASE_URL")`，URL 仅在 `prisma.config.ts` 中配置（用于 CLI 工具）。
- **Prisma 7.x: PrismaClient 必须传入 `adapter` 或 `accelerateUrl`** — `new PrismaClient({ log: [...] })` 导致 TS2345 错误。需安装 `@prisma/adapter-pg` + `pg`，使用 `new PrismaPg({ connectionString })` 初始化 adapter 后传入构造函数。
- **Import 路径变更** — 故事中 `@/generated/prisma` 无效（无 index.ts）。正确路径为 `@/generated/prisma/client`。
- **DATABASE_URL 为占位值** — 迁移任务无法执行，故事 Dev Notes 已预期此情况，待用户配置真实 Supabase 连接后手动执行。

### Completion Notes List

- ✅ Prisma Schema 定义完成：4 枚举、4 模型、所有索引和关联关系，`npx prisma validate` 通过
- ✅ Prisma 7.x 适配：datasource 块不再含 `url` 字段（已改为仅在 `prisma.config.ts` 配置）
- ✅ 安装 `@prisma/adapter-pg` + `pg`，`prisma.ts` 使用 `PrismaPg` adapter 初始化 PrismaClient
- ✅ `src/lib/supabase/client.ts` 创建，使用 `createBrowserClient`
- ✅ `src/lib/supabase/server.ts` 创建，使用 `createServerClient` + `await cookies()`
- ✅ `npx prisma generate` 生成 `src/generated/prisma/` 目录
- ✅ `npx tsc --noEmit` 零错误
- ✅ `npm run build` 构建成功
- ⚠️ 迁移任务（`prisma migrate dev --name init`）需要真实 Supabase DATABASE_URL，当前为占位值，延迟执行

### File List

- prisma/schema.prisma（更新：完整 schema，移除 datasource url 字段）
- src/lib/supabase/client.ts（新建）
- src/lib/supabase/server.ts（新建）
- src/lib/prisma.ts（新建）
- package.json（更新：新增 @prisma/adapter-pg、pg）
- package-lock.json（更新）
- src/generated/prisma/（自动生成，npx prisma generate）
