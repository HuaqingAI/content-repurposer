# Story 3.4b: 改写记录落库与 Cost Tracker

Status: done

## Story

作为运营团队，
我想每次改写完成后自动记录改写结果和 API 成本，
以便在管理后台分析质量和控制成本。

## Acceptance Criteria

1. **Given** 改写 SSE API（Story 3.4a）完成所有平台的改写
   **When** 所有平台的 `platform_complete` 事件均已发送
   **Then** `rewrite_records` 表写入一条记录（含原文、内容类型、用户 ID、时间戳）

2. **And** 每个平台各写入一条 `rewrite_results` 记录（含文案、标题、标签、引导语、api_model、tokens_used、cost_cents、duration_ms）

3. **And** `done` SSE 事件携带真实 `record_id`（UUID），供前端后续反馈提交使用

4. **And** 数据库写入失败时不影响 SSE 流式输出（落库错误仅记录服务端日志，`done` 事件降级为 `record_id: null`，不向用户返回错误）

5. **And** 试用模式（`isTrial === true`）下改写结果不写入数据库，`done` 事件保持 `{ trial: true, record_id: null }`

## Tasks / Subtasks

- [x] **创建 `src/lib/llm/cost-tracker.ts`** (AC: #2)
  - [x] 定义并导出 `MODEL_PRICING` 常量：`Record<string, number>`，键为模型名称，值为每千 token 成本（分）。初始值：`{ 'deepseek-chat': 0.001, 'qwen-plus': 0.002 }`（可按需调整）
  - [x] 导出函数 `calculateCostCents(model: string, totalTokens: number): number`：查 `MODEL_PRICING[model]`，找不到时用默认值 `0.001`；结果用 `Math.ceil` 取整
  - [x] 导出类型 `PlatformCostRecord`：`{ platform: Platform; model: string; tokensUsed: number; costCents: number; durationMs: number }`
  - [x] 导出函数 `createPlatformCostRecord(platform: Platform, model: string, usage: TokenUsage, startTime: number): PlatformCostRecord`：计算 `durationMs = Date.now() - startTime`，调用 `calculateCostCents` 计算成本

- [x] **修改 `src/app/api/rewrite/route.ts`** (AC: #1-5)
  - [x] 新增 import：`calculateCostCents`, `createPlatformCostRecord`, `PlatformCostRecord` from `@/lib/llm/cost-tracker`；`parseContentType` from `@/lib/llm/content-type-parser`；Prisma client（验证实际路径，参见 Dev Notes）
  - [x] 在每个 platform 循环内，在 `send('platform_start', ...)` 之前记录 `const platformStartTime = Date.now()`
  - [x] 在每个 platform 循环内，初始化 `let rawLLMOutput = ''` 和 `const bodyChunks: string[] = []`
  - [x] 在 `onChunk` 回调中，追加原始文本：`rawLLMOutput += chunk`
  - [x] 在发送 `chunk` SSE 事件的同时，将 body chunk 累积：`for (const c of chunks) { bodyChunks.push(c); send('chunk', { text: c }) }`
  - [x] 在 `onComplete` 回调的 `finalize()` 之后，将 `remainingBodyChunks` 也累积到 `bodyChunks`，并构建 `fullBody = bodyChunks.join('')`
  - [x] 在 `onComplete` 回调中，调用 `createPlatformCostRecord(platform, DEEPSEEK_MODELS.CHAT, usage, platformStartTime)` 构建成本记录，替换原有硬编码计算
  - [x] 将 `platform_complete` 事件更新为使用 `costRecord.tokensUsed` 和 `costRecord.costCents`
  - [x] 在循环外声明 `PlatformResult[]`，每个平台 `onComplete` 时 push 完整结果
  - [x] **落库逻辑**（在 `!fatalError` 判断块中，`send('done', ...)` 之前）：try/catch 包裹整个 Prisma 写入，失败仅记录日志，`doneRecordId` 降级为 null
  - [x] 修改 `send('done', ...)` 为：`isTrial ? { trial: true, record_id: null } : { record_id: doneRecordId }`

- [x] **创建 `src/lib/llm/__tests__/cost-tracker.test.ts`** (AC: #2)
  - [x] 测试：`calculateCostCents('deepseek-chat', 1000)` → `1`（Math.ceil(1000 * 0.001)）
  - [x] 测试：`calculateCostCents('deepseek-chat', 1500)` → `2`（Math.ceil(1.5)）
  - [x] 测试：`calculateCostCents('unknown-model', 1000)` → 使用默认值 `0.001`，返回 `1`
  - [x] 测试：`createPlatformCostRecord` 的 `durationMs` ≥ 0，且 `tokensUsed` 和 `costCents` 正确

- [x] **更新 `src/app/api/rewrite/__tests__/route.test.ts`** (AC: #1-5)
  - [x] 在文件顶部新增 Prisma mock（参见 Dev Notes 中的 mock 范式）
  - [x] 新增测试：已登录用户正常改写完成 → `done` 事件 `record_id` 为非 null 字符串（UUID 格式）
  - [x] 新增测试：试用模式改写完成 → `done` 事件 `{ trial: true, record_id: null }`，Prisma create 未调用
  - [x] 新增测试：Prisma 写入抛出异常 → `done` 事件 `record_id: null`（降级），SSE 流正常完成，不返回 error 事件

## Dev Notes

### 关键架构约束（必须遵守）

**1. 只能修改这些文件**

```
src/lib/llm/cost-tracker.ts              # 本 Story 新增
src/lib/llm/__tests__/cost-tracker.test.ts  # 本 Story 新增
src/app/api/rewrite/route.ts             # 扩展 3.4a 实现（落库 + cost tracker）
src/app/api/rewrite/__tests__/route.test.ts  # 新增测试用例
```

**不得修改的文件（只读）：**

```
src/lib/llm/types.ts                     # TokenUsage, DEEPSEEK_MODELS 等类型
src/lib/llm/llm-router.ts
src/lib/llm/prompt-assembler.ts
src/lib/llm/output-parser.ts            # 3.4a 实现，不修改内部逻辑
src/lib/llm/content-type-parser.ts      # 已有 parseContentType，直接 import 使用
src/lib/rate-limit.ts
src/lib/supabase/server.ts
src/lib/env.ts
```

**2. Prisma Client 路径**

在实施前，必须先确认 Prisma client singleton 的实际路径：

```bash
# 在项目根目录执行，查找 prisma client 导出文件
find src/lib -name "*.ts" | xargs grep -l "PrismaClient" 2>/dev/null
```

通常路径为 `src/lib/prisma.ts`，导出形如：

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

若文件不存在，按上述模式创建。

**3. 类型导入路径**

```typescript
// Prisma 类型和枚举（必须从此路径）
import type { Platform, Tone, ContentType } from '@/generated/prisma/client'

// LLM 类型
import type { TokenUsage } from '@/lib/llm/types'
import { DEEPSEEK_MODELS } from '@/lib/llm/types'

// Cost Tracker（本 Story 新增）
import { calculateCostCents, createPlatformCostRecord } from '@/lib/llm/cost-tracker'
import type { PlatformCostRecord } from '@/lib/llm/cost-tracker'

// Content Type Parser（已存在）
import { parseContentType } from '@/lib/llm/content-type-parser'
```

**4. Prisma 字段名映射（对应数据库 snake_case 列名）**

```typescript
// rewrite_records 表（architecture.md 定义）
prisma.rewrite_record.create({
  data: {
    user_id: user.id,          // uuid FK -> users
    original_text: text,        // text
    content_type: contentType,  // enum: ContentType（opinion/narrative/tutorial/review/other）
    metadata: {},               // jsonb（字数统计等，MVP 传空对象即可）
  }
})

// rewrite_results 表
prisma.rewrite_result.create({
  data: {
    record_id: recordId,        // uuid FK -> rewrite_records
    platform: result.platform,  // enum: Platform
    tone: tone,                  // enum: Tone
    body: result.body,           // text
    titles: result.titles,       // jsonb（string[]）
    tags: result.tags,           // jsonb（string[]）
    hook: result.hook,           // text
    api_model: result.costRecord.model,         // varchar
    api_tokens_used: result.costRecord.tokensUsed,    // integer
    api_cost_cents: result.costRecord.costCents,      // integer
    api_duration_ms: result.costRecord.durationMs,    // integer
  }
})
```

**注意：** 若 Prisma model 名与表名不一致，需按实际 schema 调整（Prisma 通常将 snake_case 转为 camelCase：`rewrite_records` → `prisma.rewriteRecord`）。先读 `prisma/schema.prisma` 确认 model 名。

**5. 内容类型解析策略**

各平台使用同一个原文，`[CONTENT_TYPE]:` 标签出现在每个平台 LLM 输出的开头。取任意一个平台的 `rawLLMOutput` 解析即可（多平台结果应一致）。MVP 阶段用最后一个平台的输出：

```typescript
// 在 !isTrial && !fatalError 块中
let contentType: ContentType = 'other'
if (platformResults.length > 0) {
  contentType = parseContentType(platformResults[platformResults.length - 1].rawLLMOutput)
}
```

**6. 落库降级策略（重要）**

数据库写入失败绝对不能影响用户体验：

```typescript
let doneRecordId: string | null = null

if (!isTrial && platformResults.length > 0) {
  try {
    const contentType = parseContentType(platformResults[platformResults.length - 1].rawLLMOutput)

    const record = await prisma.rewriteRecord.create({
      data: {
        user_id: user.id,
        original_text: text,
        content_type: contentType,
        metadata: {},
      },
    })

    await Promise.all(
      platformResults.map((result) =>
        prisma.rewriteResult.create({
          data: {
            record_id: record.id,
            platform: result.platform,
            tone: tone,
            body: result.body,
            titles: result.titles,
            tags: result.tags,
            hook: result.hook,
            api_model: result.costRecord.model,
            api_tokens_used: result.costRecord.tokensUsed,
            api_cost_cents: result.costRecord.costCents,
            api_duration_ms: result.costRecord.durationMs,
          },
        })
      )
    )

    doneRecordId = record.id
  } catch (err) {
    console.error('[rewrite 3.4b] DB write failed:', err)
    // doneRecordId 保持 null，SSE 流继续正常关闭
  }
}

send('done', isTrial ? { trial: true, record_id: null } : { record_id: doneRecordId })
```

**7. PlatformResult 数据收集完整范式**

在 route.ts 的串行循环中，对每个 platform 修改如下（仅展示新增/修改部分）：

```typescript
const platformResults: Array<{
  platform: Platform
  body: string
  titles: string[]
  tags: string[]
  hook: string
  rawLLMOutput: string
  costRecord: PlatformCostRecord
}> = []

for (const platform of platforms) {
  if (fatalError) break

  const platformStartTime = Date.now()
  let rawLLMOutput = ''
  const bodyChunks: string[] = []

  send('platform_start', { platform })

  // ... assemblePrompt, abortController 等不变 ...

  await new Promise<void>((resolve) => {
    llmRouter.streamChat({
      // ...
      onChunk: (chunk) => {
        rawLLMOutput += chunk  // 新增：累积原始 LLM 输出
        const { chunks, unsupported } = parser.processChunk(chunk)
        if (unsupported && !unsupportedDetected) { /* 不变 */ }
        if (!unsupportedDetected) {
          for (const c of chunks) {
            bodyChunks.push(c)  // 新增：累积 body 文本
            send('chunk', { text: c })
          }
        }
      },
      onComplete: (usage: TokenUsage) => {
        if (!unsupportedDetected) {
          const { remainingBodyChunks, titles, tags, hook } = parser.finalize()
          for (const c of remainingBodyChunks) {
            bodyChunks.push(c)  // 新增：累积剩余 body
            send('chunk', { text: c })
          }

          const costRecord = createPlatformCostRecord(
            platform, DEEPSEEK_MODELS.CHAT, usage, platformStartTime
          )

          send('titles', { titles })
          send('tags', { tags })
          send('hook', { hook })
          send('platform_complete', {
            platform,
            tokens_used: costRecord.tokensUsed,   // 使用 cost tracker
            cost_cents: costRecord.costCents,       // 使用 cost tracker
          })

          // 新增：保存本平台完整结果
          platformResults.push({
            platform,
            body: bodyChunks.join(''),
            titles,
            tags,
            hook,
            rawLLMOutput,
            costRecord,
          })
        }
        resolve()
      },
      onError: (error) => { /* 不变 */ },
    })
  })
}
```

**8. Route Test Mock 范式（新增 Prisma mock）**

```typescript
// 在已有的 jest.mock 声明之后新增
jest.mock('@/lib/prisma', () => ({
  prisma: {
    rewriteRecord: {
      create: jest.fn(),
    },
    rewriteResult: {
      create: jest.fn(),
    },
  },
}))

// 在 beforeEach 中设置默认成功 mock
import { prisma } from '@/lib/prisma'

beforeEach(() => {
  jest.mocked(prisma.rewriteRecord.create).mockResolvedValue({
    id: 'test-record-uuid-1234',
    // 其他字段按需补充
  } as any)
  jest.mocked(prisma.rewriteResult.create).mockResolvedValue({} as any)
})
```

**注意：** 若 Prisma client singleton 路径为 `@/lib/db` 或其他，按实际路径调整。

**9. Anti-Pattern 防范**

- **不**使用原生 SQL 直接操作数据库（只用 Prisma Client）
- **不**在 `try/catch` 的 catch 块中再次 `send(...)` 错误 SSE 事件（落库失败对用户透明）
- **不**在试用模式（`isTrial === true`）下触发任何 Prisma 写入
- **不**修改 `output-parser.ts`（只读文件，不暴露内部 buffer）
- **不**在 `rawLLMOutput` 为空时调用 `parseContentType`（`platformResults.length > 0` 已保证）
- `DEEPSEEK_MODELS.CHAT` 用 types.ts 导出常量，不硬编码字符串
- Prisma 写入使用 `await`，注意放在 `!isTrial` 条件判断内

### 文件位置

```
src/lib/llm/
├── types.ts                        # 已存在（只读）
├── llm-router.ts                   # 已存在（只读）
├── prompt-assembler.ts             # 已存在（只读）
├── output-parser.ts                # Story 3.4a 新增（只读）
├── content-type-parser.ts          # Story 3.3 新增（只读）
├── cost-tracker.ts                 # 本 Story 新增 ★
└── __tests__/
    ├── output-parser.test.ts       # Story 3.4a（只读）
    ├── cost-tracker.test.ts        # 本 Story 新增 ★

src/app/api/rewrite/
├── route.ts                        # Story 3.4a 实现，本 Story 扩展 ★
└── __tests__/
    └── route.test.ts               # Story 3.4a 更新，本 Story 继续扩展 ★

src/lib/
└── prisma.ts                       # 需先确认是否存在，不存在则创建 ★
```

### Previous Story Intelligence（Story 3.4a）

- `route.ts` 当前 `done` 事件硬编码 `record_id: null`，本 Story 替换为真实 UUID
- `platform_complete` 当前 `cost_cents = Math.ceil(usage.totalTokens * 0.001)`，本 Story 改为 Cost Tracker 计算
- `output-parser.ts` 的 `buffer` 字段是私有的，不能从外部访问 → 必须在 `onChunk` 中累积 `rawLLMOutput`
- `content-type-parser.ts` 已存在，`parseContentType(llmOutput: string): ContentType`，直接 import 使用
- 测试文件顶部必须有 `/** @jest-environment node */`
- `jest.mock` factory 中不引用文件顶层 const（TDZ 问题），通过 `jest.mocked()` 获取类型化引用
- `LLMOutputParser.finalize()` 返回 `{ remainingBodyChunks, titles, tags, hook }`，不包含完整 body

### 数据库 Schema 参考

来自 `_bmad-output/planning-artifacts/architecture.md#Data Architecture`：

```
rewrite_records
├── id (uuid, PK)
├── user_id (uuid, FK -> users)
├── original_text (text)
├── original_url (varchar, nullable)
├── content_type (enum: opinion/narrative/tutorial/review/other)
├── created_at (timestamp)
└── metadata (jsonb)

rewrite_results
├── id (uuid, PK)
├── record_id (uuid, FK -> rewrite_records)
├── platform (enum: xiaohongshu/wechat/zhihu)
├── tone (enum: casual/standard/formal)
├── body (text)
├── titles (jsonb)
├── tags (jsonb)
├── hook (text)
├── api_model (varchar)
├── api_tokens_used (integer)
├── api_cost_cents (integer)
├── api_duration_ms (integer)
├── created_at (timestamp)
└── feedback (enum: helpful/not_helpful/null)
```

### References

- Story 3.4a 实现：`_bmad-output/implementation-artifacts/3-4a-rewrite-sse-api.md`（当前 route.ts 实现基础）
- 数据库 Schema：`_bmad-output/planning-artifacts/architecture.md#Data Architecture`
- SSE 协议规范：`_bmad-output/planning-artifacts/architecture.md#API & Communication Patterns`
- Cost Tracker 架构说明：`_bmad-output/planning-artifacts/architecture.md#LLM Integration Architecture`
- Content Type Parser：`src/lib/llm/content-type-parser.ts#parseContentType`
- LLM 类型：`src/lib/llm/types.ts#TokenUsage`, `#DEEPSEEK_MODELS`
- Prisma Schema：`prisma/schema.prisma`（确认 model 名）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 关键调试发现：ReadableStream 的 `start` 回调是异步的。在测试中仅 `await POST(...)` 不消费流时，DB 写入尚未执行。需调用 `await collectSSEEvents(res)` 消费流后再断言 Prisma mock 调用次数。
- `jest.clearAllMocks()` 只清除 calls/instances/results，不清除 mock implementations（`mockResolvedValue` 在 beforeEach 重新设置即可）。
- 需为 `@/lib/llm/cost-tracker` 和 `@/lib/llm/content-type-parser` 添加显式 mock，以隔离测试并确保 DB 写入代码路径正常触发。

### Completion Notes List

- 所有 AC 均已实现并通过测试验证
- cost-tracker.ts：13 个单元测试全部通过
- route.test.ts：24 个测试全部通过（含 4 个新增落库逻辑测试）
- 落库降级策略按设计实现：DB 失败仅写服务端日志，SSE 流照常完成，`done` 事件降级为 `record_id: null`

### File List

- `src/lib/llm/cost-tracker.ts` — 新建
- `src/lib/llm/__tests__/cost-tracker.test.ts` — 新建
- `src/app/api/rewrite/route.ts` — 修改（新增落库逻辑、Cost Tracker 集成）
- `src/app/api/rewrite/__tests__/route.test.ts` — 修改（新增 Prisma mock 和 4 个落库测试）

### Review Findings

- [x] [Review][Decision] fatalError 时 done 事件被完全跳过 — 已决策：补发降级 done `{ record_id: null }`，客户端收到明确终止信号

- [x] [Review][Patch] createPlatformCostRecord: durationMs 未防负值 [`src/lib/llm/cost-tracker.ts:createPlatformCostRecord`]
- [x] [Review][Patch] onError 回调未设 fatalError=true，LLM 报错后继续处理下一平台 [`src/app/api/rewrite/route.ts:onError`]
- [x] [Review][Patch] onComplete 在 unsupportedDetected=true 时未调用 resolve()，可能导致 Promise 永久挂起 [`src/app/api/rewrite/route.ts:onComplete`]
- [x] [Review][Patch] DB 写入非原子：rewriteRecord 成功后 Promise.all(rewriteResult) 失败留下孤儿记录 [`src/app/api/rewrite/route.ts:DB write block`]
- [x] [Review][Patch] send() 中 controller.enqueue() 未防护客户端断连抛异常，异常上浮后 finally 二次 close 产生二次错误 [`src/app/api/rewrite/route.ts:send()`]

- [x] [Review][Defer] usage.totalTokens 为 NaN/Infinity 时写入 DB 无效值 [`src/lib/llm/cost-tracker.ts:calculateCostCents`] — deferred, pre-existing
- [x] [Review][Defer] VALID_PLATFORMS 硬编码列表与 Prisma Platform 枚举可能漂移 [`src/app/api/rewrite/route.ts`] — deferred, pre-existing
- [x] [Review][Defer] x-forwarded-for 可被客户端伪造绕过 IP 限流 [`src/app/api/rewrite/route.ts:getClientIp`] — deferred, pre-existing
- [x] [Review][Defer] rawLLMOutput 全量保留在内存中直到请求完成 [`src/app/api/rewrite/route.ts`] — deferred, pre-existing

## Change Log

| 日期 | 变更内容 | 操作人 |
|---|---|---|
| 2026-03-27 | 创建 story 文件 | SM (create-story) |
| 2026-03-27 | 实现所有任务，24/24 测试通过，状态更新为 review | Dev (claude-sonnet-4-6) |
| 2026-03-27 | Code review 完成：1 decision_needed, 5 patch, 4 defer, 6 dismissed | Code Review |
