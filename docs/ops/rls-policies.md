# Row Level Security (RLS) 策略说明

## 概述

content-repurposer 使用 Supabase PostgreSQL 的 Row Level Security (RLS) 机制实现用户数据隔离，确保用户只能访问自己的数据（满足 NFR6）。

所有 RLS 策略通过 Prisma 迁移文件版本化管理：
- 迁移文件：`prisma/migrations/20260325000001_add_rls_policies/migration.sql`
- 参考脚本：`supabase/rls.sql`

## 关键架构约束

`users.id` 必须等于 Supabase Auth 的 `auth.uid()`。Story 2.1/2.2 在创建用户记录时，`id` 字段必须从 Supabase Auth 获取，不得随机生成。

```typescript
// Story 2.1/2.2 创建用户时的正确方式
const { data: { user } } = await supabase.auth.getUser()
await prisma.user.create({
  data: {
    id: user.id,  // ✅ 必须等于 auth.uid()
    phone: user.phone,
    displayName: '...',
  }
})
```

## 各表策略详情

### users 表

| 策略名 | 操作 | 条件 | 说明 |
|---|---|---|---|
| `users_select_own` | SELECT | `auth.uid() = id` | 用户只能读取自己的记录 |
| `users_update_own` | UPDATE | `auth.uid() = id` | 用户只能修改自己的记录（display_name 等） |

**INSERT**：不开放给普通用户，由服务端 service_role 在用户首次登录时创建（Story 2.1/2.2）。

### rewrite_records 表

| 策略名 | 操作 | 条件 | 说明 |
|---|---|---|---|
| `rewrite_records_select_own` | SELECT | `auth.uid() = user_id` | 用户只能读取自己发起的改写记录 |
| `rewrite_records_insert_own` | INSERT | `auth.uid() = user_id` | 创建记录时 user_id 必须等于当前用户 |
| `rewrite_records_update_own` | UPDATE | `auth.uid() = user_id` | 用户只能更新自己的记录 |
| `rewrite_records_delete_own` | DELETE | `auth.uid() = user_id` | 用户只能删除自己的记录 |

### rewrite_results 表

| 策略名 | 操作 | 条件 | 说明 |
|---|---|---|---|
| `rewrite_results_select_own` | SELECT | 通过 JOIN rewrite_records 验证 user_id | 用户只能读取属于自己的改写结果 |
| `rewrite_results_update_own` | UPDATE | 通过 JOIN rewrite_records 验证 user_id | 用于提交反馈（feedback 字段） |

**INSERT/DELETE**：由服务端 service_role 完成（改写 API 写入结果），不对普通用户开放。

### platform_configs 表

| 策略名 | 操作 | 条件 | 说明 |
|---|---|---|---|
| `platform_configs_select_authenticated` | SELECT | `true`（所有已认证用户） | 改写引擎需要读取平台配置 |

**写入**：不对普通用户开放，由管理员通过 service_role 完成（Story 6.4）。

## 客户端使用规范

### 普通用户操作（受 RLS 保护）

```typescript
// src/lib/supabase/server.ts
import { createClient } from '@/lib/supabase/server'

// 读取自己的数据 - 自动应用 RLS
const supabase = await createClient()
const { data } = await supabase
  .from('rewrite_records')
  .select('*')
  // 不需要 .eq('user_id', userId) - RLS 自动过滤
```

### 服务端写操作（绕过 RLS）

```typescript
// src/lib/supabase/server.ts
import { createServiceRoleClient } from '@/lib/supabase/server'

// 写入改写结果 - 使用 service_role 绕过 RLS
const supabase = createServiceRoleClient()
await supabase.from('rewrite_results').insert({
  record_id: recordId,
  platform: 'xiaohongshu',
  // ...
})
```

**安全注意事项：**
- `createServiceRoleClient()` 只能在 API Routes 和 Server Actions 中使用
- `SUPABASE_SERVICE_ROLE_KEY` 不能出现在任何客户端代码中（无 `NEXT_PUBLIC_` 前缀保证这一点）

## 应用迁移

```bash
# 连接到真实 Supabase 项目后执行
npx prisma migrate deploy
```

或在 Supabase Dashboard > SQL Editor 中直接执行 `supabase/rls.sql`。

## 验证 RLS 是否生效

在 Supabase Dashboard > SQL Editor 中运行：

```sql
-- 以用户 A 的身份模拟查询（替换 USER_A_UUID 为真实 UUID）
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "USER_A_UUID", "role": "authenticated"}';

-- 应只返回 user_id = USER_A_UUID 的记录
SELECT id, user_id FROM rewrite_records;

-- 应返回空（用户 B 的数据不可见）
SELECT id FROM rewrite_records WHERE user_id = 'USER_B_UUID';

-- 已认证用户可读取 platform_configs
SELECT id, platform, is_active FROM platform_configs;

RESET role;
RESET "request.jwt.claims";
```

在 Supabase Dashboard > Authentication > Policies 页面可视化确认四张表均显示 RLS Enabled。
