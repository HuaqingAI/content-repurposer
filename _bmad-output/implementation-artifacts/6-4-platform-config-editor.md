# Story 6.4：平台规则配置编辑器

Status: done

## Story

作为运营团队，
我想在管理后台修改三个平台的 prompt 模板和风格规则，
以便平台规则变化时无需修改代码即可更新改写策略。

## Acceptance Criteria

1. **Given** 管理员访问 `/admin/platform-configs`，**When** 页面加载完成，**Then** 展示三个平台（小红书/公众号/知乎）的当前激活配置，包含 `style_rules`、`prompt_template`、`few_shot_examples` 字段
2. **Given** 管理员编辑了某平台的任意字段并点击保存，**When** 保存成功，**Then** 新的改写请求立即使用更新后的配置（热更新，满足 ARCH8）——无需重启服务，因为 Prompt Assembler 每次从 DB 读取激活配置
3. **Given** 管理员保存了某平台配置，**When** 写入成功，**Then** 自动创建新版本记录（`config_version` 递增），旧版本记录 `is_active = false`，新版本 `is_active = true`，历史版本保留可查
4. **Given** 管理员保存配置，**When** 写入 DB，**Then** `updated_by` 字段记录当前管理员的用户 ID
5. **Given** 非管理员用户请求 `GET /api/admin/platform-configs` 或 `PUT /api/admin/platform-configs`，**Then** 返回 403

## Tasks / Subtasks

- [x] 任务 1：扩展 `admin-service.ts` — 添加平台配置查询与更新函数（AC: #1, #2, #3, #4）
  - [x] 1.1 添加 `getPlatformConfigs()` 函数：查询三个平台各自当前激活配置（`isActive: true`），返回 `PlatformConfigItem[]`
  - [x] 1.2 添加 `updatePlatformConfig(platform, fields, updatedBy)` 函数：在事务中递增版本、创建新记录（isActive: true）、将旧激活记录设为 isActive: false

- [x] 任务 2：创建管理后台平台配置 API（AC: #1, #2, #3, #4, #5）
  - [x] 2.1 创建 `src/app/api/admin/platform-configs/route.ts`，实现 `GET /api/admin/platform-configs`（返回三平台激活配置）
  - [x] 2.2 在同文件实现 `PUT /api/admin/platform-configs`（接收 `{ platform, styleRules, promptTemplate, fewShotExamples }`，调用 updatePlatformConfig）
  - [x] 2.3 两个方法均在内部校验 admin 权限（Prisma 直连，继承 Story 6.3 模式）

- [x] 任务 3：创建平台配置编辑器前端组件（AC: #1, #2）
  - [x] 3.1 创建 `src/features/admin/platform-config-editor.tsx`（Client Component）：tab 切换三平台，每个 tab 展示并可编辑 `prompt_template`（textarea）、`style_rules`（JSON textarea）、`few_shot_examples`（JSON textarea），含版本号展示和保存按钮
  - [x] 3.2 保存时调用 `PUT /api/admin/platform-configs`，展示 loading/成功/错误状态

- [x] 任务 4：创建平台配置管理页面（AC: #1）
  - [x] 4.1 创建 `src/app/admin/platform-configs/page.tsx`（Server Component）：渲染 `<PlatformConfigEditor />`

- [x] 任务 5：编写测试（AC: #1, #2, #3, #5）
  - [x] 5.1 创建 `src/app/api/admin/platform-configs/__tests__/route.test.ts`：覆盖 GET（401/503/403/200）、PUT（401/403/400/200）场景，10 个测试全部通过

## Dev Notes

### 关键架构背景

**热更新机制（ARCH8）：**

Prompt Assembler（`src/lib/llm/prompt-assembler.ts`）每次调用时从 DB 查询当前激活的 `platform_configs`，不使用内存缓存。因此只需在 DB 中将新版本设为 `is_active = true`、旧版本设为 `is_active = false`，后续改写请求即自动使用新配置，无需重启服务。

**版本管理策略：**

每次保存不覆盖旧记录，而是创建新版本：
- 查询当前平台最大 `configVersion`（含非激活版本）
- 新记录 `configVersion = maxVersion + 1`，`isActive = true`
- 旧激活记录 `isActive = false`
- 使用 `prisma.$transaction` 保证原子性

**Admin API 权限校验模式（继承自 Story 6.3）：**

```typescript
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/enums'

// 1. Supabase Auth 认证
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError) {
  return Response.json({ data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } }, { status: 503 })
}
if (!user) {
  return Response.json({ data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 })
}

// 2. Prisma 直连校验 admin role（绕过 RLS）
const dbUser = await prisma.user.findUnique({
  where: { id: user.id },
  select: { role: true },
})
if (!dbUser || dbUser.role !== UserRole.admin) {
  return Response.json({ data: null, error: { code: 'FORBIDDEN', message: '无权限' } }, { status: 403 })
}
```

**Prisma 相关规范（全局约定）：**
- Import：`import { prisma } from '@/lib/prisma'`
- 枚举从 `@/generated/prisma/enums` 单独导入：`import { UserRole, Platform } from '@/generated/prisma/enums'`
- `@/generated/prisma` 无 `index.ts`，不能直接 `import { ... } from '@/generated/prisma'`
- server-only 文件加 `import 'server-only'`

**PlatformConfig 数据模型（`prisma/schema.prisma`）：**

```prisma
model PlatformConfig {
  id               String   @id @default(uuid()) @db.Uuid
  platform         Platform                          // 枚举: xiaohongshu | wechat | zhihu
  configVersion    Int      @map("config_version")
  styleRules       Json     @map("style_rules")      // JSONB 对象
  promptTemplate   String   @map("prompt_template")  // 纯文本 prompt
  fewShotExamples  Json     @default("[]") @map("few_shot_examples")  // JSONB 数组
  isActive         Boolean  @default(false) @map("is_active")
  updatedAt        DateTime @updatedAt @map("updated_at")
  updatedBy        String?  @map("updated_by") @db.VarChar(100)

  @@unique([platform, configVersion], name: "uq_platform_configs_platform_version")
  @@index([platform, isActive], name: "idx_platform_configs_platform_active")
  @@map("platform_configs")
}
```

### admin-service.ts 扩展

**新增类型和函数：**

```typescript
export type PlatformConfigItem = {
  id: string
  platform: string
  configVersion: number
  styleRules: unknown        // JSON object
  promptTemplate: string
  fewShotExamples: unknown   // JSON array
  isActive: boolean
  updatedAt: Date
  updatedBy: string | null
}

export async function getPlatformConfigs(): Promise<PlatformConfigItem[]> {
  const configs = await prisma.platformConfig.findMany({
    where: { isActive: true },
    orderBy: { platform: 'asc' },
  })
  return configs.map((c) => ({
    id: c.id,
    platform: c.platform,
    configVersion: c.configVersion,
    styleRules: c.styleRules,
    promptTemplate: c.promptTemplate,
    fewShotExamples: c.fewShotExamples,
    isActive: c.isActive,
    updatedAt: c.updatedAt,
    updatedBy: c.updatedBy,
  }))
}

export async function updatePlatformConfig(
  platform: Platform,
  fields: {
    styleRules: unknown
    promptTemplate: string
    fewShotExamples: unknown
  },
  updatedBy: string
): Promise<PlatformConfigItem> {
  // 查最大版本号（含非激活）
  const maxVersionResult = await prisma.platformConfig.aggregate({
    where: { platform },
    _max: { configVersion: true },
  })
  const nextVersion = (maxVersionResult._max.configVersion ?? 0) + 1

  const [, newConfig] = await prisma.$transaction([
    // 停用旧激活版本
    prisma.platformConfig.updateMany({
      where: { platform, isActive: true },
      data: { isActive: false },
    }),
    // 创建新版本
    prisma.platformConfig.create({
      data: {
        platform,
        configVersion: nextVersion,
        styleRules: fields.styleRules as object,  // Prisma Json 类型
        promptTemplate: fields.promptTemplate,
        fewShotExamples: fields.fewShotExamples as object,
        isActive: true,
        updatedBy,
      },
    }),
  ])

  return {
    id: newConfig.id,
    platform: newConfig.platform,
    configVersion: newConfig.configVersion,
    styleRules: newConfig.styleRules,
    promptTemplate: newConfig.promptTemplate,
    fewShotExamples: newConfig.fewShotExamples,
    isActive: newConfig.isActive,
    updatedAt: newConfig.updatedAt,
    updatedBy: newConfig.updatedBy,
  }
}
```

### API 路由规范

**GET `/api/admin/platform-configs`：**
- 无 Query 参数
- 响应：`{ data: { configs: PlatformConfigItem[] }, error: null }`
- 若某平台无激活配置（初始未 seed），返回空数组条目（不报错）

**PUT `/api/admin/platform-configs`：**
- Body：`{ platform: "xiaohongshu" | "wechat" | "zhihu", styleRules: object, promptTemplate: string, fewShotExamples: array }`
- 校验：platform 必须是有效枚举值；promptTemplate 不能为空字符串
- `updatedBy` 取 `user.id`（Supabase Auth 的 UUID）
- 响应：`{ data: { id, platform, configVersion }, error: null }`
- 错误：platform 无效返回 400；promptTemplate 为空返回 400

### 前端组件（platform-config-editor.tsx）

**组件结构：**
- Client Component（`'use client'`）
- `useEffect` 初始加载调用 `GET /api/admin/platform-configs`
- Tab 切换三平台（小红书 / 微信公众号 / 知乎）
- 每个 tab 内展示：
  - 版本号 badge（`v{configVersion}`）
  - `prompt_template`：`<textarea>` 多行编辑（行数较多，min-h-[200px]）
  - `style_rules`：`<textarea>` JSON 格式编辑（用户看到格式化 JSON，提交前 `JSON.parse` 校验）
  - `few_shot_examples`：`<textarea>` JSON 格式编辑（同上）
- 每个 tab 独立"保存"按钮，保存时显示 loading，成功后更新版本号
- JSON 格式错误时保存前提示错误，不发送请求
- UI 风格：与 `dashboard-stats.tsx` 和 `user-table.tsx` 保持一致（Tailwind CSS，简洁卡片风格）

**状态管理：**
```typescript
type ConfigState = {
  [platform: string]: {
    id: string
    configVersion: number
    styleRules: string      // JSON string (用于 textarea)
    promptTemplate: string
    fewShotExamples: string // JSON string (用于 textarea)
    updatedAt: Date | null
    saving: boolean
    error: string | null
    success: boolean
  }
}
```

### 现有文件结构（本 story 需要了解）

```
src/
├── features/admin/
│   ├── admin-service.ts       ← 本 story 扩展：添加 getPlatformConfigs, updatePlatformConfig
│   ├── dashboard-stats.tsx    ← 已存在，参考 UI 风格
│   └── user-table.tsx         ← 已存在（Story 6.3），参考 UI 风格
├── app/
│   ├── admin/
│   │   ├── layout.tsx         ← 已存在（Story 6.1），管理后台布局
│   │   ├── page.tsx           ← 已存在，仪表盘
│   │   └── users/
│   │       └── page.tsx       ← 已存在（Story 6.3）
│   └── api/admin/
│       ├── dashboard/
│       │   └── route.ts       ← 已存在，参考权限校验模式
│       └── users/
│           └── route.ts       ← 已存在（Story 6.3），参考权限校验模式
└── proxy.ts                   ← 已存在，保护 /admin/* 页面路由
```

### 测试规范

参考 `src/app/api/admin/users/__tests__/route.test.ts` 的测试模式：
- mock `@/lib/supabase/server` 的 `createClient`
- mock `@/lib/prisma` 的 `prisma`
- GET 测试用例：未认证(401)、Supabase 报错(503)、非 admin(403)、正常查询(200)
- PUT 测试用例：未认证(401)、非 admin(403)、无效 platform(400)、空 promptTemplate(400)、正常保存(200)

### Project Structure Notes

**本 story 新增/修改文件：**

```
src/
├── features/admin/
│   └── admin-service.ts                               ← 修改：添加 getPlatformConfigs, updatePlatformConfig
├── app/
│   ├── admin/
│   │   └── platform-configs/
│   │       └── page.tsx                               ← 新增：平台配置管理页
│   └── api/admin/
│       └── platform-configs/
│           ├── route.ts                               ← 新增：GET + PUT
│           └── __tests__/
│               └── route.test.ts                      ← 新增：API 测试
└── features/admin/
    └── platform-config-editor.tsx                     ← 新增：平台配置编辑器组件
```

### References

- Story 6.3 Dev Notes（6-3-user-management.md）：admin API 权限校验模式、Prisma 枚举导入、Next.js 16 params Promise
- `src/app/api/admin/users/route.ts`：参考权限校验代码（Prisma 直连版）
- `src/features/admin/admin-service.ts`：参考现有 service 结构
- `prisma/schema.prisma`：PlatformConfig model 完整字段定义
- Architecture.md：FR30（平台规则配置更新）、ARCH8（热更新）、管理后台目录结构
- `src/app/admin/users/page.tsx`：参考 Server Component 页面结构

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

无特殊调试问题。

### Completion Notes List

- `src/features/admin/admin-service.ts`：添加 `PlatformConfigItem` 类型、`getPlatformConfigs`（查激活配置）、`updatePlatformConfig`（prisma.$transaction：停用旧版本 + 创建新版本，updatedBy 记录操作人）
- `src/app/api/admin/platform-configs/route.ts`：GET（返回三平台激活配置）+ PUT（校验 platform 枚举 + promptTemplate 非空，调用 updatePlatformConfig）；均经过 Prisma 直连 admin 权限校验
- `src/features/admin/platform-config-editor.tsx`：Client Component，tab 切换三平台，三个 textarea 字段（promptTemplate/styleRules/fewShotExamples），保存前 JSON.parse 校验，版本号展示，loading/成功/错误状态
- `src/app/admin/platform-configs/page.tsx`：Server Component，渲染 PlatformConfigEditor
- `src/app/api/admin/platform-configs/__tests__/route.test.ts`：10 个测试用例全部通过（GET 4 个，PUT 6 个）
- 回归测试：113 个用例通过；2 个预存在失败套件（content-package.test.tsx、users/__tests__/route.test.ts）与本 story 无关，Story 6.3 前已存在

### File List

- `src/features/admin/admin-service.ts`（修改：添加 getPlatformConfigs, updatePlatformConfig）
- `src/app/api/admin/platform-configs/route.ts`（新增）
- `src/app/api/admin/platform-configs/__tests__/route.test.ts`（新增）
- `src/features/admin/platform-config-editor.tsx`（新增）
- `src/app/admin/platform-configs/page.tsx`（新增）
- `_bmad-output/implementation-artifacts/6-4-platform-config-editor.md`（本文件）
- `_bmad-output/implementation-artifacts/sprint-status.yaml`（状态更新）

### Review Findings

- [x] [Review][Decision] AC3 "历史版本保留可查" — 已确认：DB 保留即满足，无需 UI/API，当前实现符合 AC3
- [x] [Review][Patch] TOCTOU：版本号计算在事务外导致并发冲突 [src/features/admin/admin-service.ts: updatePlatformConfig] — 已修复：换用交互式 $transaction(async tx => {})
- [x] [Review][Patch] PUT body 为 null/primitive 时解构未捕获 TypeError [src/app/api/admin/platform-configs/route.ts: PUT] — 已修复：加对象类型守卫
- [x] [Review][Patch] `fewShotExamples` 未在 API 层校验为数组类型 [src/app/api/admin/platform-configs/route.ts: PUT] — 已修复：加 Array.isArray 校验
- [x] [Review][Patch] `styleRules` 未在 API 层校验为对象类型 [src/app/api/admin/platform-configs/route.ts: PUT] — 已修复：加对象类型校验
- [x] [Review][Patch] `updatedAt` 保存成功后取客户端时间而非服务端返回值 [src/features/admin/platform-config-editor.tsx: handleSave] — 已修复：API 响应增加 updatedAt，前端从响应中读取
- [x] [Review][Defer] `promptTemplate` 无最大长度限制 [src/app/api/admin/platform-configs/route.ts] — deferred, 安全加固超出本 story 范围，admin 是可信用户
- [x] [Review][Defer] `VALID_PLATFORMS` 硬编码 vs 枚举动态派生 [src/app/api/admin/platform-configs/route.ts] — deferred, 三个平台稳定，新平台上线时需整体评估
- [x] [Review][Defer] `saving` 在 res.json() 抛出后可能永久锁死 [src/features/admin/platform-config-editor.tsx] — deferred, 极罕见边界，服务端 5xx 时非 JSON 响应场景
- [x] [Review][Defer] `success: true` 切 tab 后不重置 [src/features/admin/platform-config-editor.tsx] — deferred, 轻微 UX 问题不影响正确性
- [x] [Review][Defer] `requireAdmin` 时序侧信道 [src/app/api/admin/platform-configs/route.ts] — deferred, 管理员工具理论风险极低
