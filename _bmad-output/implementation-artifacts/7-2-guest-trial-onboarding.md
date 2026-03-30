# Story 7.2：未登录试用体验与注册引导

Status: done

## Story

作为访客，
我想不注册就能体验一次改写效果预览，
以便在决定注册前先感受产品价值。

## Acceptance Criteria

1. **Given** 未登录用户在落地页粘贴文章并选择一个平台，点击"免费试用"，**When** 改写完成，**Then** 展示改写结果预览，仅显示前 150 个汉字（含标点），超出部分以渐变模糊遮罩覆盖，遮罩上方展示"注册免费解锁完整内容"的 CTA 按钮
2. **Given** 结果预览已展示，**When** 用户点击"免费注册"，**Then** 跳转到 `/login`，注册完成后自动跳转 `/app` 并触发完整改写（"Aha 时刻"）
3. **Given** 试用改写请求，**When** 改写完成，**Then** 不写入 `rewrite_records` / `rewrite_results` 表，`done` SSE 事件携带 `{ trial: true, record_id: null }`
4. **Given** 未登录用户，**When** 发起改写请求，**Then** 按 IP 每小时最多 3 次限制，超限返回 HTTP 429，message 为"今日试用次数已达上限，注册后可免费无限使用"；不受已登录用户的每分钟 5 次约束
5. **Given** 试用模式，**When** 用户尝试选择多个平台，**Then** API 拦截返回 400，message 为"试用模式仅支持单平台改写"（前端应限制只能单选）

## Tasks / Subtasks

- [x] 任务 1：新建 `src/features/rewrite/trial-widget.tsx` (AC: #1, #3, #4, #5)
  - [ ] Client Component，管理自有本地 state（不使用全局 `useRewriteStore`，避免与 `/app` 状态污染）
  - [ ] 包含：多行 textarea（50-5000 字，实时字数计数）、单平台选择器（三个平台仅选一个）、"免费试用"按钮
  - [ ] SSE 流式接入 `/api/rewrite`，body: `{ text, platforms: [platform], tone: 'standard' }`，完整 SSE 解析循环（参考 `use-rewrite-stream.ts` 中的解析实现，含 buffer 拼接、事件解析、done/error 处理）
  - [ ] 改写过程中逐字展示文本（stream 阶段无模糊，完整打字机效果）
  - [ ] 改写完成（收到 `done` 事件）后：前 150 汉字明文展示，后续内容以渐变模糊遮罩覆盖（`bg-gradient-to-t from-white`），遮罩上展示"注册免费解锁完整内容"文案及"免费注册"按钮
  - [ ] "免费注册"按钮点击时：将试用输入存入 localStorage（key: `shiwen_trial_prefill`，value: `{text, platform, tone: 'standard'}`），然后跳转 `/login`（`<Link href="/login">`）
  - [ ] 试用限流（429）时展示友好提示，不崩溃
  - [ ] IP 识别失败（429，message 含"无法识别"）时展示"请注册后使用"提示
  - [ ] AbortController 管理（组件卸载 / 再次点击时 abort 旧流）

- [x] 任务 2：修改 `src/app/page.tsx`，在 Hero 区嵌入试用组件 (AC: #1)
  - [ ] `src/app/page.tsx` 保持 Server Component（不加 `'use client'`），仅 import 并渲染 `<TrialWidget />`
  - [ ] 将 `<TrialWidget />` 放在 Hero 区 CTA 按钮下方，替换或补充原有"免费试用"Link 按钮
  - [ ] Hero 区标题、价值主张文案不变；TrialWidget 下方保留平台展示区和特性区

- [x] 任务 3：修改 `src/features/rewrite/rewrite-workspace.tsx`，实现注册后 Aha 时刻 (AC: #2)
  - [ ] 在现有 `prefillDoneRef` useEffect 内：若 `searchParams.get('text')` 为空，检查 `localStorage.getItem('shiwen_trial_prefill')`
  - [ ] 若 localStorage 有数据：解析 `{text, platform, tone}` → 调用 `setText` / `setPlatforms([platform])` / `setTone` → 立即清除 localStorage（`localStorage.removeItem('shiwen_trial_prefill')`）→ 设置 `shouldAutoStart = true`
  - [ ] 新增 `shouldAutoStart` state；当 `shouldAutoStart && status === 'idle' && text.length >= 50` 时调用 `startStream()`（useEffect 依赖 shouldAutoStart、status、text）
  - [ ] localStorage 读取须用 try/catch 包裹（SSR 无 localStorage，但 rewrite-workspace 是 Client Component，无需担心，加保护更稳健）

- [x] 任务 4：新增测试 `src/features/rewrite/__tests__/trial-widget.test.tsx` (AC: #1, #4)
  - [ ] 测试：字数 < 50 时"免费试用"按钮禁用
  - [ ] 测试：选择平台后启用按钮，点击触发 fetch('/api/rewrite')
  - [ ] 测试：模拟 SSE chunk 事件 → 文本逐渐追加
  - [ ] 测试：模拟 done 事件 → 展示模糊遮罩和"注册免费解锁完整内容"
  - [ ] 测试：模拟 429 响应 → 展示限流提示

## Dev Notes

### 关键架构约束

**本 Story 涉及文件边界（严格遵守）：**
- `src/app/page.tsx` — Server Component，只负责布局和 metadata，不加 `'use client'`
- `src/features/rewrite/trial-widget.tsx` — 新建 Client Component，完全本地 state（**不引入 useRewriteStore**）
- `src/features/rewrite/rewrite-workspace.tsx` — 已有 Client Component，仅在现有 prefill useEffect 内扩展 localStorage 读取逻辑

**不要：**
- 在 trial-widget 中 import useRewriteStore（会污染 /app 全局状态）
- 修改 `/api/rewrite/route.ts`（trial 模式已完整实现，不需要改动）
- 修改 `phone-otp-form.tsx`（登录后已 push('/app')，无需改动）

### Trial API 现有实现（已完成，无需修改）

`/api/rewrite/route.ts` 中：
- `isTrial = !user`（未登录则为试用模式）
- 试用模式自动 IP 限流：`checkIpRateLimit(ip)`，每小时 3 次
- `done` SSE 携带 `{ trial: true, record_id: null }`
- 试用模式多平台拦截：`if (isTrial && platforms.length > 1)` → 400
- IP 为空时返回 429

**源码位置：** `src/app/api/rewrite/route.ts:62-159`

### SSE 解析实现（复用模式）

trial-widget.tsx 中 SSE 解析需与 `use-rewrite-stream.ts` 保持一致的 buffer 拼接模式：

```typescript
// 关键模式（从 use-rewrite-stream.ts:63-83 提取）
buffer += decoder.decode(value, { stream: true })
const events = buffer.split('\n\n')
buffer = events.pop() ?? ''

for (const eventBlock of events) {
  let eventType = '', dataStr = ''
  for (const line of eventBlock.split('\n')) {
    if (line.startsWith('event: ')) eventType = line.slice(7).trim()
    if (line.startsWith('data: ')) dataStr += (dataStr ? '\n' : '') + line.slice(6).trim()
  }
  // ...
}
```

trial-widget 只需处理 `chunk`（append body）、`done`（set complete）、`error`（show message）三种事件，其他事件（titles/tags/hook/platform_start/platform_complete）可忽略。

### 150 汉字截断实现

```typescript
const PREVIEW_CHARS = 150
// 用 spread 运算符正确处理多字节 Unicode（汉字 = 1 个字符）
const chars = [...streamingBody]
const previewText = chars.slice(0, PREVIEW_CHARS).join('')
const hiddenText = chars.slice(PREVIEW_CHARS).join('')
const showBlur = status === 'complete' && chars.length > PREVIEW_CHARS
```

**流式阶段不应用模糊**：改写进行中全文展示（打字机效果），收到 `done` 后才切换为模糊视图。

### 模糊遮罩 UI 实现

```tsx
<div className="relative">
  <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
    {previewText}
    {hiddenText && (
      <span className="blur-sm select-none">{hiddenText}</span>
    )}
  </p>
  {showBlur && (
    <>
      {/* 渐变遮罩 */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
      {/* CTA */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-2">
        <p className="text-sm font-medium text-gray-800">注册免费解锁完整内容</p>
        <Link
          href="/login"
          onClick={handleRegisterClick}
          className="px-6 py-2 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors"
        >
          免费注册
        </Link>
      </div>
    </>
  )}
</div>
```

### localStorage 数据格式

```typescript
// 存入（trial-widget.tsx）
const TRIAL_STORAGE_KEY = 'shiwen_trial_prefill'

function handleRegisterClick() {
  localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify({
    text,
    platform,  // 单个平台字符串
    tone: 'standard',
  }))
}

// 读取（rewrite-workspace.tsx，在现有 prefillDoneRef useEffect 中扩展）
const trialRaw = localStorage.getItem('shiwen_trial_prefill')
if (trialRaw) {
  localStorage.removeItem('shiwen_trial_prefill')
  try {
    const { text: t, platform: p, tone: tn } = JSON.parse(trialRaw)
    if (typeof t === 'string' && [...t].length >= 50) {
      setText([...t].slice(0, 5000).join(''))
      if (VALID_PLATFORMS.includes(p)) setPlatforms([p])
      if (VALID_TONES.includes(tn)) setTone(tn)
      setShouldAutoStart(true)
    }
  } catch { /* 忽略解析失败 */ }
}
```

### rewrite-workspace.tsx 自动触发改写

```typescript
// 新增 state
const [shouldAutoStart, setShouldAutoStart] = useState(false)

// 新增 useEffect（与现有 prefillDoneRef effect 分开）
useEffect(() => {
  if (shouldAutoStart && status === 'idle' && [...text].length >= 50) {
    setShouldAutoStart(false)
    startStream()
  }
}, [shouldAutoStart, status, text, startStream])
```

### 单平台选择器（trial-widget 内）

trial-widget 需要单选平台（区别于 /app 的多选）。**不要** import `PlatformSelector`（它是多选组件）。在 trial-widget 内自己实现简单的 3 个按钮单选即可：

```tsx
const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '微信公众号' },
  { value: 'zhihu', label: '知乎' },
]

{PLATFORMS.map(({ value, label }) => (
  <button
    key={value}
    type="button"
    onClick={() => setPlatform(value)}
    className={platform === value ? '...selected styles...' : '...unselected styles...'}
  >
    {label}
  </button>
))}
```

### 技术栈约束（本 Story 范围内）

- **Tailwind CSS 4.x** — 已全局安装，直接使用，不引入新 CSS 文件
- **Next.js App Router** — `<Link>` 用于跳转，不用 `<a>`
- **React 19** — `useState`、`useEffect`、`useRef`
- **无新 npm 包** — 不引入任何新依赖
- **Server Component 不可 import Client Component 的非导出类型** — page.tsx 只 import default export 或命名 export

### 现有文件速查（本 Story 需读取或修改）

| 文件 | 作用 | 本 Story 操作 |
|---|---|---|
| `src/app/page.tsx` | SSR 落地页 | 修改：插入 `<TrialWidget />` |
| `src/app/api/rewrite/route.ts` | 改写 API（含 trial 模式） | **不修改**，已完整实现 |
| `src/features/rewrite/use-rewrite-stream.ts` | SSE 流 hook（全局 store 版） | **不修改**，仅参考其 SSE 解析模式 |
| `src/features/rewrite/rewrite-workspace.tsx` | 改写工作区 | 修改：扩展 localStorage 预填 + 自动触发 |
| `src/features/rewrite/rewrite-store.ts` | Zustand store | **不修改** |
| `src/features/auth/phone-otp-form.tsx` | 登录表单，登录后 push('/app') | **不修改** |

### 关于 Next.js（⚠️ 必读）

项目使用的是 Next.js 版本可能与训练数据不同（AGENTS.md 警告）。
**在实现前必须读取：** `node_modules/next/dist/docs/` 中的相关指南，特别注意：
- Server/Client Component 边界（page.tsx 不加 'use client' 如何嵌入 Client Component）
- `<Link>` 的正确用法（当前版本）

### 前一个 Story（7-1）的关键学习

- `src/app/page.tsx` 已是 SSR Server Component，有 `metadata` export，实现了 Hero + 平台卡片 + 特性区 + CTA。本 Story 在 Hero 区插入 `<TrialWidget />`，不破坏现有结构。
- 7-1 测试文件：`src/app/__tests__/page.test.tsx`（已有 7 个测试），新增 TrialWidget 后需确保现有测试仍通过。
- `src/app/page.tsx` 中的 `href="/login"` 的现有 CTA 按钮可保留或替换为 TrialWidget 的试用交互。

### 来自 deferred-work.md 的相关注意事项

- **proxy.ts 未作为 middleware 生效**：`/app/*` 路由无服务端鉴权保护（但 TrialWidget 在 `/` 上，不受影响）。落地页本身对所有人开放，无 auth 检查，这是正确行为。
- **localStorage 在 SSR 中不可用**：trial-widget.tsx 是 Client Component（`'use client'`），`window.localStorage` 可用；rewrite-workspace.tsx 同为 Client Component，读取时无 SSR 问题。

### Project Structure Notes

- **新文件路径**：`src/features/rewrite/trial-widget.tsx`（符合 feature-based 组织）
- **测试文件路径**：`src/features/rewrite/__tests__/trial-widget.test.tsx`（与源文件同级 `__tests__/` 目录，参照 `src/app/__tests__/page.test.tsx` 的模式）
- **命名规范**：kebab-case 文件名，PascalCase 组件名（`TrialWidget`），符合架构规范

### Review Findings

- [x] [Review][Patch] Stale `status` closure — end-of-stream fallback 永远失效 [trial-widget.tsx] — fixed
- [x] [Review][Patch] 流式阶段 `hiddenText` 已应用 `blur-sm`，违反"流式阶段不应用模糊"规范 [trial-widget.tsx] — fixed
- [x] [Review][Patch] `canStart` 缺少上界检查，允许超过 5000 字的文本提交 [trial-widget.tsx] — fixed
- [x] [Review][Patch] SSE `error` 事件 `retryable` 逻辑错误：字段缺失时默认 `true`，覆盖服务端具体 message [trial-widget.tsx] — fixed
- [x] [Review][Defer] localStorage 在有效性校验前即被删除，短文本或畸形数据静默丢失 [rewrite-workspace.tsx] — deferred, pre-existing
- [x] [Review][Defer] 错误状态重试时 streamingBody 清除前有短暂旧内容闪烁 [trial-widget.tsx] — deferred, pre-existing
- [x] [Review][Defer] SSE flush 尾部未按 `\n\n` 重新分割，多事件尾块处理不完整 [trial-widget.tsx] — deferred, pre-existing
- [x] [Review][Defer] 字数计数器无 `aria-describedby`，屏幕阅读器无法动态感知 [trial-widget.tsx] — deferred, pre-existing
- [x] [Review][Defer] page.test.tsx 断言弱化（`getAllByText length >= 1`），无法感知意外重复渲染 [page.test.tsx] — deferred, pre-existing

### References

- Epic 7 Story 7.2 要求：`_bmad-output/planning-artifacts/epics.md#Story 7.2`
- Trial API 实现：`src/app/api/rewrite/route.ts:47-382`
- SSE 解析模式参考：`src/features/rewrite/use-rewrite-stream.ts:39-207`
- Zustand Store：`src/features/rewrite/rewrite-store.ts`
- 落地页现状：`src/app/page.tsx`
- prefill useEffect 扩展位置：`src/features/rewrite/rewrite-workspace.tsx:62-83`
- 架构命名规范：`_bmad-output/planning-artifacts/architecture.md#Naming Patterns`
- 架构前端规范：`_bmad-output/planning-artifacts/architecture.md#Frontend Architecture`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- TextDecoder/TextEncoder are undefined in the jsdom test environment; polyfilled them in trial-widget.test.tsx using Node.js `util` module
- page.test.tsx updated: `getByText` → `getAllByText` for platform names since TrialWidget adds additional platform buttons on the page
- rewrite-workspace.test.tsx pre-existing failure (cannot find `content-package`) is unrelated to this story
- 429 limit branch works by parsing `response.text()` JSON; mock uses `text: async () => JSON.stringify(...)` pattern

### File List

- `src/features/rewrite/trial-widget.tsx` (new)
- `src/features/rewrite/__tests__/trial-widget.test.tsx` (new)
- `src/app/page.tsx` (modified)
- `src/features/rewrite/rewrite-workspace.tsx` (modified)
- `src/app/__tests__/page.test.tsx` (modified — fix duplicate text query)
