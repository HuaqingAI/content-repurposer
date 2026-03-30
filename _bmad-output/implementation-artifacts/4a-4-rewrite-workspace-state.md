# Story 4a.4: 改写工作区状态管理与整合

Status: done

## Story

作为内容创作者，
我想在一个完整的工作区页面中完成从输入到看到流式结果的全流程，
以便整个改写体验流畅无缝。

## Acceptance Criteria

1. **Given** 用户已输入原文、选择平台和语气，点击"开始改写"，**When** 改写进行中，**Then** "开始改写"按钮变为"改写中..."并禁用，防止重复提交

2. **Given** 用户点击"开始改写"，**When** 改写状态流转，**Then** 状态机正确流转：`idle → rewriting → complete`，按平台顺序依次激活 tab 展示结果

3. **Given** 改写完成，**When** 用户查看页面，**Then** 按钮恢复并显示"重新改写"

4. **Given** 页面所有状态（输入内容、平台选择、语气、改写结果、当前状态），**When** 任意交互，**Then** 由 Zustand store 统一管理，组件不使用多余的本地 state

5. **Given** 用户在改写完成后修改平台选择或语气，**When** 重新查看按钮文案，**Then** 按钮重置为"开始改写"（修复 deferred：平台/语气变更后 isDone 未重置问题）

6. **Given** 用户在浏览器中刷新 `/app` 页面，**When** 页面加载完成，**Then** 恢复 idle 状态，不保留上次的改写结果

## Tasks / Subtasks

- [x] **创建 Zustand store** (AC: #4, #5, #6)
  - [x] 新建 `src/features/rewrite/rewrite-store.ts`
  - [x] 定义 `RewriteStatus` 类型：`'idle' | 'rewriting' | 'complete'`
  - [x] 状态字段：`text`、`platforms`、`tone`、`status`、`streamingTexts`、`activeTab`、`streamingPlatform`、`streamError`
  - [x] Actions：`setText`、`setPlatforms`（完成时自动重置 status）、`setTone`（完成时自动重置 status）、`setActiveTab`、`onPlatformStart`、`appendChunk`、`setStreamError`、`completeRewrite`、`startRewrite`
  - [x] 不使用 `persist` 中间件（刷新即恢复 idle）

- [x] **创建 SSE hook** (AC: #1, #2, #3)
  - [x] 新建 `src/features/rewrite/use-rewrite-stream.ts`
  - [x] 使用 `useRewriteStore.getState()` 读取 `streamingPlatform` 避免闭包陈旧值
  - [x] 解析 SSE 事件：`platform_start` / `chunk` / `done` / `error`
  - [x] 调用对应 store actions 更新状态

- [x] **创建工作区容器组件** (AC: #1, #2, #3, #4)
  - [x] 新建 `src/features/rewrite/rewrite-workspace.tsx`（`'use client'`）
  - [x] 从 Zustand store 读取所有状态，不使用本地 useState（除 prefillDoneRef 外）
  - [x] 保留 URL searchParams 预填功能（`?text=&platforms=&tone=`）
  - [x] 组合 TextInput、PlatformSelector、ToneSelector、StreamingText 渲染

- [x] **更新 page.tsx** (AC: #4)
  - [x] 简化 `src/app/app/page.tsx`，删除所有本地状态
  - [x] 渲染 `<RewriteWorkspace />` 组件，保留 `<Suspense>` 包裹

- [x] **编写测试**
  - [x] 新建 `src/features/rewrite/__tests__/rewrite-store.test.ts`
  - [x] 测试 store 初始状态、状态流转、deferred bug 修复
  - [x] 新建 `src/features/rewrite/__tests__/rewrite-workspace.test.tsx`
  - [x] 测试按钮文案随 status 变化、disabled 状态、错误信息渲染

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全部为代码重构与整合，对接已有 mock 端点 | 自动 |

### 关键架构约束（必须遵守）

**目录规范：**
- 新文件在 `src/features/rewrite/`
- 文件名：`kebab-case`，组件名：`PascalCase`
- 测试文件：`src/features/rewrite/__tests__/*.test.{ts,tsx}`

**Zustand 使用规范：**
- Zustand 5.x 已安装（`package.json` 确认）
- **不使用** `persist` 中间件——刷新页面即恢复 idle 是 AC 要求
- 在 Next.js App Router Client Component 中，模块级 Zustand store 是合法的（无 SSR 泄漏风险）
- 在异步 SSE 回调中使用 `useRewriteStore.getState()` 读取最新状态，避免 React 闭包陈旧值

**UI 组件限制（重要）：**
- `shadcn/ui` 未安装，所有 UI **必须用纯 Tailwind CSS 4.x 实现**
- 可用颜色 token：`accent`、`accent-hover`、`accent-light`、`surface-2`、`border-default`、`border-focus`、`text-secondary`、`text-caption`

**SSE 消费协议（继承自 Story 4a.3）：**
- 使用原生 `fetch('/api/mock-rewrite', { method: 'POST' })` + `ReadableStream`
- 禁止使用 `EventSource`
- 按 `\n\n` 分割事件块，解析 `event:` 和 `data:` 行

**`'use client'` 规则：**
- `rewrite-workspace.tsx` 必须有 `'use client'` 指令
- `rewrite-store.ts` 无需 `'use client'`（纯 TS 模块）
- `use-rewrite-stream.ts` 无需 `'use client'`（hook，被 Client Component 调用）

**Next.js 16 Suspense 规则：**
- `useSearchParams()` 调用的组件必须在 `<Suspense>` 内渲染
- `page.tsx` 保留 `<Suspense fallback={null}>` 包裹不变

### Store 设计

```typescript
// src/features/rewrite/rewrite-store.ts
import { create } from 'zustand'
import type { Platform } from './platform-selector'
import type { Tone } from './tone-selector'

export type RewriteStatus = 'idle' | 'rewriting' | 'complete'

// State
// text: string
// platforms: Platform[]
// tone: Tone
// status: RewriteStatus
// streamingTexts: Partial<Record<Platform, string>>
// activeTab: Platform | null         ← 用户当前查看的 tab
// streamingPlatform: Platform | null ← 正在流式输出的平台
// streamError: string | null

// Key behaviors:
// - setPlatforms / setTone: 若 status === 'complete' 则重置为 'idle'（修复 deferred bug）
// - startRewrite(): status = 'rewriting', 清空 streamingTexts/activeTab/streamingPlatform/streamError
// - onPlatformStart(platform): activeTab = platform, streamingPlatform = platform
// - appendChunk(platform, chunk): streamingTexts[platform] += chunk
// - completeRewrite(): status = 'complete', streamingPlatform = null
// - setStreamError(error): streamError = error, status = 'idle', streamingPlatform = null
```

### use-rewrite-stream 设计

```typescript
// src/features/rewrite/use-rewrite-stream.ts
// 关键：在 async 回调中使用 useRewriteStore.getState().streamingPlatform
// 避免 React 闭包陈旧值问题

export function useRewriteStream() {
  // ... store actions
  async function startStream() {
    startRewrite()
    try {
      // SSE fetch ...
      // chunk 事件处理：
      const currentPlatform = useRewriteStore.getState().streamingPlatform
      if (currentPlatform) appendChunk(currentPlatform, data.text as string)
    } catch (err) {
      setStreamError(...)
    }
  }
  return { startStream }
}
```

### 已存在文件（禁止重新创建）

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/features/rewrite/text-input.tsx` | 原文输入组件 | Story 4a.1 产出，不修改 |
| `src/features/rewrite/platform-selector.tsx` | 平台选择器 | Story 4a.2 产出，不修改 |
| `src/features/rewrite/tone-selector.tsx` | 语气选择器 | Story 4a.2 产出，不修改 |
| `src/features/rewrite/streaming-text.tsx` | 流式渲染组件 | Story 4a.3 产出，不修改 |
| `src/app/api/mock-rewrite/route.ts` | Mock SSE 端点 | 已就绪，直接调用 |
| `src/lib/llm/` | LLM Service Layer | **绝对禁止修改** |
| `src/app/api/rewrite/route.ts` | 真实改写 API | **绝对禁止修改** |

### 本 Story 独占范围

- `src/features/rewrite/rewrite-store.ts` — 新建
- `src/features/rewrite/use-rewrite-stream.ts` — 新建
- `src/features/rewrite/rewrite-workspace.tsx` — 新建
- `src/features/rewrite/__tests__/rewrite-store.test.ts` — 新建
- `src/features/rewrite/__tests__/rewrite-workspace.test.tsx` — 新建
- `src/app/app/page.tsx` — 修改（简化为仅渲染 RewriteWorkspace）

### References

- [Source: epics.md#Story 4a.4] — AC 原文
- [Source: 4a-3-streaming-text-renderer.md] — SSE 消费模式、Suspense 规则
- [Source: deferred-work.md] — 需修复的 activeTab/isDone 重置 bug
- [Source: src/app/app/page.tsx] — 现有实现，将被重构

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

(待填写)

### Completion Notes List

- ✅ AC#1：点击"开始改写"后 `status` 从 `idle` 变为 `rewriting`，按钮显示"改写中..."并 `disabled`，防止重复提交
- ✅ AC#2：改写状态机正确流转 `idle → rewriting → complete`，`onPlatformStart` 自动切换 activeTab 和 streamingPlatform
- ✅ AC#3：`completeRewrite()` 将 status 设为 `complete`，按钮显示"重新改写"
- ✅ AC#4：所有状态（text/platforms/tone/status/streamingTexts/activeTab/streamError）统一由 Zustand store 管理，RewriteWorkspace 不使用任何本地 useState
- ✅ AC#5（deferred bug 修复）：`setPlatforms` / `setTone` 在 `status === 'complete'` 时自动重置为 `idle`，按钮恢复"开始改写"
- ✅ AC#6：无 persist 中间件，刷新后恢复 idle 状态
- ✅ 全量 212 个测试：208 通过，4 预存失败（proxy.test.ts HTTP 302 vs 307）
- ✅ 新增 28 个测试全部通过（17 store + 11 workspace）

### File List

- `src/features/rewrite/rewrite-store.ts` — 新建（Zustand store，状态机 + deferred bug 修复）
- `src/features/rewrite/use-rewrite-stream.ts` — 新建（SSE hook，getState() 避免闭包陈旧值）
- `src/features/rewrite/rewrite-workspace.tsx` — 新建（工作区容器组件）
- `src/features/rewrite/__tests__/rewrite-store.test.ts` — 新建（17 个 store 单元测试）
- `src/features/rewrite/__tests__/rewrite-workspace.test.tsx` — 新建（11 个组件测试）
- `src/app/app/page.tsx` — 修改（简化为 Suspense + RewriteWorkspace）

### Review Findings

- [x] [Review][Decision] onPlatformStart 无条件覆盖用户手动选择的 activeTab — 决策：保持 A（自动跟随流式平台），设计意图确认，无需修改
- [x] [Review][Patch] startStream 无并发保护，重试按钮可在旧流进行中触发新流 [use-rewrite-stream.ts:13] — 已修复：入口添加 status === 'rewriting' 早退守卫
- [x] [Review][Patch] platform_start 事件未校验是否属于用户所选平台，mock API 返回全量平台时 activeTab 被切换到未选平台 [use-rewrite-stream.ts:53-57] — 已修复：增加 selectedPlatforms.includes() 交叉验证
- [x] [Review][Defer] chunk 早于 platform_start 到达时内容静默丢弃 [use-rewrite-stream.ts:60-63] — deferred, SSE TCP 顺序保证，服务端协议 bug 场景，与 mock API 无关
- [x] [Review][Defer] prefillDoneRef 与 searchParams 依赖冲突，URL 更新后不再触发预填 [rewrite-workspace.tsx:42-59] — deferred, 一次性预填语义有意为之，防止用户交互后被 URL 覆盖
- [x] [Review][Defer] VALID_PLATFORMS 在 use-rewrite-stream.ts 和 rewrite-workspace.tsx 中重复定义 — deferred, 代码质量项，无功能 bug
- [x] [Review][Defer] streamError banner 与 hasResults 区域存在极短暂同时显示可能 [rewrite-workspace.tsx:85-125] — deferred, React 批处理后消失，极低概率 UI 闪烁
- [x] [Review][Defer] fetch('/api/mock-rewrite') 未携带 text/platforms/tone 请求体 [use-rewrite-stream.ts:17] — deferred, mock API 设计如此，真实 API 对接（Story 3.4a 接入）时补充 request body 构建

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-27 | Story 4a.4 创建：改写工作区状态管理与整合 | create-story |
