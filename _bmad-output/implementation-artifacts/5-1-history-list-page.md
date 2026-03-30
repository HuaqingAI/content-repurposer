# Story 5.1：历史记录列表页

Status: done

## Story

作为内容创作者，
我想查看我所有的历史改写记录，
以便快速找到之前改写过的内容并了解使用情况。

## Acceptance Criteria

1. **Given** 用户访问 `/app/history`，**When** 页面加载完成，**Then** 按时间倒序展示该用户所有改写记录，每条显示：原文前 100 字预览、改写时间、目标平台标签
2. **Given** 历史记录列表，**When** 记录超过一页，**Then** 支持分页（每页 20 条）或无限滚动加载
3. **Given** 用户点击某条历史记录，**When** 详情展开或跳转，**Then** 显示该次改写的所有平台完整结果（文案 + 标题 + 标签 + 引导语）
4. **Given** 用户没有任何历史记录，**When** 页面加载完成，**Then** 显示空状态提示："还没有改写记录，去改写第一篇吧"，附带跳转 `/app` 的链接
5. **Given** 历史记录页，**When** 任何情况，**Then** 仅展示当前登录用户自己的记录（RLS 在数据库层保证，API 层也要校验 userId）

## Tasks / Subtasks

- [x] 任务 1：创建 API 路由 - 历史记录列表 (AC: #1, #2, #5)
  - [x] 创建 `src/app/api/rewrite/history/route.ts`，实现 `GET` 方法
  - [x] 服务端认证：用 `createClient()` from `@/lib/supabase/server` 获取当前用户，未登录返回 401
  - [x] 查询 `rewrite_records`，`where: { userId: user.id }`，`orderBy: { createdAt: 'desc' }`
  - [x] 同时 include `results` 关联（只取 `platform` 字段），用于展示平台标签
  - [x] 支持分页：query param `page`（默认 1）和 `pageSize`（固定 20），返回 `{ data: { records, total, page, pageSize }, error: null }`
  - [x] `original_text` 截取前 100 字返回（不要传整段原文到前端）

- [x] 任务 2：创建 API 路由 - 历史记录详情 (AC: #3, #5)
  - [x] 创建 `src/app/api/rewrite/history/[id]/route.ts`，实现 `GET` 方法
  - [x] 服务端认证，同上
  - [x] 查询单条 `rewrite_record` + 所有 `rewrite_results`：`where: { id: params.id, userId: user.id }`（防 IDOR，必须同时校验 userId）
  - [x] 记录不存在或不属于当前用户时返回 404
  - [x] 响应格式：`{ data: { record: RewriteRecord, results: RewriteResult[] }, error: null }`

- [x] 任务 3：创建 feature 组件 (AC: #1, #2, #3, #4)
  - [x] 创建 `src/features/history/history-list.tsx`：核心列表组件，接收 records、total、onLoadMore props
  - [x] 创建 `src/features/history/history-record-card.tsx`：单条记录卡片，展示预览文字、时间、平台标签，点击展开/跳转详情
  - [x] 创建 `src/features/history/history-detail-modal.tsx`：详情弹窗（或内联展开），展示完整改写结果（文案+标题+标签+引导语）
  - [x] 创建 `src/features/history/history-empty-state.tsx`：空状态组件
  - [x] 所有组件遵循 `kebab-case` 文件名、`PascalCase` 组件名

- [x] 任务 4：创建历史记录页面 (AC: #1~#5)
  - [x] 创建 `src/app/app/history/page.tsx`（或确认已存在则修改）
  - [x] 已读 `node_modules/next/dist/docs/` 相关章节（Next.js 16.2.1：params/searchParams 是 Promise，需要 await）
  - [x] 页面使用 Server Component（`async function`）在服务端预取第一页数据
  - [x] 客户端分页/加载更多通过调用 `/api/rewrite/history?page=N` 实现
  - [x] 已包在 `AppLayout`（AuthGuard）中，无需重复包裹

- [x] 任务 5：创建测试文件 (AC: 全部)
  - [x] `src/app/api/rewrite/history/__tests__/route.test.ts`：测试认证保护、分页、数据隔离（8 个测试通过）
  - [x] `src/app/api/rewrite/history/[id]/__tests__/route.test.ts`：测试 IDOR 防护（7 个测试通过）
  - [x] `src/features/history/__tests__/history-list.test.tsx`：测试列表渲染和空状态（9 个测试通过）

## Dev Notes

### 关键路径约定（不可违反）

- **独占目录**：`src/features/history/`、`src/app/app/history/`、`src/app/api/rewrite/history/`
- **不得触碰**：`src/lib/llm/`、`src/app/api/rewrite/route.ts`、`src/features/rewrite/`、`src/features/admin/`、`src/app/admin/`

### Prisma 使用方式

```typescript
// 正确导入方式
import { prisma } from '@/lib/prisma'
import type { RewriteRecord, RewriteResult } from '@/generated/prisma/client'

// 历史列表查询示例
const records = await prisma.rewriteRecord.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
  skip: (page - 1) * pageSize,
  take: pageSize,
  include: {
    results: {
      select: { platform: true, id: true }  // 列表只需要平台标签
    }
  }
})
const total = await prisma.rewriteRecord.count({ where: { userId: user.id } })
```

Prisma generator 输出路径：`src/generated/prisma/`（非默认路径，已在 `prisma/schema.prisma` 中配置）

### 服务端认证模式（复用已有模式）

```typescript
// src/app/api/rewrite/history/route.ts 顶部
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    return Response.json(
      { data: null, error: { code: 'SERVICE_ERROR', message: '服务异常，请稍后再试' } },
      { status: 503 }
    )
  }
  if (!user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }
  // ...
}
```

参考：`src/app/api/rewrite/route.ts` 的认证模式（完全相同）

### API 响应格式（必须遵循）

```typescript
// 成功
{ data: { records: [...], total: 100, page: 1, pageSize: 20 }, error: null }

// 错误
{ data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } }
```

### IDOR 安全防护（关键）

详情接口必须同时校验 `id` 和 `userId`，不能只用 id：

```typescript
const record = await prisma.rewriteRecord.findFirst({
  where: { id: params.id, userId: user.id },  // 两个条件缺一不可
  include: { results: true }
})
if (!record) {
  return Response.json(
    { data: null, error: { code: 'NOT_FOUND', message: '记录不存在' } },
    { status: 404 }
  )
}
```

### 数据模型（已存在于 schema）

```prisma
model RewriteRecord {
  id           String      @id @default(uuid())
  userId       String      @map("user_id")
  originalText String      @map("original_text")  // 列表只取前100字
  originalUrl  String?     @map("original_url")
  contentType  ContentType @map("content_type")  // opinion/narrative/tutorial/review/other
  createdAt    DateTime    @default(now()) @map("created_at")
  metadata     Json?
  results      RewriteResult[]
}

model RewriteResult {
  id       String   @id
  recordId String   @map("record_id")
  platform Platform  // xiaohongshu/wechat/zhihu
  tone     Tone      // casual/standard/formal
  body     String
  titles   Json      // string[]
  tags     Json      // string[]
  hook     String
  feedback Feedback? // helpful/not_helpful/null
  // ... api 成本字段
}
```

### Next.js 16.2.1 注意事项

**重要**：Next.js 16.2.1 与 15.x 有 breaking changes。**实现前必须先读**：
- `node_modules/next/dist/docs/01-app/` 中的相关章节

已知项目用法（从现有文件提取，可直接参考）：
- Server Component 页面：`src/app/app/page.tsx` 和 `src/app/app/settings/page.tsx`
- App Router Layout：`src/app/app/layout.tsx`（使用 AuthGuard）
- API Route 模式：`src/app/api/rewrite/route.ts`（`export async function POST(request: Request)`）

### 平台标签显示映射

```typescript
const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}
```

### 时间格式化

日期使用 ISO 8601，前端展示转本地时区。建议：
```typescript
// 相对时间（如"3天前"）或绝对时间（如"2026-03-24 15:30"）
new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
```

### 内容类型映射

```typescript
const CONTENT_TYPE_LABELS: Record<string, string> = {
  opinion: '观点分析',
  narrative: '体验叙事',
  tutorial: '教程列表',
  review: '评测对比',
  other: '其他',
}
```

### Project Structure Notes

- 新建文件位置：
  ```
  src/
  ├── app/
  │   ├── app/history/page.tsx           ← 历史记录页（可能已存在 stub）
  │   └── api/rewrite/history/
  │       ├── route.ts                    ← GET 列表
  │       ├── [id]/route.ts              ← GET 详情
  │       ├── __tests__/route.test.ts
  │       └── [id]/__tests__/route.test.ts
  └── features/history/
      ├── history-list.tsx
      ├── history-record-card.tsx
      ├── history-detail-modal.tsx
      ├── history-empty-state.tsx
      └── __tests__/
          └── history-list.test.tsx
  ```
- 测试文件与源文件同目录（项目约定）
- 不需要 Zustand store：历史记录是纯展示型，Server Component + fetch 即可

### References

- 认证模式：[Source: src/app/api/rewrite/route.ts]
- AuthGuard 模式：[Source: src/features/auth/auth-guard.tsx]
- Prisma client：[Source: src/lib/prisma.ts]
- 数据库 Schema：[Source: prisma/schema.prisma]
- API 格式约定：[Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns]
- 项目结构约定：[Source: _bmad-output/planning-artifacts/architecture.md#Structure Patterns]
- Story AC 原文：[Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]

### Review Findings

- [x] [Review][Decision] 详情 API 暴露内部成本字段 — 已决策：改用 `select` 过滤，不返回 `apiModel/apiTokensUsed/apiCostCents/apiDurationMs`（决策 B）

- [x] [Review][Patch] Prisma 查询未 try/catch，DB 故障导致 unhandled rejection（CRITICAL）[已修复]
- [x] [Review][Patch] parseInt NaN：`Math.max(1, NaN)` 返回 NaN，skip 变 NaN 导致 Prisma 报错 [已修复]
- [x] [Review][Patch] handleLoadMore 无错误处理/catch，网络失败或 API 错误静默消失无用户提示 [已修复]
- [x] [Review][Patch] handleReuse（卡片）无错误处理/catch，失败静默消失 [已修复]
- [x] [Review][Patch] HistoryDetailModal useEffect 无 AbortController，快速切换记录时旧请求覆盖新数据 [已修复]
- [x] [Review][Patch] 详情 API results 字段重复：`record` 已含 `results`（include），顶层再次映射造成冗余 [已修复]
- [x] [Review][Patch] handleReuse 将完整 originalText 写入 URLSearchParams，超长文本导致 URL 截断或导航失败 [已修复，截断至 1500 字]
- [x] [Review][Patch] 切换记录时 Modal 短暂显示旧数据（recordId 变更时未预先清空 data）[已修复]
- [x] [Review][Patch] "加载更多"快速双击可在 disabled 状态生效前触发并发请求 [已修复，loadingRef guard]
- [x] [Review][Patch] titles/tags 列表使用 key={i}，数组顺序变化时 React 重渲错误 [已修复]
- [x] [Review][Patch] PAGE_SIZE 常量在两个文件各自定义，不一致时导致首屏与加载更多分页错位 [已修复，统一到 types.ts]

- [x] [Review][Defer] page 参数无上界——极大 page 值触发大偏移全表扫描 [route.ts] — deferred，低优先级性能优化
- [x] [Review][Defer] results 为空时 tone 静默降级为 'standard' — deferred，可接受默认行为
- [x] [Review][Defer] originalText 运行时 null 时展开运算符抛错 — deferred，DB 非空约束已保证
- [x] [Review][Defer] 展开/收起按钮文案不对称（"收起标题/标签" vs "展开标题/标签/引导语"）— deferred，NITPICK

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 实现了 GET /api/rewrite/history（分页列表，originalText 截取 100 字，userId 隔离）
- 实现了 GET /api/rewrite/history/[id]（详情，IDOR 防护：同时校验 id + userId）
- 创建了 5 个 feature 组件：history-list, history-record-card, history-detail-modal, history-empty-state, types
- 创建了 Server Component 历史记录页面（直接用 Prisma 预取第一页，无冗余 API 调用）
- 共 24 个测试用例全部通过；proxy.test.ts 的 4 个失败为预存 bug，与本 story 无关
- Next.js 16.2.1 关键变化：dynamic route params 是 Promise，需要 `await params`

### File List

- src/app/api/rewrite/history/route.ts（新建）
- src/app/api/rewrite/history/[id]/route.ts（新建）
- src/app/api/rewrite/history/__tests__/route.test.ts（新建）
- src/app/api/rewrite/history/[id]/__tests__/route.test.ts（新建）
- src/features/history/types.ts（新建）
- src/features/history/history-empty-state.tsx（新建）
- src/features/history/history-record-card.tsx（新建）
- src/features/history/history-detail-modal.tsx（新建）
- src/features/history/history-list.tsx（新建）
- src/features/history/__tests__/history-list.test.tsx（新建）
- src/app/app/history/page.tsx（新建）
- _bmad-output/implementation-artifacts/5-1-history-list-page.md（更新）
