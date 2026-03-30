# Story 5.2：历史记录复用

Status: done

## Story

作为内容创作者，
我想从历史记录中重新加载原文并发起新的改写，
以便复用之前的内容选择不同平台或语气重新生成。

## Acceptance Criteria

1. **Given** 用户在历史记录列表点击某条记录，**When** 点击"重新改写"按钮，**Then** 跳转到 `/app`，输入框自动填入该记录的原文内容
2. **Given** 跳转到 `/app` 后，**When** 页面加载，**Then** 上次使用的平台和语气风格作为默认预选值（用户可修改）
3. **Given** 用户在 `/app` 点击"开始改写"，**When** 发起改写，**Then** 生成新的 `rewrite_record`，不覆盖历史记录

## Tasks / Subtasks

- [x] 任务 1：在历史详情弹窗中添加"重新改写"按钮 (AC: #1, #2)
  - [x] 修改 `src/features/history/history-detail-modal.tsx`，在底部添加"重新改写"按钮
  - [x] 按钮点击后，用 `router.push('/app?text=...&platforms=...&tone=...')` 跳转（URL query 传参）
  - [x] 原文内容通过 URL query param `text` 传递（URL encode），平台通过 `platforms` 传递（逗号分隔），语气通过 `tone` 传递

- [x] 任务 2：在 `/app` 页面读取 URL query 并预填 (AC: #1, #2)
  - [x] 修改 `src/app/app/page.tsx`：读取 `searchParams.text`、`searchParams.platforms`、`searchParams.tone`
  - [x] 将这些值作为 props 传入工作区组件（或通过 URL state 初始化）
  - [x] **注意**：`useSearchParams()` + `useEffect` 方案（Client Component），用 Suspense boundary 包裹
  - [x] text 过长时截断到 5000 字再传入（防止 URL 过长的原文导致问题）

- [x] 任务 3：在历史记录列表页 / 卡片上也添加复用入口 (AC: #1, #2)
  - [x] 修改 `src/features/history/history-record-card.tsx`，卡片右上角添加悬停显示的"重新改写"快捷按钮
  - [x] 点击快捷按钮时：调用 `/api/rewrite/history/[id]` 获取完整原文（卡片上只有预览），然后跳转
  - [x] 防止事件冒泡到卡片的 onClick（打开弹窗）

- [x] 任务 4：更新测试 (AC: 全部)
  - [x] 更新 `src/features/history/__tests__/history-list.test.tsx`，添加复用按钮渲染和点击测试（11 个测试全部通过）
  - [x] mock `next/navigation` 的 `useRouter`，验证 `mockPush` 被正确调用

## Dev Notes

### 关键约束

- **不得修改** `src/app/api/rewrite/route.ts` 或其他 Session A/B 的文件
- `/app` 页面由其他 session（Session B/4a）实现，当前只是 stub（`src/app/app/page.tsx`）
- AC #3 已被架构保证：新发起改写永远创建新 `rewrite_record`，无需特殊处理

### URL 参数传递方案

```typescript
// 跳转到改写页，携带预填参数
import { useRouter } from 'next/navigation'

const router = useRouter()
const params = new URLSearchParams()
params.set('text', originalText)
if (platforms.length > 0) params.set('platforms', platforms.join(','))
if (tone) params.set('tone', tone)
router.push(`/app?${params.toString()}`)
```

### `/app` 页面读取 searchParams（Next.js 16.2.1）

```typescript
// src/app/app/page.tsx - searchParams 是 Promise
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string; platforms?: string; tone?: string }>
}) {
  const { text, platforms, tone } = await searchParams
  const initialText = text ? decodeURIComponent(text).slice(0, 5000) : ''
  const initialPlatforms = platforms ? platforms.split(',') : []
  const initialTone = tone ?? 'standard'
  // ...
}
```

### 现有 `/app` 页面情况

当前 `src/app/app/page.tsx` 是 4a-1 的 stub 实现（'use client'，有 TextInput），正在由 Session B 的 Epic 4a 开发。本 story 只需：
1. 确保页面能接收 searchParams 并传给内部组件
2. 如果 Session B 已经有完整实现，直接在其基础上添加 searchParams 读取
3. 如果还是 stub，添加 searchParams prop 并将初始值传给 TextInput

### 防止事件冒泡

```typescript
// 卡片上的"重新改写"按钮需要阻止冒泡（防止触发父级 onClick 打开弹窗）
<button
  onClick={(e) => {
    e.stopPropagation()
    handleReuse(record.id)
  }}
>
  重新改写
</button>
```

### References

- Story 5.1 实现：[Source: src/features/history/]
- 历史详情 API：[Source: src/app/api/rewrite/history/[id]/route.ts]
- `/app` 页面：[Source: src/app/app/page.tsx]
- Next.js 16 searchParams：[Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md]
- Epic AC 原文：[Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]

### Review Findings

- [x] [Review][Patch] Suspense 无 fallback prop，useSearchParams() 挂起时首屏空白 [已修复，加 fallback={null}]
- [x] [Review][Patch] useEffect 依赖 searchParams 引用——用户编辑文本后若 searchParams 引用变化（Next.js 有此行为），预填逻辑重新执行覆盖用户输入 [已修复，prefillDoneRef guard]

- [x] [Review][Defer] `/api/mock-rewrite` 硬编码，request body 未传参数 — deferred，Epic 4a Story 3.4a 替换为真实 SSE API
- [x] [Review][Defer] SSE stream 未 abort on unmount/重跑 — deferred，Epic 4a 范围
- [x] [Review][Defer] `done` SSE event 未 break 读循环 — deferred，Epic 4a 范围
- [x] [Review][Defer] `activeTab`/`isDone` 在重跑间未正确重置 — deferred，Epic 4a 范围
- [x] [Review][Defer] 错误后 streamingTexts 残留旧内容 — deferred，Epic 4a 范围
- [x] [Review][Defer] TextDecoder 未调用最终 flush — deferred，Epic 4a 范围
- [x] [Review][Defer] 卡片 originalText 截断上限 1500 ≠ spec 规定 5000 — deferred，URL 长度安全限制有意为之，长文场景建议后续改用 localStorage/服务端状态传参
- [x] [Review][Defer] platforms 全部无效时无用户提示，表单静默禁用 — deferred，MINOR，可接受行为

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- `src/app/app/page.tsx` 由 Session B Epic 4a 已有 'use client' stub，本 story 改为 `useSearchParams()` + `useEffect` 读取 URL params（Client Component 方案），用 `Suspense` 包裹 `AppPageContent`
- 卡片快捷按钮位于右上角（非右下角），hover 显示，CSS class `hidden group-hover:flex`
- 15 个 API 测试 + 11 个组件测试全部通过

### File List

- src/features/history/history-detail-modal.tsx（修改：添加 handleReuse，"重新改写"按钮，关闭弹窗）
- src/features/history/history-record-card.tsx（修改：添加 handleReuse，hover 快捷按钮）
- src/app/app/page.tsx（修改：useSearchParams + useEffect 预填，Suspense 包裹）
- src/features/history/__tests__/history-list.test.tsx（修改：mock next/navigation，添加 2 个复用测试）
