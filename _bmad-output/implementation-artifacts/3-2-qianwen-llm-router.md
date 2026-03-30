# Story 3.2: 通义千问适配器与 LLM Router

Status: done

## Story

作为系统，
我想在 DeepSeek 调用失败时自动切换到通义千问，
以便单个 LLM 提供商故障不影响用户的改写体验。

## Acceptance Criteria

1. **Given** DeepSeek API 返回错误或超时
   **When** LLM Router 捕获到错误
   **Then** 自动切换到通义千问适配器发起重试，用户侧流式输出不中断（从 Qwen 重新开始生成）

2. **Given** DeepSeek 和通义千问两个提供商均失败
   **When** Router 捕获到第二个错误
   **Then** Router 触发 `onError` 回调，返回可读的中文错误描述，错误码为 `API_ERROR`

3. **Given** 上层业务代码调用 LLM Router
   **When** 任意提供商处理请求
   **Then** `src/lib/llm/llm-router.ts` 对上层透明地实现主备切换，上层无需感知当前使用哪个提供商（满足 NFR9、NFR11）

4. **Given** 通义千问 API Key 配置
   **When** 通义千问适配器初始化
   **Then** API Key 仅从 `env.QWEN_API_KEY` 读取，不在任何客户端代码中出现（满足 NFR7）

5. **Given** 通义千问 API 请求处理
   **When** 请求超过 30 秒
   **Then** 触发 `onError` 回调，错误类型为 `TIMEOUT`（与 DeepSeek 适配器超时行为一致）

## Tasks / Subtasks

- [x] **实现通义千问适配器 `src/lib/llm/providers/qwen.ts`** (AC: #1, #4, #5)
  - [x] 定义 `QWEN_CONFIG` 常量：`{ baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', timeoutMs: 30000 }`
  - [x] 定义 `QWEN_MODELS` 常量：`{ CHAT: 'qwen-plus' }`（默认模型，平衡成本与质量）
  - [x] 实现 `QwenProvider` 类，实现 `LLMProvider` 接口
  - [x] 在构造函数中通过 `env.QWEN_API_KEY` 注入 API Key（`import { env } from '@/lib/env'`）
  - [x] 实现 `streamChat`：复用 DeepSeek 的所有健壮性设计
    - [x] `AbortController` + `setTimeout` 30 秒超时
    - [x] 外部 `signal` 合并处理（`abortListener` + `removeEventListener`）
    - [x] `completed` 标志防止 `onComplete`/`onError` 重复触发
    - [x] SSE 流解析（与 DeepSeek 相同格式，OpenAI-compatible）
    - [x] 流截断（无 `[DONE]`）时触发 `onError(NETWORK_ERROR)`
    - [x] 非 200 响应时读取响应体详细错误
    - [x] `finally { reader.cancel() }` 防止 reader 锁泄漏
    - [x] fetch 抛异常时不透传原始 Error（防 API Key 泄漏）
  - [x] 导出单例：`export const qwenProvider = new QwenProvider()`

- [x] **实现 LLM Router `src/lib/llm/llm-router.ts`** (AC: #1, #2, #3)
  - [x] 实现 `LLMRouter` 类，实现 `LLMProvider` 接口
  - [x] 构造函数接受 `primary: LLMProvider`（deepseekProvider）和 `fallback: LLMProvider`（qwenProvider）
  - [x] 实现 `streamChat` 主备切换逻辑：
    - [x] 首先用 `primary` 发起调用，正常流式传递 `onChunk`
    - [x] `primary` 触发 `onError` 时 → 切换到 `fallback` 重新发起完整调用
    - [x] `fallback` 也触发 `onError` 时 → 调用上层 `onError`，message 包含"两个 LLM 提供商均不可用，请稍后重试"
    - [x] 切换到 `fallback` 前不调用上层 `onError`（透明重试）
    - [x] 已取消（`CANCELLED` 错误码）时不触发 fallback，直接透传 `onError`
  - [x] 导出单例：`export const llmRouter = new LLMRouter(deepseekProvider, qwenProvider)`

- [x] **编写通义千问适配器单元测试 `src/lib/llm/__tests__/qwen.test.ts`** (AC: #1, #4, #5)
  - [x] 添加 `@jest-environment node` 指令（顶部注释）
  - [x] Mock `@/lib/env`：`jest.mock('@/lib/env', () => ({ env: { QWEN_API_KEY: 'test-key' } }))`
  - [x] Mock 全局 `fetch`：`jest.spyOn(global, 'fetch')`
  - [x] 测试：正常流式响应 - `onChunk` 收到多个文本片段，`onComplete` 收到正确 token 用量
  - [x] 测试：30 秒超时触发 `onError({ code: 'TIMEOUT' })`（`jest.useFakeTimers()`）
  - [x] 测试：API 返回 401 时触发 `onError({ code: 'API_ERROR', statusCode: 401 })`
  - [x] 测试：fetch 网络异常触发 `onError({ code: 'NETWORK_ERROR' })`
  - [x] 测试：流截断（无 `[DONE]`）触发 `onError({ code: 'NETWORK_ERROR' })`

- [x] **编写 LLM Router 单元测试 `src/lib/llm/__tests__/llm-router.test.ts`** (AC: #1, #2, #3)
  - [x] 添加 `@jest-environment node` 指令
  - [x] Mock primary 和 fallback provider（实现 `LLMProvider` 接口的 mock 对象）
  - [x] 测试：primary 成功 → `onChunk` + `onComplete` 正常触发，fallback 未被调用
  - [x] 测试：primary `onError` → 自动切换 fallback，fallback 正常完成
  - [x] 测试：primary + fallback 均 `onError` → 上层 `onError` 被调用，message 含"两个 LLM 提供商均不可用"
  - [x] 测试：primary `CANCELLED` 时不触发 fallback，直接透传 `onError`

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | `QWEN_API_KEY` 已在 `src/lib/env.ts` schema 中声明；`.env.local` 需有真实值，但单测时 mock | 自动 |

### 关键架构约束（必须遵守）

**1. 通义千问 API 技术规格**

- **API 端点：** `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- **协议：** OpenAI-compatible（与 DeepSeek 格式完全一致，同样的 SSE 解析逻辑可直接复用）
- **认证：** `Authorization: Bearer ${QWEN_API_KEY}`
- **推荐模型：** `qwen-plus`（平衡成本与质量，备选首选；`qwen-turbo` 更快更便宜但质量稍低）
- **流式：** `stream: true`，SSE 格式与 OpenAI 完全兼容（同 DeepSeek）
- **成本参考：** qwen-plus 约 0.3-0.8 元/百万 tokens，比 deepseek-chat 略贵但稳定性高

**2. `QWEN_API_KEY` 已在 `env.ts` 声明**

```typescript
// src/lib/env.ts（已存在，Story 1.1 实现）
QWEN_API_KEY: z.string().min(1),
```

通义千问适配器导入方式：

```typescript
import { env } from '@/lib/env'
// 使用：env.QWEN_API_KEY
```

**3. `providers/` 目录已存在，直接添加 `qwen.ts`**

`src/lib/llm/providers/` 已在 Story 3.1 创建，内有 `deepseek.ts`，直接并列添加 `qwen.ts`：

```
src/lib/llm/providers/
├── deepseek.ts     # Story 3.1 已实现（只读，不修改）
└── qwen.ts         # 本 Story 新增
```

**4. `qwen.ts` 完全复用 `deepseek.ts` 的 SSE 解析架构**

通义千问 DashScope 兼容模式 SSE 格式与 DeepSeek 完全相同（均为 OpenAI-compatible）：

```
data: {"id":"...","choices":[{"delta":{"content":"你好"},"finish_reason":null}],"usage":null}

data: {"id":"...","choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}

data: [DONE]
```

可以将 `deepseek.ts` 中的 `parseSSEStream` 函数逻辑原样复制（或抽成 `src/lib/llm/parse-sse.ts` 共享——可选优化，不强制）。关键是 `qwen.ts` 必须包含所有 Story 3.1 code review 修复：
- `completed` 标志防重复回调
- `AbortController` 双重控制
- 流截断检测
- `finally { reader.cancel() }`
- 非 200 响应读取响应体

**5. LLM Router 设计原则**

Router 本身实现 `LLMProvider` 接口，对上层完全透明：

```typescript
export class LLMRouter implements LLMProvider {
  constructor(
    private readonly primary: LLMProvider,
    private readonly fallback: LLMProvider,
  ) {}

  async streamChat(params: StreamChatParams): Promise<void> {
    // 尝试 primary，失败则切换 fallback
  }
}

export const llmRouter = new LLMRouter(deepseekProvider, qwenProvider)
```

切换逻辑关键要点：
- primary `onError` 时，**不调用上层 `onError`**，静默切换到 fallback
- 切换到 fallback 时，**重新发起完整调用**（传入相同的 `model`、`messages`、`signal`）
- `CANCELLED` 错误码代表用户主动取消，**不触发 fallback**，直接透传给上层
- fallback 调用时使用 fallback 自己的模型（`QWEN_MODELS.CHAT`），而非 primary 的模型

**6. Router 的 `model` 参数处理**

Router 在调用 fallback 时，需要将 primary 的 model 名（`deepseek-chat`）替换为 fallback 的 model 名（`qwen-plus`）。实现方式：

```typescript
// 调用 primary 时使用传入的 model
await this.primary.streamChat({ ...params, onError: primaryErrorHandler })

// 切换 fallback 时替换 model
await this.fallback.streamChat({ ...params, model: QWEN_MODELS.CHAT, onError: fallbackErrorHandler })
```

**7. 测试环境需 `@jest-environment node`**

参照 `src/lib/llm/__tests__/deepseek.test.ts` 模式，所有 LLM 相关测试文件顶部必须加：

```typescript
/**
 * @jest-environment node
 */
```

**8. 单例导出模式**

与 `deepseekProvider` 完全一致，导出单例供 Story 3.4a 的 API Route 直接 import：

```typescript
// qwen.ts
export const qwenProvider = new QwenProvider()

// llm-router.ts
export const llmRouter = new LLMRouter(deepseekProvider, qwenProvider)
```

Story 3.4a 将 `import { llmRouter } from '@/lib/llm/llm-router'`，不直接 import 具体 provider。

### Story 3.1 代码 Review 学习（必须在本 Story 中继承）

以下是 3-1 code review 发现的问题，**本 Story 必须从一开始就避免**（不要实现了再修）：

| 问题 | 解决方案 |
|---|---|
| `onError` 被多次调用（超时+网络竞态） | `completed` 标志 + `safeOnError` / `safeOnComplete` wrapper |
| 流截断（stream done 但无 `[DONE]`）导致 UI 永久 loading | done=true 后未收到 `[DONE]` 时触发 `onError(NETWORK_ERROR)` |
| buffer 中最后一行未处理 | done=true 时追加 `'\n'` 强制处理残留行 |
| 流中内嵌 API 错误（`parsed.error` 字段）被静默吞掉 | 解析时检查 `parsed.error` |
| `reader` 锁泄漏 | `finally { reader.cancel().catch(() => {}) }` |
| 非 200 响应缺少详细错误信息 | `await response.json()` 读取 body 中的 error.message |
| fetch catch 透传原始 Error（含 API Key） | 手动构造中文错误描述，不透传原始错误 |
| signal 事件监听器内存泄漏 | `abortListener` 用具名函数，后续 `removeEventListener` |
| AbortError 检测不准确 | `err instanceof Error && err.name === 'AbortError'` |

### 文件结构变更

本 Story 涉及以下文件（均为新增）：

```
src/lib/llm/
├── types.ts                    # 已存在（只读，不修改）
├── llm-router.ts               # 新增：LLM 路由主备切换逻辑
├── providers/
│   ├── deepseek.ts             # 已存在（只读，不修改）
│   └── qwen.ts                 # 新增：通义千问适配器
└── __tests__/
    ├── types.test.ts           # 已存在（只读）
    ├── deepseek.test.ts        # 已存在（只读）
    ├── qwen.test.ts            # 新增：通义千问适配器测试
    └── llm-router.test.ts      # 新增：LLM Router 测试
```

**不修改的文件：**
- `src/lib/llm/types.ts`（接口定义已完整，无需新增类型）
- `src/lib/llm/providers/deepseek.ts`（已实现，不动）
- `src/lib/env.ts`（`QWEN_API_KEY` 已声明）
- `src/app/api/rewrite/route.ts`（保持桩实现不变，由 Story 3.4a 替换）

### 与后续 Story 的接口约定

本 Story 建立的 Router 接口将被以下 Story 直接使用：

- **Story 3.4a**：`import { llmRouter } from '@/lib/llm/llm-router'`，通过 Router 调用 LLM（不直接调用具体 provider）
- **Story 3.3**（Prompt Assembler）：不依赖本 Story，但 3.4a 会同时调用 3.3 和本 Story 的产出

### 参考资料

- 已实现 DeepSeek 适配器：`src/lib/llm/providers/deepseek.ts`（本 Story 实现的直接参考）
- LLM 接口定义：`src/lib/llm/types.ts`
- 测试模式参考：`src/lib/llm/__tests__/deepseek.test.ts`（`@jest-environment node` + mock 模式）
- 架构文档 LLM 章节：`_bmad-output/planning-artifacts/architecture.md` → "LLM 集成架构"
- API Key 配置：`src/lib/env.ts`（`QWEN_API_KEY` 字段）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

无

### Completion Notes List

- 实现了 `QwenProvider` 类，完全复用 DeepSeek 适配器的所有健壮性设计（completed 标志、AbortController 双控、流截断检测、reader 锁防泄漏、非 200 详细错误读取、API Key 防泄漏）
- 实现了 `LLMRouter` 类，透明主备切换：primary 失败时静默切换 fallback，CANCELLED 不触发 fallback
- 所有新增测试（9 个）全部通过，现有测试无回归
- `llm-router.test.ts` 需要 mock `@/lib/env` 因为导入链包含 deepseekProvider（间接依赖 env）

### File List

新增文件（相对项目根路径）：

- `src/lib/llm/providers/qwen.ts`
- `src/lib/llm/llm-router.ts`
- `src/lib/llm/__tests__/qwen.test.ts`
- `src/lib/llm/__tests__/llm-router.test.ts`

### Review Findings

- [x] [Review][Decision] onChunk 未在切换 fallback 时重置 — 选方案 2：缓冲 primary chunks，primary 成功时统一转发，失败时丢弃，fallback 直接流式输出 → 已修复为 llm-router.ts P4
- [x] [Review][Patch] AC2：.catch() 分支错误码应为 API_ERROR 而非 NETWORK_ERROR [llm-router.ts:40-43,55-58]
- [x] [Review][Patch] AC2：fallback onError 错误码未强制覆盖为 API_ERROR（spread 保留了 fallback 原始 code）[llm-router.ts:28-33]
- [x] [Review][Patch] primary .catch() 完全绕过 fallback 直接透传 onError [llm-router.ts:55-58]
- [x] [Review][Patch] safeOnError 触发后 onChunk 仍未被拦截，超时/取消后依旧有 chunk 回调 [qwen.ts:113-117,190]
- [x] [Review][Patch] params.signal 已处于 aborted 状态时 addEventListener 不会触发，取消意图被忽略 [qwen.ts:136]
- [x] [Review][Patch] TextDecoder 流结束时未调用 decoder.decode()（无参数），末尾多字节 UTF-8 序列静默丢失 [qwen.ts:29]
- [x] [Review][Defer] 多行 SSE data 字段未合并 [qwen.ts:parseSSEStream] — deferred, OpenAI-compatible API 实际不使用多行 data 字段

## Change Log

| 日期 | 变更内容 | 操作人 |
|---|---|---|
| 2026-03-27 | 创建 story 文件 | SM (create-story) |
| 2026-03-27 | 实现通义千问适配器、LLM Router 及对应单元测试（9 个测试全部通过） | Dev Agent (claude-sonnet-4-6) |
| 2026-03-27 | Code review：1 decision-needed，5 patch，1 defer，12 dismissed | Code Review (claude-sonnet-4-6) |
