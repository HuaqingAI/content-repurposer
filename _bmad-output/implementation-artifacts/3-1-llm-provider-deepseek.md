# Story 3.1: LLM Provider 接口与 DeepSeek 适配器

Status: done

## Story

作为开发者，
我想定义统一的 LLM Provider 接口并实现 DeepSeek 适配器，
以便所有 LLM 调用通过统一接口进行，后续切换提供商无需修改上层代码。

## Acceptance Criteria

1. **Given** `LLMProvider` 接口已在 `src/lib/llm/types.ts` 中定义（含 `streamChat` 方法）
   **When** 调用 DeepSeek 适配器的 `streamChat` 方法
   **Then** 适配器向 DeepSeek API 发送请求，通过 `onChunk` 回调逐步返回文本片段，完成后通过 `onComplete` 返回 token 用量

2. **Given** DeepSeek API 请求处理超过 30 秒
   **When** 超时阈值触发
   **Then** 触发 `onError` 回调，错误类型为超时，流式输出终止

3. **Given** DeepSeek API Key 配置
   **When** 适配器初始化或发出请求
   **Then** API Key 仅从 `src/lib/env.ts` 的 `env.DEEPSEEK_API_KEY` 读取，不在任何客户端代码或前端可见路径中出现（满足 NFR7）

4. **Given** DeepSeek API 返回非 200 状态码
   **When** 适配器处理响应
   **Then** 触发 `onError` 回调，错误包含状态码和可读的中文错误描述

5. **Given** DeepSeek API 流式响应中包含 `[DONE]` 标记
   **When** 适配器解析 SSE 事件
   **Then** 调用 `onComplete` 回调，携带完整的 `TokenUsage`（`promptTokens`、`completionTokens`、`totalTokens`）

## Tasks / Subtasks

- [x] **定义 LLM 接口类型 `src/lib/llm/types.ts`** (AC: #1, #3)
  - [x] 定义 `ChatMessage` 接口：`{ role: 'system' | 'user' | 'assistant'; content: string }`
  - [x] 定义 `TokenUsage` 接口：`{ promptTokens: number; completionTokens: number; totalTokens: number }`
  - [x] 定义 `LLMError` 接口：`{ code: 'TIMEOUT' | 'API_ERROR' | 'NETWORK_ERROR' | 'PARSE_ERROR'; message: string; statusCode?: number }`
  - [x] 定义 `StreamChatParams` 接口（含 `model`、`messages`、`onChunk`、`onComplete`、`onError`、`signal?`）
  - [x] 定义 `LLMProvider` 接口：`streamChat(params: StreamChatParams): Promise<void>`
  - [x] 定义 `DEEPSEEK_MODELS` 常量：`{ CHAT: 'deepseek-chat' }`（默认模型）

- [x] **实现 DeepSeek 适配器 `src/lib/llm/providers/deepseek.ts`** (AC: #1, #2, #3, #4, #5)
  - [x] 定义 `DEEPSEEK_CONFIG` 常量：`{ baseUrl: 'https://api.deepseek.com', timeoutMs: 30000 }`
  - [x] 实现 `DeepSeekProvider` 类，实现 `LLMProvider` 接口
  - [x] 在构造函数中通过 `env.DEEPSEEK_API_KEY` 注入 API Key（`import { env } from '@/lib/env'`）
  - [x] 实现 `streamChat`：使用原生 `fetch` + `AbortController` 发起流式请求
    - [x] 设置 30 秒超时：`AbortController` + `setTimeout`，超时时调用 `controller.abort()` 后触发 `onError({ code: 'TIMEOUT', message: '请求超时，请稍后重试' })`
    - [x] 请求头设置：`Authorization: Bearer ${apiKey}`、`Content-Type: application/json`
    - [x] 请求体：`{ model, messages, stream: true, max_tokens: 4096 }`
    - [x] 非 200 响应时触发 `onError({ code: 'API_ERROR', message: ..., statusCode })`
    - [x] 解析 SSE 流：按行读取 `ReadableStream`，处理 `data: ...` 前缀，跳过 `data: [DONE]` 前先调用 `onChunk`
    - [x] 收到 `[DONE]` 标记时，从最后一个 chunk 的 `usage` 字段提取 token 用量，调用 `onComplete`
    - [x] 网络错误（fetch 抛异常且非 abort）时触发 `onError({ code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络' })`
    - [x] 流解析失败时触发 `onError({ code: 'PARSE_ERROR', message: '响应解析失败' })`
  - [x] 导出单例：`export const deepseekProvider = new DeepSeekProvider()`

- [x] **编写 DeepSeek 适配器单元测试 `src/lib/llm/__tests__/deepseek.test.ts`** (AC: #1, #2, #4, #5)
  - [x] 添加 `@jest-environment node` 指令（SSE 流式测试需 node 环境，与 rate-limit.test.ts 保持一致）
  - [x] Mock `@/lib/env`：`jest.mock('@/lib/env', () => ({ env: { DEEPSEEK_API_KEY: 'test-key' } }))`
  - [x] Mock 全局 `fetch`：`jest.spyOn(global, 'fetch')`
  - [x] 测试：正常流式响应 - `onChunk` 收到多个文本片段，`onComplete` 收到正确 token 用量
  - [x] 测试：30 秒超时触发 `onError({ code: 'TIMEOUT' })`（使用 `jest.useFakeTimers()` + `jest.advanceTimersByTime(30001)`）
  - [x] 测试：API 返回 401 时触发 `onError({ code: 'API_ERROR', statusCode: 401 })`
  - [x] 测试：API 返回 500 时触发 `onError({ code: 'API_ERROR', statusCode: 500 })`
  - [x] 测试：fetch 网络异常（throw Error）时触发 `onError({ code: 'NETWORK_ERROR' })`
  - [x] 测试：`onChunk` 不被调用（`[DONE]` 事件直接触发 `onComplete`，usage 为 0 时的边界情况）

- [x] **编写类型定义测试 `src/lib/llm/__tests__/types.test.ts`** (AC: #1)
  - [x] 测试：`DEEPSEEK_MODELS.CHAT` 值为 `'deepseek-chat'`
  - [x] 测试：`DeepSeekProvider` 实例满足 `LLMProvider` 接口（TypeScript 类型层面验证，通过 `deepseekProvider satisfies LLMProvider` 断言）

### Review Findings (AI) — 2026-03-27

#### Decision Needed

- [x] [Review][Decision] 外部 signal abort 后应通知调用方 — 已决策：选 a，新增 `CANCELLED` 错误码，signal abort 时调用 `onError({code:'CANCELLED'})`，保证回调契约完整（总以 onComplete 或 onError 结束）

#### Review Follow-ups (AI)

- [x] [Review][Patch][HIGH] 添加 `completed` 标志防止 onError 被多次调用（超时+网络竞态） [deepseek.ts:74]
- [x] [Review][Patch][HIGH] 流截断（stream done 但无 `[DONE]`）时触发 `onError(NETWORK_ERROR)`，防止 UI 永久 loading [deepseek.ts:22]
- [x] [Review][Patch][HIGH] done=true 时处理 buffer 中残留行，防止最后一条 SSE 消息丢失 [deepseek.ts:27]
- [x] [Review][Patch][HIGH] 检查 `parsed.error` 字段，流中内嵌 API 错误不再被静默吞掉 [deepseek.ts:42]
- [x] [Review][Patch][MED] `parseSSEStream` 添加 `finally { reader.cancel() }` 防止 reader 锁泄漏 [deepseek.ts:15]
- [x] [Review][Patch][MED] 非 200 响应时读取 response body 错误详情，丰富 `API_ERROR` 的 message [deepseek.ts:96]
- [x] [Review][Patch][MED] `onComplete` 前检查 `finalUsage.totalTokens === 0` 时记录 warn 日志（AC5 语义保护） [deepseek.ts:35]
- [x] [Review][Patch][LOW] fetch catch 中不透传原始 Error 对象，防止请求头（含 API Key）泄漏到日志 [deepseek.ts:87]
- [x] [Review][Patch][LOW] signal 事件监听器添加 `removeEventListener` 防止内存泄漏 [deepseek.ts:79]
- [x] [Review][Patch][LOW] AbortError 检测改为 `instanceof Error && err.name === 'AbortError'` [deepseek.ts:57]
- [x] [Review][Patch][TEST] `beforeEach` 中 `jest.clearAllMocks()` 应在 `fetchSpy` 赋值之前执行 [deepseek.test.ts:35]
- [x] [Review][Patch][TEST] 超时测试改用 `await streamPromise` 替代多次 `await Promise.resolve()` [deepseek.test.ts:90]
- [x] [Review][Patch][TEST] 补充测试：流截断（无 `[DONE]`）、外部 AbortSignal 取消、onError 防重 [deepseek.test.ts]

#### Deferred

- [x] [Review][Defer] `max_tokens: 4096` 硬编码 [deepseek.ts:93] — deferred，Story 3.3 prompt assembler 处理参数配置
- [x] [Review][Defer] SSE `event:` 类型行未处理 [deepseek.ts:31] — deferred，DeepSeek API 不使用 event 类型，非当前场景需求
- [x] [Review][Defer] 30s 超时对于长文章生成可能不足 [deepseek.ts:74] — deferred，可接受 MVP 限制，后续通过配置调整
- [x] [Review][Defer] 单例 `deepseekProvider` 在 API Key 轮换时需重启服务 [deepseek.ts:129] — deferred，架构决策，当前可接受

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全为代码实现。`DEEPSEEK_API_KEY` 已在 Story 1.1 的 `env.ts` schema 中声明，`.env.local` 需有真实值但测试时 mock | 自动 |

### 关键架构约束（必须遵守）

**1. API Key 只从 `env.ts` 读取（NFR7）**

`src/lib/env.ts` 已有 `DEEPSEEK_API_KEY` 字段定义且使用 `import 'server-only'`，保证 Key 不泄露前端：

```typescript
// src/lib/env.ts（已存在，Story 1.1 实现）
import 'server-only'
// ...
DEEPSEEK_API_KEY: z.string().min(1),
```

DeepSeek 适配器导入方式：

```typescript
import { env } from '@/lib/env'
// 使用：env.DEEPSEEK_API_KEY
```

**2. `providers/` 目录已存在**

`src/lib/llm/providers/` 目录已创建（Story 1.1 阶段），直接在其中创建 `deepseek.ts`，无需 `mkdir`。

**3. 流式解析必须使用 `ReadableStream` + 逐行处理（与 SSE 协议一致）**

DeepSeek API 流式响应格式（OpenAI-compatible SSE）：

```
data: {"id":"...","choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"...","choices":[{"delta":{"content":" world"},"finish_reason":null}],"usage":null}

data: {"id":"...","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]
```

解析策略：
- 按行读取（`\n` 分割），跳过空行和非 `data:` 前缀行
- 遇 `data: [DONE]` 时终止
- `finish_reason: 'stop'` 的 chunk 中的 `usage` 字段即为最终 token 用量

**4. `AbortController` 用于双重 abort 控制**

传入的 `signal`（来自外部，如用户取消）和内部超时 signal 需合并处理：

```typescript
// 外部 signal abort（用户取消）
params.signal?.addEventListener('abort', () => {
  controller.abort()
  clearTimeout(timeoutId)
})
```

**5. 测试环境需 `@jest-environment node`**

参照 `src/lib/__tests__/rate-limit.test.ts` 的模式，LLM 相关测试文件顶部必须加：

```typescript
/**
 * @jest-environment node
 */
```

原因：`ReadableStream`/`fetch` 在 jsdom 环境中行为与 Node.js 不一致。

**6. 单例导出模式**

与项目其他 service 模块一致（参照 `src/lib/supabase/server.ts` 工厂函数风格），`deepseek.ts` 导出单例 `deepseekProvider`，上层 Router（Story 3.2）直接 import 使用：

```typescript
export const deepseekProvider = new DeepSeekProvider()
```

### DeepSeek API 技术规格

- **API 端点：** `https://api.deepseek.com/chat/completions`
- **协议：** OpenAI-compatible（与 openai SDK 兼容，但本 Story 使用原生 `fetch` 实现，不引入 SDK 依赖）
- **默认模型：** `deepseek-chat`（DeepSeek V3，2025 年 3 月最新稳定版）
- **流式参数：** 请求体中添加 `"stream": true`
- **超时设定：** 30 秒（与架构文档一致，`DEEPSEEK_CONFIG.timeoutMs = 30000`）
- **成本参考：** deepseek-chat 约 0.1-0.3 元/百万 tokens，2000 字改写约消耗 3000-5000 tokens，单次成本约 0.03-0.05 元（满足 NFR：<0.3 元/次）

### SSE 流解析参考实现

```typescript
async function parseSSEStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (text: string) => void,
  onComplete: (usage: TokenUsage) => void,
  onError: (error: LLMError) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const data = trimmed.slice(5).trim()
        if (data === '[DONE]') {
          onComplete(finalUsage)
          return
        }

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) onChunk(delta)

          // 提取最终 usage（在 finish_reason: 'stop' 的 chunk 中）
          if (parsed.usage) {
            finalUsage = {
              promptTokens: parsed.usage.prompt_tokens ?? 0,
              completionTokens: parsed.usage.completion_tokens ?? 0,
              totalTokens: parsed.usage.total_tokens ?? 0,
            }
          }
        } catch {
          // 跳过非 JSON 行（正常情况，如 keep-alive 心跳）
        }
      }
    }
  } catch (err) {
    // reader.read() 抛异常（通常是 abort）
    if ((err as Error).name !== 'AbortError') {
      onError({ code: 'NETWORK_ERROR', message: '网络连接失败，请检查网络' })
    }
  }
}
```

### 文件结构变更

本 Story 涉及以下文件（均为新增）：

```
src/lib/llm/
├── types.ts                    # 新增：LLMProvider 接口 + 公共类型
├── providers/
│   └── deepseek.ts             # 新增：DeepSeek 适配器
└── __tests__/
    ├── types.test.ts           # 新增：类型和常量测试
    └── deepseek.test.ts        # 新增：DeepSeek 适配器单元测试
```

**不修改的文件：**
- `src/lib/env.ts`（`DEEPSEEK_API_KEY` 已定义）
- `src/app/api/rewrite/route.ts`（保持 Story 2.5 的桩实现不变，由 Story 3.4a 替换）

### 与后续 Story 的接口约定

本 Story 建立的接口将被以下 Story 直接使用：

- **Story 3.2**：`LLMProvider` 接口 + `DeepSeekProvider` 实例（Router 的主提供商）
- **Story 3.4a**：通过 Router 间接调用（不直接依赖本 Story 的实现细节）

`types.ts` 中的类型定义须保持向后兼容，后续 Story 不应需要修改本文件。

### 参考资料

- LLM 接口架构：`_bmad-output/planning-artifacts/architecture.md` → "LLM 集成架构" 章节
- API Key 管理规范：`_bmad-output/planning-artifacts/architecture.md` → "配置管理规范"
- `env.ts` 已有字段：`src/lib/env.ts`（`DEEPSEEK_API_KEY`、`QWEN_API_KEY` 均已声明）
- 测试模式参考：`src/lib/__tests__/rate-limit.test.ts`（`@jest-environment node` + `jest.useFakeTimers`）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

（开发过程中填写）

### Completion Notes List

- 实现了 `LLMProvider` 接口及相关类型（`ChatMessage`、`TokenUsage`、`LLMError`、`StreamChatParams`）于 `src/lib/llm/types.ts`
- 实现了 `DeepSeekProvider` 类：原生 `fetch` + SSE 流解析，支持 30s 超时、外部 signal 合并、错误分类（TIMEOUT/API_ERROR/NETWORK_ERROR/PARSE_ERROR）
- API Key 仅从 `env.DEEPSEEK_API_KEY`（`server-only` 模块）读取，满足 NFR7 安全要求
- 导出单例 `deepseekProvider`，供后续 Story 3.2 LLM Router 使用
- 编写了 8 个单元测试，全部通过（6 个 deepseek.test.ts + 2 个 types.test.ts）
- 超时测试使用 `jest.useFakeTimers()` + mock fetch 响应 AbortSignal 的方式验证
- `proxy.test.ts` 中 4 个关于 307/302 的失败为预存在问题，与本 Story 无关

### File List

- `src/lib/llm/types.ts` （新增，含 CANCELLED 错误码）
- `src/lib/llm/providers/deepseek.ts` （新增，含全部 code-review patch）
- `src/lib/llm/__tests__/deepseek.test.ts` （新增，11 个测试）
- `src/lib/llm/__tests__/types.test.ts` （新增，2 个测试）
- `_bmad-output/implementation-artifacts/sprint-status.yaml` （修改：3-1 状态 → done）
- `_bmad-output/implementation-artifacts/deferred-work.md` （追加 4 条 defer）

## Change Log

| 日期 | 变更内容 | 操作人 |
|---|---|---|
| 2026-03-27 | 创建 story 文件 | SM (create-story) |
| 2026-03-27 | 实现 LLM 接口类型、DeepSeek 适配器、单元测试（8/8 通过） | Dev (claude-sonnet-4-6) |
| 2026-03-27 | Code review：批量修复 14 个 patch（含 CANCELLED 错误码、竞态防护、流截断处理、reader 锁释放等），测试扩充至 11 个 | Dev (claude-sonnet-4-6) |
