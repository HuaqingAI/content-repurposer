# Story 4a.3: 流式文本渲染组件

Status: done
<!-- Round 3 review completed 2026-03-30: all patch findings fixed -->

## Story

作为内容创作者，
我想在点击开始改写后看到文字逐字出现，
以便感受到系统正在实时处理，消除等待焦虑。

## Acceptance Criteria

1. **Given** 用户点击"开始改写"，前端建立 SSE 连接，**When** 收到 `platform_start` 事件，**Then** 对应平台的 tab 激活，显示加载状态

2. **Given** SSE 连接已建立，**When** 收到 `chunk` 事件，**Then** 文字逐字追加到对应平台的文本区域，视觉上呈现打字机效果

3. **Given** 改写进行中，**When** 收到 `error` 事件，**Then** 显示错误信息和"重试"按钮，不崩溃

4. **Given** 用户触发改写，**When** 前端发起请求，**Then** SSE 连接通过原生 `fetch` + `ReadableStream` 实现（非 EventSource），支持 POST 请求

## Tasks / Subtasks

- [x] **创建 StreamingText 渲染组件** (AC: #2)
  - [x] 新建 `src/features/rewrite/streaming-text.tsx`（`'use client'`）
  - [x] Props 接口：`{ text: string; isStreaming?: boolean; className?: string }`
  - [x] 实现打字机光标：streaming 时末尾追加闪烁光标（CSS animation）
  - [x] 文本为空且 isStreaming=true 时显示"生成中..."占位

- [x] **在 page.tsx 集成 SSE 消费逻辑（对接 mock 端点）** (AC: #1, #2, #3, #4)
  - [x] 在 `src/app/app/page.tsx` 中添加 SSE 状态：`streamingTexts: Record<Platform, string>`、`activeTab: Platform | null`、`isStreaming: boolean`、`streamError: string | null`
  - [x] 实现 `startRewrite()` 函数，使用 `fetch('/api/mock-rewrite', { method: 'POST' })` + `ReadableStream` 解析 SSE
  - [x] SSE 解析逻辑：按 `\n\n` 分割事件块，解析 `event:` 和 `data:` 行
  - [x] 处理 `platform_start`：设置 `activeTab = event.data.platform`
  - [x] 处理 `chunk`：追加 `streamingTexts[activeTab] += event.data.text`
  - [x] 处理 `done`：设置 `isStreaming = false`
  - [x] 处理 `error`：设置 `streamError = event.data.message`，`isStreaming = false`
  - [x] 按钮状态：streaming 时显示"改写中..."并禁用，完成后恢复"重新改写"

- [x] **渲染平台 tab 与结果区域** (AC: #1, #2)
  - [x] 当 `streamingTexts` 有内容或 `isStreaming=true` 时，渲染平台 tab 列表（仅展示选中的平台）
  - [x] tab 激活状态：`activeTab` 对应的 platform 高亮
  - [x] 结果区域使用 `<StreamingText>` 组件展示当前 tab 的文字
  - [x] 未开始时不渲染结果区域（保持原有 idle 界面）

- [x] **错误与重试 UI** (AC: #3)
  - [x] `streamError` 不为 null 时，展示红色提示框 + "重试"按钮
  - [x] "重试"按钮点击重置状态后重新调用 `startRewrite()`

- [x] **编写 StreamingText 组件单元测试**
  - [x] 新建 `src/features/rewrite/__tests__/streaming-text.test.tsx`
  - [x] 测试：传入 text，渲染出对应文字内容
  - [x] 测试：isStreaming=true 时存在光标元素（aria-hidden）
  - [x] 测试：isStreaming=false 时无光标元素
  - [x] 测试：text 为空且 isStreaming=true 时显示占位文字

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全部为代码实现，对接 mock 端点，无需外部服务 | 自动 |

### 关键架构约束（必须遵守）

**目录规范：**
- 新文件在 `src/features/rewrite/`
- 文件名：`kebab-case`，组件名：`PascalCase`
- 测试文件：`src/features/rewrite/__tests__/*.test.tsx`

**UI 组件限制（重要）：**
- `shadcn/ui` 未安装，所有 UI **必须用纯 Tailwind CSS 4.x 实现**
- 自定义颜色 token 已在 `src/app/globals.css` 的 `@theme inline` 块中定义
- 可用颜色：`accent`（#3d6b4f）、`accent-hover`（#2f5640）、`accent-light`（#e8f2ec）、`surface-2`（#f9f8f5）、`border-default`（#e8e5de）、`border-focus`（#a0998a）

**SSE 消费协议（架构硬性要求）：**
- 必须使用原生 `fetch` + `ReadableStream`，**禁止使用 `EventSource`**（EventSource 不支持 POST）
- SSE 事件格式（来自 architecture.md）：
  ```
  event: platform_start
  data: {"platform":"xiaohongshu"}

  event: chunk
  data: {"text":"内容片段"}

  event: titles
  data: {"titles":["标题1","标题2","标题3"]}

  event: tags
  data: {"tags":["标签1","标签2"]}

  event: hook
  data: {"hook":"互动引导语"}

  event: platform_complete
  data: {"platform":"xiaohongshu","tokens_used":856,"cost_cents":6}

  event: done
  data: {"record_id":"uuid或mock值"}

  event: error
  data: {"message":"错误描述","retryable":true}
  ```
- 事件块以 `\n\n` 分隔，每行以 `\n` 分隔
- 解析逻辑：按 `\n\n` split → 每块按 `\n` split → 找 `event:` 行和 `data:` 行 → `JSON.parse(data)`

**`'use client'` 规则：**
- `streaming-text.tsx` 必须有 `'use client'` 指令（第一行，import 之前）
- `page.tsx` 已有 `'use client'`，不需要重复添加

**Next.js 版本：16.2.1（非 15）**
- 项目实际运行的是 Next.js 16.2.1（`package.json` 确认），architecture.md 中"Next.js 15"描述有误，以实际版本为准
- Suspense boundary 模式（`useSearchParams` 需要）已在 `page.tsx` 中实现，**不要移除**

### StreamingText 组件设计

```typescript
// src/features/rewrite/streaming-text.tsx
'use client'

interface StreamingTextProps {
  text: string
  isStreaming?: boolean
  className?: string
}

export function StreamingText({ text, isStreaming = false, className }: StreamingTextProps) {
  // text 为空 + isStreaming=true → 显示"生成中..."
  // text 有内容 → 显示文字，streaming 时末尾追加光标
  // 光标：<span aria-hidden="true" className="...animate-pulse...">|</span>
}
```

### SSE 消费实现参考

```typescript
// page.tsx 中 startRewrite 函数骨架
async function startRewrite() {
  setIsStreaming(true)
  setStreamError(null)
  setStreamingTexts({} as Record<Platform, string>)
  setActiveTab(null)

  try {
    const response = await fetch('/api/mock-rewrite', { method: 'POST' })
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? '' // 最后一块可能不完整，留在 buffer

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue
        let eventType = ''
        let dataStr = ''
        for (const line of eventBlock.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
        }
        if (!eventType || !dataStr) continue
        const data = JSON.parse(dataStr)

        if (eventType === 'platform_start') {
          setActiveTab(data.platform as Platform)
        } else if (eventType === 'chunk') {
          setStreamingTexts(prev => ({
            ...prev,
            [activeTabRef.current!]: (prev[activeTabRef.current!] ?? '') + data.text,
          }))
        } else if (eventType === 'done') {
          setIsStreaming(false)
        } else if (eventType === 'error') {
          setStreamError(data.message)
          setIsStreaming(false)
        }
      }
    }
  } catch (err) {
    setStreamError(err instanceof Error ? err.message : '网络错误，请重试')
    setIsStreaming(false)
  }
}
```

> **注意：** `chunk` 事件处理中需要读取 `activeTab` 的最新值，`useState` 的 setter 中应通过 `useRef` 同步追踪 `activeTab`（避免闭包陈旧值），或改用 `useReducer`。建议用 `activeTabRef` pattern：
> ```typescript
> const activeTabRef = useRef<Platform | null>(null)
> // setActiveTab 时同步 ref
> const setActivePlatform = (p: Platform) => {
>   activeTabRef.current = p
>   setActiveTab(p)
> }
> ```

### 平台 Tab 渲染设计

```tsx
// 结果区域（仅 isStreaming 或有内容时显示）
{(isStreaming || Object.keys(streamingTexts).length > 0) && (
  <div className="flex flex-col gap-3">
    {/* Tab 栏 */}
    <div className="flex gap-2">
      {platforms.map(platform => (
        <button
          key={platform}
          onClick={() => setActiveTab(platform)}
          className={activeTab === platform
            ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-white'
            : 'px-3 py-1.5 rounded-md text-sm text-text-secondary bg-surface-2 hover:bg-accent-light'}
        >
          {PLATFORM_LABELS[platform]}
        </button>
      ))}
    </div>
    {/* 结果区域 */}
    {activeTab && (
      <StreamingText
        text={streamingTexts[activeTab] ?? ''}
        isStreaming={isStreaming && activeTab === /* current streaming platform */}
      />
    )}
  </div>
)}
```

### 已存在文件（禁止重新创建）

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/app/globals.css` | 全局样式 + Tailwind token | 不修改 |
| `src/features/rewrite/text-input.tsx` | 原文输入组件 | Story 4a.1 产出，不修改 |
| `src/features/rewrite/platform-selector.tsx` | 平台选择器 | Story 4a.2 产出，不修改 |
| `src/features/rewrite/tone-selector.tsx` | 语气选择器 | Story 4a.2 产出，不修改 |
| `src/app/api/mock-rewrite/route.ts` | Mock SSE 端点 | 已创建，直接调用 |
| `src/lib/llm/` | LLM Service Layer | **绝对禁止修改** |
| `src/app/api/rewrite/route.ts` | 真实改写 API | **绝对禁止修改** |

### 本 Story 独占范围

- `src/features/rewrite/streaming-text.tsx` — 新建
- `src/features/rewrite/__tests__/streaming-text.test.tsx` — 新建
- `src/app/app/page.tsx` — 修改（添加 SSE 状态 + startRewrite 函数 + 结果展示）

**不创建的文件（留给后续 Story）：**
- `use-rewrite-stream.ts` → Story 4a.4 交付
- `rewrite-store.ts` → Story 4a.4 交付
- `rewrite-workspace.tsx` → Story 4a.4 交付

### 从 Story 4a.2 继承的模式

- 受控组件设计（props 控制状态，组件不持有业务状态）
- 测试框架：Jest + @testing-library/react
- 按钮样式模式：`px-4 py-2 rounded-lg border text-sm transition-colors duration-150`
- 选中/激活颜色：`bg-accent text-white`（tab）或 `bg-accent-light border-accent text-accent`（toggle）

### 性能与 UX 注意事项

- `streamingTexts` 每次 chunk 都更新 state，React 会频繁 re-render。`StreamingText` 组件应是轻量的，避免在其中做复杂计算。
- 打字机光标动画用 CSS `animate-pulse`（Tailwind 内置），不需要额外 JS timer。
- `isStreaming=true` 时"开始改写"按钮显示"改写中..."并 `disabled`，防重复提交。
- 改写完成后按钮文字改为"重新改写"，点击重置所有状态并重新开始。

### References

- [Source: epics.md#Story 4a.3] — AC 原文
- [Source: architecture.md#API & Communication Patterns] — SSE 事件格式定义
- [Source: architecture.md#Frontend Architecture] — `streaming-text.tsx` 文件位置、`fetch + ReadableStream` 要求
- [Source: 4a-2-platform-tone-selector.md] — 受控组件模式、Tailwind token、测试框架
- [Source: src/app/api/mock-rewrite/route.ts] — 已就绪的 Mock 端点

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- proxy.test.ts 中 4 个失败测试（HTTP 302 vs 307）为预存回归，与本 Story 无关（同 4a-1/4a-2 记录）

### Completion Notes List

- ✅ AC#1：收到 `platform_start` 事件时 `setActivePlatform()` 切换 tab，平台名高亮显示，isStreaming=true 显示"生成中..."占位
- ✅ AC#2：收到 `chunk` 事件时文字追加到对应平台 streamingTexts，`StreamingText` 组件末尾显示闪烁光标（`animate-pulse`），打字机效果
- ✅ AC#3：收到 `error` 事件时显示红色提示框 + "重试"按钮，不崩溃，已完成平台内容保留
- ✅ AC#4：SSE 消费通过原生 `fetch('/api/mock-rewrite', { method: 'POST' })` + `ReadableStream.getReader()`，非 EventSource
- ✅ StreamingText 组件：6 个单元测试全部通过
- ✅ 全量 173 个测试：169 通过，4 预存失败（proxy.test.ts）

### File List

- `src/features/rewrite/streaming-text.tsx` — 新建（StreamingText 组件，打字机光标）
- `src/features/rewrite/__tests__/streaming-text.test.tsx` — 新建（6 个单元测试）
- `src/app/app/page.tsx` — 修改（添加 SSE 消费 + 平台 tab + 错误重试 UI）
- `src/app/api/mock-rewrite/route.ts` — 新建（Mock SSE 端点，Session B 任务）

### Review Findings

<!-- Round 2 review — 2026-03-27 -->
<!-- Note: Story 4a.4 已将 page.tsx 的 SSE 逻辑重构至 rewrite-workspace.tsx + use-rewrite-stream.ts -->
<!-- 原 Round 1 中针对 page.tsx SSE 逻辑的 9 项 patch 已迁移至 Story 4a.4 范围，此处不再跟踪 -->

- [x] [Review][Patch] `splitIntoChunks` 用 `String.slice`（UTF-16 单元）切分 —— 内容含 🌟 emoji（双码元），chunkSize=8 时可劈裂为乱码，应改用 `[...text].slice(i, i+chunkSize).join('')` [`route.ts:95`]
- [x] [Review][Patch] `catch` 块 `controller.enqueue` 在流已被消费端取消后会抛 TypeError，产生 unhandled rejection —— 应在 `start()` 顶部声明 `let isClosed = false`，finally 中置 true，catch 中 enqueue 前检查 [`route.ts:110-116`]
- [x] [Review][Patch] 同源 API 路由不应有 `Access-Control-Allow-Origin: *` CORS 头 —— 移除该 header [`route.ts:127`]
- [x] [Review][Patch] `GET()` handler 代理到 `POST()`，允许跨域页面以无 preflight 的简单 GET 请求触发 SSE —— 删除 `GET()` export [`route.ts:132-134`]

- [x] [Review][Defer] Mock 端点无鉴权校验 [`route.ts`] — deferred, pre-existing; 鉴权在 middleware 层（Story 2.3 已实现）
- [x] [Review][Defer] `StreamingText` text 为纯空白时"生成中..."占位符不显示 [`streaming-text.tsx`] — deferred, pre-existing; 当前业务不产生纯空白输入

<!-- Dismissed (Round 2): -->
<!-- - <Suspense> 无 fallback → 已修复（现为 fallback={null}） -->
<!-- - 流式出错时结果区域隐藏 → 迁移至 Story 4a.4（rewrite-workspace.tsx） -->
<!-- - activeTabRef 共用 → 迁移至 Story 4a.4（use-rewrite-stream.ts） -->
<!-- - 流结束无 done 事件 → 迁移至 Story 4a.4 -->
<!-- - 重复点击 AbortController → 迁移至 Story 4a.4 -->
<!-- - response.ok 未检查 → 迁移至 Story 4a.4 -->
<!-- - data 无类型校验 → 迁移至 Story 4a.4 -->
<!-- - SSE 多 data: 行 → 迁移至 Story 4a.4 -->
<!-- - TextDecoder 未 flush → 迁移至 Story 4a.4 -->
<!-- - 剩余 buffer 未处理 → 迁移至 Story 4a.4 -->

<!-- Round 3 review — 2026-03-30 -->
- [x] [Review][Patch] `closed` flag 逻辑错误 — Round 2 补丁实现有误：`catch` 中 `if (!closed)` 检查时 `closed` 始终为 `false`（`finally` 中才设置），守卫永不生效；happy-path `controller.enqueue()` 同样无保护 [`route.ts:109-124`]
- [x] [Review][Patch] 测试全局 `document.querySelector('[aria-hidden="true"]')` — 未限定在组件容器内，JSDOM 中其他元素携带该属性时断言可能产生误判 [`streaming-text.test.tsx:13,20`]

- [x] [Review][Defer] Mock 端点无生产环境隔离守卫 [`route.ts`] — deferred, pre-existing; 鉴权在 middleware 层（Story 2.3），替换为真实 API 时天然覆盖
- [x] [Review][Defer] 无 abort signal — 客户端断开连接后 `generateStream()` 继续执行全部 sleep/enqueue [`route.ts`] — deferred, pre-existing; mock 端点可接受，真实 SSE（Story 3.4a）时须添加 AbortController

<!-- Dismissed (Round 3): -->
<!-- - encodeSSE event 名未校验 → 所有 event 名均为代码内字面量，无外部输入 -->
<!-- - splitIntoChunks chunkSize=0 死循环 → 调用处均为硬编码 8/10 -->
<!-- - className 尾随空格 → 不影响行为 -->
<!-- - mock-record- ID 碰撞 → mock dev 场景无语义影响 -->

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-27 | Story 4a.3 创建：流式文本渲染组件 | create-story |
| 2026-03-27 | Code review Round 1：1 decision_needed, 13 patch, 3 defer, 8 dismissed | code-review |
| 2026-03-27 | Code review Round 2：0 decision_needed, 4 patch, 2 defer, 10 dismissed（9项迁移至4a.4，1项已修复） | code-review |
| 2026-03-30 | Code review Round 3：0 decision_needed, 2 patch, 2 defer, 4 dismissed | code-review |
