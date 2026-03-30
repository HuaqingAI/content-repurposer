# Story 4a.5: 改写失败恢复体验

Status: done

## Story

作为内容创作者，
我想在改写过程中出现错误时能清楚了解发生了什么并一键重试，
以便 LLM 偶发故障不会让我的工作完全中断。

## Acceptance Criteria

1. **Given** 改写进行中某个平台的 LLM 调用失败，SSE 返回 `error` 事件（`retryable: true`），**When** 前端收到该事件，**Then** 显示错误提示："改写遇到问题，请重试"，并展示"重试"按钮

2. **Given** 改写进行中已完成第一个平台，第二个平台 LLM 调用失败，**When** 前端收到 `error` 事件，**Then** 第一个平台的改写结果保留展示，不因错误被清空

3. **Given** 错误提示横幅已展示，**When** 用户点击"重试"按钮，**Then** 重新发起完整改写请求（所有已选平台重新生成），旧结果在新请求开始时清空

4. **Given** 改写请求在建立连接前失败（网络错误 / HTTP 非 2xx），**When** 前端捕获到错误，**Then** 显示全局错误提示，提供"重新改写"按钮（非"重试"），因为无已完成的平台内容

5. **Given** 任意错误场景，**When** 错误提示展示，**Then** 文案明确可读（如"改写遇到问题，请重试"/"网络连接失败，请重新改写"），不显示技术性错误代码（如 "HTTP 500"、原始异常 message）

## Tasks / Subtasks

- [x] **修改 `use-rewrite-stream.ts`：接入真实 API + 错误规范化 + AbortController** (AC: #1, #4, #5)
  - [x] 切换端点：`/api/mock-rewrite` → `/api/rewrite`
  - [x] 添加 request body：`JSON.stringify({ text, platforms, tone })`，添加 `Content-Type: application/json` header
  - [x] 添加 `AbortController` ref，`startStream` 入口 abort 旧流再建新流
  - [x] `useEffect` cleanup：组件卸载时 abort 当前流（需将 hook 从纯函数升级为使用 React hooks）
  - [x] SSE `error` 事件处理：`retryable: true` → 固定文案"改写遇到问题，请重试"；`retryable: false` → 使用 SSE `data.message`（用户友好的不支持提示）
  - [x] 网络/HTTP 错误（catch 块）：统一显示"网络连接失败，请重新改写"，不暴露 `err.message` 或 HTTP 状态码
  - [x] `AbortError` 静默处理（abort 是主动行为，不设 streamError）
  - [x] `done` 事件收到后 `break` 退出读循环，不等 TCP 关闭

- [x] **修改 `rewrite-workspace.tsx`：区分"重试"/"重新改写"按钮文案** (AC: #3, #4)
  - [x] 计算 `hasPartialResults`：`streamError !== null && Object.keys(streamingTexts).length > 0`
  - [x] 错误横幅内按钮文案：`hasPartialResults ? '重试' : '重新改写'`（两者均调用 `startStream`）

- [x] **更新 `rewrite-workspace.test.tsx`：覆盖错误横幅新分支** (AC: #1, #3, #4)
  - [x] 无 partial results 时错误横幅显示"重新改写"按钮
  - [x] 有 partial results（streamingTexts 非空）时显示"重试"按钮
  - [x] 两个按钮均调用 `startStream`
  - [x] 更新已有"重试"测试（当前用例无 streamingTexts，按新逻辑按钮文案变为"重新改写"）

- [x] **新增 `use-rewrite-stream.test.ts`：覆盖错误消息规范化逻辑** (AC: #1, #4, #5)
  - [x] SSE `error` 事件 `retryable: true` → store 收到"改写遇到问题，请重试"
  - [x] SSE `error` 事件 `retryable: false` → store 收到 SSE message 原文
  - [x] HTTP 非 2xx → store 收到"网络连接失败，请重新改写"
  - [x] 网络异常（fetch throw） → store 收到"网络连接失败，请重新改写"
  - [x] AbortError → store **不**调用 `setStreamError`（静默退出）

## Dev Notes

### 关键架构约束（必须遵守）

**目录规范：**
- 修改文件：`src/features/rewrite/use-rewrite-stream.ts`、`src/features/rewrite/rewrite-workspace.tsx`
- 更新测试：`src/features/rewrite/__tests__/rewrite-workspace.test.tsx`
- 新增测试：`src/features/rewrite/__tests__/use-rewrite-stream.test.ts`
- 文件名：`kebab-case`，组件名：`PascalCase`

**禁止修改的文件：**
- `src/features/rewrite/rewrite-store.ts` — store 接口已满足，无需改动
- `src/features/rewrite/text-input.tsx` / `platform-selector.tsx` / `tone-selector.tsx` / `streaming-text.tsx`
- `src/lib/llm/` — LLM 服务层，绝对禁止修改
- `src/app/api/rewrite/route.ts` — 真实改写 API，不修改

**SSE 消费协议（继承自 Story 4a.3 / 4a.4）：**
- 使用原生 `fetch` + `ReadableStream`，禁止 `EventSource`
- 按 `\n\n` 分割事件块，解析 `event:` 和 `data:` 行
- **本 Story 起切换真实端点：`POST /api/rewrite`**（Story 3.4a 已实现）

**真实 API 请求格式（Story 3.4a 实现）：**
```
POST /api/rewrite
Headers: Content-Type: application/json
Body: { text: string, platforms: string[], tone: string }
Response: SSE stream
```

**SSE error 事件格式（Story 3.4a 定义）：**
```
event: error
data: { message: string, retryable: boolean }
```
- `retryable: true` → LLM 调用失败，可重试
- `retryable: false` → 内容不支持改写（`[UNSUPPORTED_CONTENT]`），message 为用户友好文案

**UI 组件限制：**
- `shadcn/ui` 未安装，所有 UI 必须用纯 Tailwind CSS 4.x 实现
- 可用颜色 token：`accent`、`accent-hover`、`accent-light`、`surface-2`、`border-default`、`border-focus`、`text-secondary`、`text-caption`

### AbortController 设计（use-rewrite-stream.ts）

```typescript
import { useEffect, useRef } from 'react'
import type { Platform } from './platform-selector'
import { useRewriteStore } from './rewrite-store'

const VALID_PLATFORMS: Platform[] = ['xiaohongshu', 'wechat', 'zhihu']

export function useRewriteStream() {
  // store selectors ...
  const abortControllerRef = useRef<AbortController | null>(null)

  // 组件卸载时 abort 当前流
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  async function startStream() {
    if (useRewriteStore.getState().status === 'rewriting') return

    // abort 旧流（重试场景），再建新流
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    startRewrite()  // 清空 streamingTexts / streamError，status → rewriting

    try {
      const { text, platforms, tone } = useRewriteStore.getState()
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platforms, tone }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('No response body')

      // ... 读循环（继承 4a.4 模式）
      // done 事件：completeRewrite(); break
      // error 事件（retryable: true）：setStreamError('改写遇到问题，请重试'); break
      // error 事件（retryable: false）：setStreamError(data.message); break

    } catch (err) {
      // AbortError：用户主动中止，静默退出
      if (err instanceof DOMException && err.name === 'AbortError') return
      // 网络 / HTTP 错误：统一用户友好文案
      setStreamError('网络连接失败，请重新改写')
    }
  }

  return { startStream }
}
```

### rewrite-workspace.tsx 错误横幅变更

```typescript
// 在 streamError 渲染区域
const hasPartialResults = streamError !== null && Object.keys(streamingTexts).length > 0

{streamError && (
  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
    <p className="flex-1 text-sm text-red-700">{streamError}</p>
    <button
      type="button"
      onClick={startStream}
      className="shrink-0 text-sm font-medium text-red-700 underline hover:no-underline"
    >
      {hasPartialResults ? '重试' : '重新改写'}
    </button>
  </div>
)}
```

**注意：** `hasPartialResults` 不影响 `hasResults`（下方结果区域展示逻辑不变）。错误发生时若有已完成平台，结果区域继续显示，这是 AC2 要求的行为。

### 继承自 deferred-work.md 的修复项

| 来源 | 问题 | 本 Story 处理方式 |
|---|---|---|
| 5-2 deferred | `done` SSE event 未 break 读循环 | 收到 `done` 后立即 `break` |
| 5-2 deferred | fetch 未携带 request body | 本 Story 切换真实 API，补充 body |
| 5-2 deferred | SSE stream 未 abort on 重新触发 | AbortController abort 旧流 |
| 5-2 deferred | 组件卸载后旧流继续运行 | useEffect cleanup abort |

**不在本 Story 范围的 deferred：**
- `VALID_PLATFORMS` 两文件重复定义（deferred 提取到 constants.ts）— 可在本 Story 顺手提取或保留

### use-rewrite-stream.test.ts 测试模式

```typescript
// @jest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { useRewriteStream } from '../use-rewrite-stream'
import { useRewriteStore } from '../rewrite-store'

function mockSSEResponse(events: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events))
      controller.close()
    },
  })
  return { ok: true, body: stream } as Response
}

// 测试示例：
// - global.fetch = jest.fn().mockResolvedValue(mockSSEResponse('event: error\ndata: {"message":"test","retryable":true}\n\n'))
// - act(() => { result.current.startStream() }); await waitFor(...)
// - expect(useRewriteStore.getState().streamError).toBe('改写遇到问题，请重试')
```

### 已存在文件（禁止重新创建）

| 文件 | 用途 |
|---|---|
| `src/features/rewrite/rewrite-store.ts` | Zustand store，无需修改 |
| `src/features/rewrite/rewrite-workspace.tsx` | 工作区容器，仅修改错误横幅按钮文案 |
| `src/features/rewrite/use-rewrite-stream.ts` | SSE hook，修改端点、错误处理、AbortController |
| `src/app/api/rewrite/route.ts` | 真实 SSE 改写 API（Story 3.4a 已实现），不修改 |
| `src/app/api/mock-rewrite/route.ts` | Mock 端点，本 Story 不再使用但保留（供其他测试） |

### References

- [Source: epics.md#Story 4a.5] — AC 原文
- [Source: epics.md#Story 3.4a AC] — SSE error 事件格式（message + retryable）
- [Source: _bmad-output/implementation-artifacts/4a-4-rewrite-workspace-state.md] — SSE 读循环模式、Zustand store 接口
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Deferred from 4a-4 / 5-2] — done-event break、fetch body、AbortController
- [Source: architecture.md#API & Communication Patterns] — SSE 协议定义
- [Source: src/features/rewrite/rewrite-store.ts] — 已有 setStreamError 接口（接受 string，保留 streamingTexts）

### Review Findings

- [x] [Review][Patch] HTTP 非 2xx 未取消 response body，可能泄露连接资源 [use-rewrite-stream.ts:45-48] — 已修复：在 `setStreamError` 之前调用 `response.body?.cancel()`
- [x] [Review][Patch] abort 时未调用 reader.cancel()，留下 ReadableStream 锁 [use-rewrite-stream.ts:catch块] — 已修复：reader 提升到 try 外，AbortError 早退出前调用 `reader?.cancel()`
- [x] [Review][Patch] 缺少 platform_start + chunk + done 完整链路测试 [use-rewrite-stream.test.ts] — 已修复：新增"核心流式路径"测试套件
- [x] [Review][Patch] 请求体测试文本仅约 30 字符，低于 50 字最低限（测试合约错误）[use-rewrite-stream.test.ts:273] — 已修复：文本扩展到 50+ 个 Unicode 字符
- [x] [Review][Patch] mockFetch 直接赋值 global.fetch 不被 jest.restoreAllMocks 还原，存在测试隔离风险 [use-rewrite-stream.test.ts:49-51] — 已修复：改用 jest.spyOn + 顶部初始化 global.fetch
- [x] [Review][Defer] VALID_PLATFORMS 在两个文件中重复定义，无统一来源 [use-rewrite-stream.ts:5, rewrite-workspace.tsx:12] — deferred, pre-existing（story 已注明可选提取）
- [x] [Review][Defer] buffer 无上限，恶意/故障服务器可致内存耗尽 [use-rewrite-stream.ts:读循环] — deferred, pre-existing（安全加固，本 story 范围外）
- [x] [Review][Defer] retryable:false 时直接透传 SSE data.message 到 UI，建议增加长度截断 [use-rewrite-stream.ts:109-114] — deferred, pre-existing（由规范定义，服务端负责提供用户友好文案）
- [x] [Review][Defer] 无流式请求超时机制，服务端挂起可致 UI 永久卡在改写中 [use-rewrite-stream.ts:startStream] — deferred, pre-existing（超时机制超出本 story 范围）
- [x] [Review][Defer] 平台 tab 基于用户选择渲染而非实际数据可用性，无数据 tab 显示空白 [rewrite-workspace.tsx:103-119] — deferred, pre-existing（UX 优化，不影响当前 AC）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
