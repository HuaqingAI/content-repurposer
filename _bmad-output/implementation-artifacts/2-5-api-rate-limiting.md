# Story 2.5: API 限流中间件

Status: done

## Story

作为系统，
我想对改写 API 实施每用户每分钟最多 5 次的请求限制，
以便防止滥用行为并控制 API 成本。

## Acceptance Criteria

1. **Given** 已登录用户在 1 分钟内发起第 6 次改写请求，**When** 请求到达 `POST /api/rewrite`，**Then** 返回 HTTP 429，响应体为 `{ data: null, error: { code: "RATE_LIMIT_EXCEEDED", message: "请求过于频繁，请稍后再试" } }`

2. **Given** 已登录用户在 1 分钟内发起第 1~5 次改写请求，**When** 请求到达 `POST /api/rewrite`，**Then** 请求正常通过（不返回 429）

3. **Given** 用户 A 用尽限额（5次/分钟），**When** 用户 B 的第一次请求到达，**Then** 用户 B 的请求正常通过（限流按用户 ID 独立计数）

4. **Given** 限流窗口（1分钟）结束后，**When** 之前触发限流的用户再次请求，**Then** 限流计数重置，请求正常通过

5. **Given** 未登录用户请求 `POST /api/rewrite`，**When** 请求到达，**Then** 返回 HTTP 401（先做认证检查，再做限流）

## Tasks / Subtasks

- [x] **创建限流工具函数 `src/lib/rate-limit.ts`** (AC: #1, #2, #3, #4)
  - [x] 定义 `RateLimitEntry` 接口（`count: number`, `resetAt: number`）
  - [x] 使用 `Map<string, RateLimitEntry>` 作为内存存储，`key = userId`
  - [x] 实现 `checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number }` 固定窗口算法
  - [x] 在检查时惰性清理过期条目（窗口到期则重置计数器）
  - [x] 导出 `RATE_LIMIT` 常量（`maxRequests: 5`, `windowMs: 60000`）
  - [x] 导出 `__resetStoreForTesting()` 函数（仅供测试使用，清空 Map）

- [x] **创建 `POST /api/rewrite` 桩路由 `src/app/api/rewrite/route.ts`** (AC: #1, #2, #5)
  - [x] 先做认证检查：`createClient()` from `@/lib/supabase/server`，未登录返回 401
  - [x] 再做限流检查：调用 `checkRateLimit(user.id)`，超限返回 429（含正确 error body + `Retry-After` header）
  - [x] 通过检查后返回 501（`code: "NOT_IMPLEMENTED", message: "改写功能即将上线"`）——此桩供 Story 3.4a 替换实际逻辑
  - [x] **禁止在此文件中硬编码任何限流逻辑**，限流逻辑必须通过 `@/lib/rate-limit` 调用

- [x] **编写限流单元测试 `src/lib/__tests__/rate-limit.test.ts`** (AC: #1, #2, #3, #4)
  - [x] 测试：第 1 次请求 allowed=true，remaining=4
  - [x] 测试：连续 5 次请求均 allowed=true
  - [x] 测试：第 6 次请求 allowed=false，remaining=0
  - [x] 测试：不同用户 ID 独立计数（用户 A 耗尽不影响用户 B）
  - [x] 测试：窗口到期后计数重置（使用 `jest.useFakeTimers()` + `jest.advanceTimersByTime()`）
  - [x] 测试：resetAt 返回值为合理的未来时间戳

- [x] **编写 API 路由测试 `src/app/api/rewrite/__tests__/route.test.ts`** (AC: #1, #2, #5)
  - [x] 测试：未登录返回 401
  - [x] 测试：已登录 + 限流通过返回 501（验证非 429）
  - [x] 测试：已登录 + 限流超限返回 429，含正确 error body 和 `Retry-After` header
  - [x] 测试：限流允许时调用了 `checkRateLimit(user.id)`（确认按用户 ID 限流）

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全为代码实现，无需外部配置 | 自动 |

### 关键架构约束（必须遵守）

**proxy.ts 不拦截 `/api/*`：**
```typescript
// src/proxy.ts matcher 明确排除 api/ 路径：
matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)']
```
因此 `/api/rewrite` 的认证和限流**必须在路由 handler 内部处理**，不依赖 proxy.ts。

**认证模式（与 Story 2.4 一致）：**
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return Response.json(
    { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
    { status: 401 }
  )
}
```

**限流应在认证之后：** 先 401（未登录），再 429（超限）。顺序不可颠倒，否则未登录用户会消耗计数。

**`src/lib/rate-limit.ts` 不能 import `server-only`：** 该文件是纯 Node.js 工具函数，需要在测试环境下直接 import，加 `server-only` 会导致测试环境无法加载。

**`env.ts` 不在 `rate-limit.ts` 中使用：** 限流逻辑不需要读取任何环境变量，直接使用常量即可。

### rate-limit.ts 完整实现参考

```typescript
// src/lib/rate-limit.ts

export const RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 分钟
} as const

interface RateLimitEntry {
  count: number
  resetAt: number // Unix timestamp (ms)
}

// 内存存储：userId -> 限流条目
// MVP 单实例 Docker 场景下足够；多实例场景需替换为 Redis（Post-MVP）
const rateLimitStore = new Map<string, RateLimitEntry>()

export function checkRateLimit(userId: string): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(userId)

  // 条目不存在或窗口已过期 → 新窗口
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + RATE_LIMIT.windowMs
    rateLimitStore.set(userId, { count: 1, resetAt })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1, resetAt }
  }

  // 窗口内已达上限
  if (entry.count >= RATE_LIMIT.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  // 窗口内正常累计
  entry.count++
  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - entry.count,
    resetAt: entry.resetAt,
  }
}

/** 仅供测试使用，重置内存存储 */
export function __resetStoreForTesting() {
  rateLimitStore.clear()
}
```

### route.ts 完整实现参考

```typescript
// src/app/api/rewrite/route.ts
// 注意：此文件为桩实现。Story 3.4a 将替换 TODO 部分为实际 LLM 改写逻辑。

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(_request: Request) {
  // 1. 认证检查（必须先于限流）
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    )
  }

  // 2. 限流检查
  const rateLimitResult = checkRateLimit(user.id)
  if (!rateLimitResult.allowed) {
    const retryAfterSec = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
    return Response.json(
      { data: null, error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' } },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }
    )
  }

  // 3. TODO(Story 3.4a): 实现 LLM 串行 SSE 改写逻辑
  return Response.json(
    { data: null, error: { code: 'NOT_IMPLEMENTED', message: '改写功能即将上线' } },
    { status: 501 }
  )
}
```

### 测试模式参考（API Route）

```typescript
// src/app/api/rewrite/__tests__/route.test.ts
/**
 * @jest-environment node
 */

// 重要：jest.mock 必须在 import 之前定义
const mockGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

const mockCheckRateLimit = jest.fn()
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { POST } from '../route'

function makeRequest() {
  return new Request('http://localhost/api/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '测试', platforms: ['xiaohongshu'], tone: 'standard' }),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/rewrite', () => {
  it('未登录返回 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'not authenticated' } })
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('已登录 + 限流通过返回 501（桩）', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(501)
  })

  it('已登录 + 超限返回 429，含正确 error body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
    expect(body.data).toBeNull()
  })

  it('超限时响应包含 Retry-After header', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30000 })
    const res = await POST(makeRequest())
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('限流通过时以 user.id 调用 checkRateLimit', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-abc' } }, error: null })
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 3, resetAt: Date.now() + 60000 })
    await POST(makeRequest())
    expect(mockCheckRateLimit).toHaveBeenCalledWith('user-abc')
  })
})
```

### 测试模式参考（rate-limit 单元测试）

```typescript
// src/lib/__tests__/rate-limit.test.ts
/**
 * @jest-environment node
 */
import { checkRateLimit, RATE_LIMIT, __resetStoreForTesting } from '@/lib/rate-limit'

beforeEach(() => {
  __resetStoreForTesting()
  jest.clearAllMocks()
})

describe('checkRateLimit', () => {
  it('第 1 次请求 allowed=true，remaining=4', () => {
    const result = checkRateLimit('user-1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('连续 5 次请求均 allowed=true', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('user-1').allowed).toBe(true)
    }
  })

  it('第 6 次请求 allowed=false，remaining=0', () => {
    for (let i = 0; i < 5; i++) { checkRateLimit('user-1') }
    const result = checkRateLimit('user-1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('不同用户 ID 独立计数', () => {
    for (let i = 0; i < 5; i++) { checkRateLimit('user-1') }
    const result = checkRateLimit('user-2')
    expect(result.allowed).toBe(true)
  })

  it('窗口到期后计数重置', () => {
    jest.useFakeTimers()
    for (let i = 0; i < 5; i++) { checkRateLimit('user-1') }
    expect(checkRateLimit('user-1').allowed).toBe(false)
    jest.advanceTimersByTime(RATE_LIMIT.windowMs + 1)
    expect(checkRateLimit('user-1').allowed).toBe(true)
    jest.useRealTimers()
  })

  it('resetAt 为未来时间戳', () => {
    const now = Date.now()
    const result = checkRateLimit('user-1')
    expect(result.resetAt).toBeGreaterThan(now)
    expect(result.resetAt).toBeLessThanOrEqual(now + RATE_LIMIT.windowMs + 10)
  })
})
```

### 目录结构（本 Story 完成后新增文件）

```
src/
├── app/
│   └── api/
│       └── rewrite/
│           ├── route.ts                    ← 新增（桩：auth + rate-limit，501 占位）
│           └── __tests__/
│               └── route.test.ts           ← 新增
└── lib/
    ├── rate-limit.ts                       ← 新增
    └── __tests__/
        └── rate-limit.test.ts              ← 新增
```

### 重要约束说明

**MVP 限制（单实例内存存储）：**
- 当前实现为进程内 Map，重启后计数清零
- 多 Docker 实例部署时各实例独立计数（不共享）
- Post-MVP 扩容至多实例时需替换为 Redis（Upstash 或自建）
- MVP 阶段单机 Docker 部署，此方案完全足够

**Story 3.4a 集成说明：**
- Story 3.4a 实现实际 LLM 改写逻辑时，直接替换 `route.ts` 中的 TODO 注释部分
- rate-limit.ts 和认证检查部分**无需修改**，Story 3.4a 只需替换 TODO 逻辑
- Story 3.4a 还需在 route.ts 中添加试用模式（未登录 IP 限流，3次/小时）

**前端 429 处理说明（AC #2 前端部分）：**
- 本 Story 仅实现后端 429 响应
- 前端友好提示将在 Story 4a.3/4a.4（改写工作区 SSE 消费）中实现
- 本 Story 的 AC #2 "前端不崩溃"将在 Story 4a 中验证

### Zod v4 注意事项（延续 Story 2.4）

本 Story 不使用 `zodResolver` 和 `react-hook-form`（纯 API 路由）。
但如未来在 route.ts 中需要校验请求体，**继续避免使用 `zodResolver`**，直接使用 `schema.safeParse(body)`。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5] — AC 原文
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — ARCH15 限流规范
- [Source: _bmad-output/planning-artifacts/architecture.md#Format Patterns] — API 响应格式
- [Source: _bmad-output/implementation-artifacts/2-4-user-settings-page.md#Dev Notes] — 认证模式、Zod v4 注意事项
- [Source: src/proxy.ts#config.matcher] — API 路由不经过 proxy.ts
- [Source: src/lib/supabase/server.ts] — createClient 用法
- [Source: src/app/api/user/profile/__tests__/route.test.ts] — API Route 测试模式

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- route.test.ts 初版使用 `const mockXxx = jest.fn(); jest.mock(..., () => ({ fn: mockXxx }))` 模式导致 TDZ 错误（jest.mock 被 babel-jest 提升，const 变量尚未初始化）。修复方案：mock factory 内直接用 jest.fn()，再通过 `jest.mocked()` 获取类型化引用。

### Completion Notes List

- 实现 `src/lib/rate-limit.ts`：固定窗口算法，内存 Map 存储，惰性过期清理，导出测试用 reset 函数
- 实现 `src/app/api/rewrite/route.ts`：认证在前（401）→ 限流在后（429）→ 桩返回 501，符合 Story 3.4a 替换约定
- 编写单元测试 6 个（rate-limit）+ 路由测试 5 个，全部通过
- proxy.test.ts 中 4 个既有失败（307 vs 302 重定向）与本 story 无关，不属于回归

### File List

- src/lib/rate-limit.ts（新增）
- src/app/api/rewrite/route.ts（新增）
- src/lib/__tests__/rate-limit.test.ts（新增）
- src/app/api/rewrite/__tests__/route.test.ts（新增）

### Review Findings

- [x] [Review][Patch] 内存存储条目永不删除——过期条目无限堆积 [src/lib/rate-limit.ts:17-23]
- [x] [Review][Patch] authError 与 user===null 未区分——基础设施错误静默变成 401 [src/app/api/rewrite/route.ts:10-17]
- [x] [Review][Patch] Retry-After header 可能为 "0" 或负数（时钟微漂） [src/app/api/rewrite/route.ts:24]
- [x] [Review][Patch] 窗口到期测试中 jest.useRealTimers() 未在 afterEach 中调用——断言失败时 fake timer 泄漏后续测试 [src/lib/__tests__/rate-limit.test.ts:45]
- [x] [Review][Patch] __resetStoreForTesting 导出到生产模块公共 API [src/lib/rate-limit.ts:45-47]
- [x] [Review][Patch] userId 空字符串未校验——空 id 共享同一限流 bucket [src/lib/rate-limit.ts:15]
- [x] [Review][Defer] 并发请求计数器竞态（多实例场景）[src/lib/rate-limit.ts] — deferred, MVP 单实例限制；Post-MVP 迁移 Redis 时一并解决
- [x] [Review][Defer] 501 桩响应仍消耗限流 token [src/app/api/rewrite/route.ts] — deferred, 桩设计预期行为；Story 3.4a 替换实际逻辑时处理
- [x] [Review][Defer] 请求体未校验——_request 未读取 [src/app/api/rewrite/route.ts] — deferred, 桩阶段设计意图；Story 3.4a 添加 body validation
- [x] [Review][Defer] 进程内 Map 不跨 Docker 实例共享 [src/lib/rate-limit.ts] — deferred, Dev Notes 明确记录 MVP 单实例约束

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-27 | Story 2.5 创建：API 限流中间件 | create-story |
| 2026-03-27 | 实现完成：rate-limit.ts、rewrite route 桩、11 个测试全通过 | claude-sonnet-4-6 |
