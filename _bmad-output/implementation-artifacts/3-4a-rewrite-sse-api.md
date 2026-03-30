# Story 3.4a: 改写 SSE API（串行流式输出）

Status: done

## Story

作为前端改写工作区，
我想调用改写 API 并通过 SSE 实时接收多平台改写结果，
以便用户看到流式逐字输出效果，不需要等待全部完成才显示。

## Acceptance Criteria

1. **Given** 已登录用户发送 `POST /api/rewrite`，body 包含 `{ text, platforms, tone }`
   **When** API 处理请求
   **Then** 按平台顺序串行调用 LLM，每个平台依次发送 SSE 事件：`platform_start` → `chunk`（多次）→ `titles` → `tags` → `hook` → `platform_complete`，全部完成后发送 `done`

2. **And** `platform_complete` 事件包含该平台的 `tokens_used` 和 `cost_cents`

3. **And** LLM 输出中包含 `[UNSUPPORTED_CONTENT]` 标签时，发送 `error` SSE 事件，message 为"该内容暂不支持改写，请尝试其他类型的文章"，`retryable: false`（满足 FR7）

4. **And** 任意平台 LLM 调用失败时，发送 `error` SSE 事件，包含 `{ message, retryable: true }`

5. **And** 首个 `chunk` 事件在用户点击改写后 2 秒内到达（满足 NFR1）

6. **And** 2000 字原文的单平台改写 `platform_complete` 在 15 秒内到达（满足 NFR2）

7. **Given** 未登录用户发起试用改写请求（请求头中无有效 session token）
   **When** API 处理请求
   **Then** 请求按 IP 限流（每小时最多 3 次），超限返回 HTTP 429，message 为"今日试用次数已达上限，注册后可免费无限使用"

8. **And**（试用模式）`done` SSE 事件携带 `{ trial: true, record_id: null }`，改写结果不写入数据库

9. **And**（试用模式）试用用户只能选择单个目标平台，多选时返回 HTTP 400，message 为"试用模式仅支持单平台改写"

## Tasks / Subtasks

- [x] **创建 `src/lib/llm/output-parser.ts`** (AC: #1, #3)
  - [x] 定义并导出 `LLMOutputParser` 类
  - [x] 内部维护 `buffer: string`、`state: 'before_body' | 'in_body' | 'after_body'`、`lastEmittedPos: number`
  - [x] 实现 `processChunk(text: string): { chunks: string[]; unsupported: boolean }`：返回可立即发送的 body 文本片段；检测 `[UNSUPPORTED_CONTENT]` 标签；使用 LOOKAHEAD=25 保守 buffer 尾部不立即发送
  - [x] 实现 `finalize(): { remainingBodyChunks: string[]; titles: string[]; tags: string[]; hook: string }`：流结束时返回剩余 body 片段（lastEmittedPos 到 body 结束位置）以及从完整 buffer 解析的结构化字段
  - [x] BODY 检测：查找 `[BODY]:` 标记，起始位置跳过紧随的 `\n`
  - [x] SECTION_MARKERS（停止 body 流式输出并切换 after_body 状态）：`['[TITLE_1]:', '[TITLE_2]:', '[TITLE_3]:', '[TAGS]:', '[HOOK]:', '[UNSUPPORTED_CONTENT]']`
  - [x] `[UNSUPPORTED_CONTENT]` 检测：同时在 `before_body` 阶段检测
  - [x] finalize 的标签解析：`extractSingleLineTag` 辅助函数；tags 按逗号拆分并 trim

- [x] **扩展 `src/lib/rate-limit.ts` 增加 IP 限流** (AC: #7)
  - [x] 新增导出常量 `IP_RATE_LIMIT = { maxRequests: 3, windowMs: 60 * 60 * 1000 }` （每小时 3 次）
  - [x] 新增独立内存 store `ipRateLimitStore`
  - [x] 新增导出函数 `checkIpRateLimit(ip: string): { allowed: boolean; resetAt: number }`
  - [x] 新增导出 `__resetIpStoreForTesting()`
  - [x] 不修改已有 `checkRateLimit`、`RATE_LIMIT`、`__resetStoreForTesting` 导出

- [x] **修改 `src/app/api/rewrite/route.ts`** (AC: #1-9)
  - [x] 删除文件顶部 `// 注意：此文件为桩实现` 注释
  - [x] 更新 import：`checkIpRateLimit`、`assemblePrompt`、`DEEPSEEK_MODELS`、`LLMOutputParser`、`llmRouter`
  - [x] **修改认证分支**：`authError !== null` → 503；`user === null` → 试用模式；`user !== null` → 普通模式
  - [x] 试用模式：IP 限流 `checkIpRateLimit(ip)`；超限返回 429
  - [x] 普通模式：保持现有 `checkRateLimit(user.id)` 限流逻辑
  - [x] 输入校验：text 50-5000 字、platforms 有效枚举、tone 有效值；试用模式额外校验单平台
  - [x] 构建 `ReadableStream` + `TextEncoder`，返回 SSE 响应
  - [x] SSE 响应 headers：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`
  - [x] 串行处理每个 platform：`platform_start` → `assemblePrompt` → `llmRouter.streamChat` → `chunk` → `finalize()` → `titles`/`tags`/`hook`/`platform_complete`
  - [x] 使用 `AbortController` 处理 `[UNSUPPORTED_CONTENT]`：abort + fatalError + error SSE（retryable:false）
  - [x] LLM `onError`：非 CANCELLED 时发 error SSE（retryable:true）；CANCELLED 静默
  - [x] `assemblePrompt` 抛出时：error SSE，`retryable: false`，`fatalError = true`
  - [x] 全部完成且 `!fatalError`：发 `done` 事件（普通：`{ record_id: null }`；试用：`{ trial: true, record_id: null }`）
  - [x] `finally { controller.close() }` 确保流始终关闭

- [x] **创建 `src/lib/llm/__tests__/output-parser.test.ts`** (AC: #1, #3)
  - [x] 测试：完整正常输出一次性传入 → 正确提取 body chunks；`finalize` 返回正确 titles/tags/hook
  - [x] 测试：chunks 跨越 `[BODY]:` 边界 → body 从正确位置开始
  - [x] 测试：chunks 跨越 `[TITLE_1]:` 边界 → body 正确停止，不包含 marker 内容
  - [x] 测试：LOOKAHEAD 保守机制 → 短 chunk 时返回空 chunks，后续 chunk 才释放
  - [x] 测试：输出含 `[UNSUPPORTED_CONTENT]`（before_body 阶段）→ `unsupported: true`
  - [x] 测试：输出含 `[UNSUPPORTED_CONTENT]`（作为 body 的 section marker）→ `unsupported: true`
  - [x] 测试：`finalize` 正确解析 3 个 titles、逗号分隔的 tags（trim 空格）、hook
  - [x] 测试：`finalize` 在 state 仍为 `in_body` 时 → 返回剩余内容作为 remainingBodyChunks

- [x] **更新 `src/app/api/rewrite/__tests__/route.test.ts`** (AC: #1-9)
  - [x] 保留现有 503（auth 服务异常）、429（per-user 限流）、Retry-After header、checkRateLimit 调用 user.id 等测试
  - [x] **更新** "已登录 + 限流通过" 测试 → 验证返回 200 状态码和 `Content-Type: text/event-stream` header
  - [x] 新增 mock：`jest.mock('@/lib/llm/llm-router', ...)` 和 `jest.mock('@/lib/llm/prompt-assembler', ...)`
  - [x] 新增辅助函数 `collectSSEEvents(response)` 消费 ReadableStream
  - [x] 新增测试：body 缺少 `text` → 400，error code `VALIDATION_ERROR`
  - [x] 新增测试：`text` 少于 50 字 → 400
  - [x] 新增测试：`platforms` 为空数组 → 400
  - [x] 新增测试：`tone` 为非法值 → 400
  - [x] 新增测试：单平台正常流程 → 200 + SSE 事件序列完整
  - [x] 新增测试：LLM onError 触发 → SSE 包含 `error` 事件，`retryable: true`
  - [x] 新增测试：试用模式（`user` 为 null + IP 限流通过）→ 200 + `done` 含 `trial: true`
  - [x] 新增测试：试用模式多平台 → 400
  - [x] 新增测试：试用模式 IP 超限 → 429

## Dev Notes

### 关键架构约束（必须遵守）

**1. 已有文件（只读，不修改内部逻辑）**

```
src/lib/llm/types.ts                   # LLMProvider、ChatMessage、StreamChatParams、TokenUsage、DEEPSEEK_MODELS
src/lib/llm/llm-router.ts              # export const llmRouter = new LLMRouter(deepseekProvider, qwenProvider)
src/lib/llm/prompt-assembler.ts        # export async function assemblePrompt(params: AssemblePromptParams): Promise<ChatMessage[]>
src/lib/llm/content-type-parser.ts     # export function parseContentType(llmOutput: string): ContentType（供 3.4b 使用）
src/lib/rate-limit.ts                  # 需扩展（添加 IP 限流），不修改已有导出
src/lib/supabase/server.ts             # export async function createClient()
src/lib/env.ts                         # export const env（server-only）
src/app/api/rewrite/route.ts           # 桩实现，本 story 完全替换 TODO 部分
src/app/api/mock-rewrite/route.ts      # SSE 实现参考（只读）
```

**2. 类型导入来源**

```typescript
// Prisma 枚举（必须从此路径）
import type { Platform, Tone } from '@/generated/prisma/client'

// LLM 类型
import type { TokenUsage } from '@/lib/llm/types'
import { DEEPSEEK_MODELS } from '@/lib/llm/types'  // 用 DEEPSEEK_MODELS.CHAT 而非硬编码 'deepseek-chat'

// LLM 服务
import { llmRouter } from '@/lib/llm/llm-router'
import { assemblePrompt } from '@/lib/llm/prompt-assembler'
import { LLMOutputParser } from '@/lib/llm/output-parser'  // 本 story 新增

// 限流
import { checkRateLimit, checkIpRateLimit } from '@/lib/rate-limit'  // checkIpRateLimit 本 story 新增
```

**3. Platform / Tone 合法枚举值**

```typescript
// 输入校验用（运行时字符串校验）
const VALID_PLATFORMS = ['xiaohongshu', 'wechat', 'zhihu'] as const
const VALID_TONES = ['casual', 'standard', 'formal'] as const
```

**4. SSE 事件格式（架构规范）**

```typescript
function encodeSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// 事件序列（每个 platform）
// platform_start:    { platform: Platform }
// chunk:             { text: string }
// titles:            { titles: string[] }
// tags:              { tags: string[] }
// hook:              { hook: string }
// platform_complete: { platform: Platform; tokens_used: number; cost_cents: number }
// done（普通）:       { record_id: null }           // 3.4b 实现落库后改为真实 uuid
// done（试用）:       { trial: true; record_id: null }
// error:             { message: string; retryable: boolean }
```

**5. SSE 响应构建框架（route.ts 核心逻辑）**

```typescript
const encoder = new TextEncoder()
const stream = new ReadableStream({
  async start(controller) {
    const send = (event: string, data: object) => {
      controller.enqueue(encoder.encode(encodeSSE(event, data)))
    }

    let fatalError = false

    try {
      for (const platform of platforms) {
        if (fatalError) break

        send('platform_start', { platform })

        const parser = new LLMOutputParser()
        let messages
        try {
          messages = await assemblePrompt({ platform, tone, originalText: text })
        } catch (err) {
          send('error', {
            message: err instanceof Error ? err.message : '平台配置异常，请联系管理员',
            retryable: false,
          })
          fatalError = true
          break
        }

        const abortController = new AbortController()
        let unsupportedDetected = false

        await new Promise<void>((resolve) => {
          llmRouter.streamChat({
            model: DEEPSEEK_MODELS.CHAT,
            messages,
            signal: abortController.signal,
            onChunk: (chunk) => {
              const { chunks, unsupported } = parser.processChunk(chunk)
              if (unsupported && !unsupportedDetected) {
                unsupportedDetected = true
                fatalError = true
                send('error', {
                  message: '该内容暂不支持改写，请尝试其他类型的文章',
                  retryable: false,
                })
                abortController.abort()
                return
              }
              if (!unsupportedDetected) {
                for (const c of chunks) send('chunk', { text: c })
              }
            },
            onComplete: (usage: TokenUsage) => {
              if (!unsupportedDetected) {
                const { remainingBodyChunks, titles, tags, hook } = parser.finalize()
                for (const c of remainingBodyChunks) send('chunk', { text: c })
                send('titles', { titles })
                send('tags', { tags })
                send('hook', { hook })
                send('platform_complete', {
                  platform,
                  tokens_used: usage.totalTokens,
                  cost_cents: Math.ceil(usage.totalTokens * 0.001),
                })
              }
              resolve()
            },
            onError: (error) => {
              if (error.code !== 'CANCELLED' && !unsupportedDetected) {
                send('error', { message: error.message, retryable: true })
              }
              resolve()
            },
          })
        })
      }

      if (!fatalError) {
        send('done', isTrial ? { trial: true, record_id: null } : { record_id: null })
      }
    } catch (err) {
      send('error', {
        message: err instanceof Error ? err.message : '改写服务异常，请稍后再试',
        retryable: true,
      })
    } finally {
      controller.close()
    }
  },
})

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  },
})
```

**6. 成本计算（3.4a 临时方案）**

Story 3.4b 实现完整 Cost Tracker。本 story 使用简单估算：
- `cost_cents = Math.ceil(usage.totalTokens * 0.001)` — DeepSeek 约 0.1 元/万 tokens，精度±10%

**7. 认证与试用模式分支**

修改现有桩的 `if (!user)` 分支为：

```typescript
const isTrial = !user

if (isTrial) {
  // 进入试用模式，不返回 401
  const ip = getClientIp(request)
  const ipLimit = checkIpRateLimit(ip)
  if (!ipLimit.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000))
    return Response.json(
      { data: null, error: { code: 'RATE_LIMIT_EXCEEDED', message: '今日试用次数已达上限，注册后可免费无限使用' } },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }
  // 试用模式：platforms 单选校验在 body 解析后进行
}
// 普通模式：已有 checkRateLimit(user.id) 逻辑不变
```

**8. IP 提取辅助函数**

```typescript
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
```

**9. route.test.ts mock 模式**

```typescript
/**
 * @jest-environment node
 */

// TDZ 安全：jest.mock factory 中只用 jest.fn()，外层通过 jest.mocked() 获取类型引用
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  checkIpRateLimit: jest.fn(),
}))
jest.mock('@/lib/llm/llm-router', () => ({
  llmRouter: { streamChat: jest.fn() },
}))
jest.mock('@/lib/llm/prompt-assembler', () => ({
  assemblePrompt: jest.fn().mockResolvedValue([
    { role: 'system', content: 'mock system' },
    { role: 'user', content: 'mock user' },
  ]),
}))

// 辅助：mock streamChat 返回格式化 LLM 输出
const MOCK_LLM_OUTPUT =
  '[CONTENT_TYPE]: 观点分析\n[BODY]:\n测试改写内容\n[TITLE_1]: 标题1\n[TITLE_2]: 标题2\n[TITLE_3]: 标题3\n[TAGS]: 标签1, 标签2\n[HOOK]: 引导语'

function mockStreamChatSuccess() {
  jest.mocked(llmRouter.streamChat).mockImplementation(({ onChunk, onComplete }: StreamChatParams) => {
    onChunk(MOCK_LLM_OUTPUT)
    onComplete({ promptTokens: 100, completionTokens: 200, totalTokens: 300 })
    return Promise.resolve()
  })
}

// SSE 辅助函数
async function collectSSEEvents(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const events: Array<{ event: string; data: Record<string, unknown> }> = []
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
  }
  const blocks = buffer.split('\n\n').filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    const eventLine = lines.find((l) => l.startsWith('event: '))
    const dataLine = lines.find((l) => l.startsWith('data: '))
    if (dataLine) {
      events.push({
        event: eventLine?.slice(7) ?? 'message',
        data: JSON.parse(dataLine.slice(6)),
      })
    }
  }
  return events
}
```

**10. output-parser.ts 与 content-type-parser.ts 的关系**

两者职责不同：
- `content-type-parser.ts`（Story 3.3）：从完整 LLM 输出解析 `[CONTENT_TYPE]:` 标签 → 供 Story 3.4b 落库时使用
- `output-parser.ts`（本 Story）：流式解析 body/titles/tags/hook → 供 SSE 事件发送

不要合并、不要在本 story 中调用 `parseContentType`。

**11. anti-pattern 防范**

- **不**添加 `export const runtime = 'edge'`（Prisma 依赖 Node.js 运行时，edge 不支持 `PrismaPg`）
- **不**在 `onChunk` 回调中 `await`（回调同步，`llmRouter.streamChat` 内部不支持异步 onChunk）
- **不**在 `controller.close()` 之后调用 `controller.enqueue()`（用 `try/finally` 确保顺序）
- **不**重复调用 `controller.close()`（用标志位或 try/finally 确保仅关闭一次）
- **不**在试用模式下保存 `rewrite_records`（3.4b 落库逻辑必须判断 `!isTrial`）
- `DEEPSEEK_MODELS.CHAT` 使用 `types.ts` 中导出的常量，而非硬编码字符串

### 文件位置

```
src/lib/llm/
├── types.ts                       # 已存在（只读）
├── llm-router.ts                  # 已存在（只读）
├── prompt-assembler.ts            # 已存在（只读）
├── content-type-parser.ts         # 已存在（只读）
├── output-parser.ts               # 本 Story 新增
└── __tests__/
    ├── ...（existing，只读）
    └── output-parser.test.ts      # 本 Story 新增

src/lib/
├── rate-limit.ts                  # 已存在，需追加 IP 限流导出

src/app/api/rewrite/
├── route.ts                       # 已存在桩，本 Story 修改
└── __tests__/
    └── route.test.ts              # 已存在，本 Story 更新
```

### Previous Story Intelligence（Story 3.3）

- Prisma 枚举导入路径：`@/generated/prisma/client`（非默认 `node_modules/.prisma`）
- 测试文件顶部必须加 `/** @jest-environment node */` 否则 Node.js API 不可用
- `jest.mock` factory 中不能引用文件顶层 const（TDZ），通过 `jest.fn()` + `jest.mocked()` 获取类型化引用
- `proxy.test.ts` 有 4 个预存在 bug（302 vs 307 状态码），与本 story 无关，不必修复

### References

- SSE 实现模式（完整示例）：`src/app/api/mock-rewrite/route.ts`
- 认证 + 限流桩（待替换）：`src/app/api/rewrite/route.ts`
- LLM Router 单例：`src/lib/llm/llm-router.ts#llmRouter`
- Prompt Assembler：`src/lib/llm/prompt-assembler.ts#assemblePrompt`
- LLM 类型接口：`src/lib/llm/types.ts#StreamChatParams`、`#DEEPSEEK_MODELS`
- 限流实现参考（IP 限流照此模式扩展）：`src/lib/rate-limit.ts`
- 架构 SSE 协议规范：`_bmad-output/planning-artifacts/architecture.md#API & Communication Patterns`
- 现有 route 测试（mock 模式参考）：`src/app/api/rewrite/__tests__/route.test.ts`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

## Change Log

| 日期 | 变更内容 | 操作人 |
|---|---|---|
| 2026-03-27 | 创建 story 文件 | SM (create-story) |
