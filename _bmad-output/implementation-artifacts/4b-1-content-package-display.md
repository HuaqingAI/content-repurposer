# Story 4b.1：内容发布包多平台展示

Status: done

## Story

作为内容创作者，
我想在改写完成后看到每个平台的完整内容发布包，
以便快速了解各平台版本的内容并选择使用。

## Acceptance Criteria

1. **Given** 改写 API 返回 `done` 事件，**When** 用户查看结果区域，**Then** 每个目标平台各有一个 tab，默认激活第一个完成的平台（由 `platform_start` 事件驱动，现有逻辑已实现）

2. **Given** 某个平台改写完成（收到该平台的 `titles`、`tags`、`hook` SSE 事件），**When** 用户查看该平台 tab，**Then** 展示：改写文案（主体）、3 个备选标题（折叠/展开）、推荐标签 3-5 个（折叠/展开）、互动引导语（折叠/展开）

3. **Given** 某个平台正在流式生成（仅收到 `chunk` 事件，`titles`/`tags`/`hook` 尚未到达），**When** 用户查看该平台 tab，**Then** 文案区域显示流式输出光标效果；备选标题/标签/引导语区域显示占位符（如"生成中..."），不崩溃

4. **Given** 多个目标平台均完成改写，**When** 用户点击不同平台 tab，**Then** 内容区域即时切换，无需重新请求（所有平台数据均保存在 Zustand store 中）

5. **Given** 改写完成（`status === 'complete'`），**When** 用户再次点击"重新改写"，**Then** `startRewrite()` 清空 `platformPackages` 和 `recordId`，结果区域消失，等待新结果

## Tasks / Subtasks

- [x] **扩展 `src/features/rewrite/rewrite-store.ts`** (AC: #2, #3, #4, #5)
  - [x] 新增 `ContentPackage` 接口：`{ titles?: string[]; tags?: string[]; hook?: string }`
  - [x] 新增 `platformPackages: Partial<Record<Platform, ContentPackage>>` 字段（初始为 `{}`）
  - [x] 新增 `recordId: string | null` 字段（初始为 `null`，供后续 feedback story 4b-4 使用）
  - [x] 新增 actions：`setTitles(platform, titles)`, `setTags(platform, tags)`, `setHook(platform, hook)`, `setRecordId(recordId)`
  - [x] 在 `startRewrite()` 中追加清空：`platformPackages: {}`, `recordId: null`
  - [x] 在 `initialStreamState` 中加入新字段的初始值
  - [x] **注意：所有现有字段/action 保持不变，仅追加扩展**

- [x] **扩展 `src/features/rewrite/use-rewrite-stream.ts`**（处理新 SSE 事件）(AC: #2, #3)
  - [x] 从 store 订阅新 actions：`setTitles`, `setTags`, `setHook`, `setRecordId`
  - [x] 在 SSE 事件循环中增加 `titles` 分支：`data.titles` 为字符串数组时调用 `setTitles(streamingPlatform, data.titles)`
  - [x] 在 SSE 事件循环中增加 `tags` 分支：`data.tags` 为字符串数组时调用 `setTags(streamingPlatform, data.tags)`
  - [x] 在 SSE 事件循环中增加 `hook` 分支：`data.hook` 为字符串时调用 `setHook(streamingPlatform, data.hook)`
  - [x] 修改 `done` 事件处理：提取 `data.record_id`（字符串类型），调用 `setRecordId(data.record_id)`，再调用 `completeRewrite()`
  - [x] `platform_complete` 事件：**不需要特殊处理**（`streamingPlatform` 在下一个 `platform_start` 时才切换，`titles`/`tags`/`hook` 在 `platform_complete` 之前已到达）
  - [x] 在末尾的 "flushed buffer" 处理中同样补全 `done` 事件对 `record_id` 的提取
  - [x] **关键：`titles`/`tags`/`hook` 到达时，使用 `useRewriteStore.getState().streamingPlatform` 读取当前平台（与 `chunk` 处理模式一致）**

- [x] **新建 `src/features/rewrite/content-package.tsx`** (AC: #2, #3)
  - [x] Props 接口：`{ body: string; isStreaming?: boolean; titles?: string[]; tags?: string[]; hook?: string }`
  - [x] 文案主体：复用 `<StreamingText text={body} isStreaming={isStreaming} />`
  - [x] 备选标题折叠区（`titles` 存在时展示，不存在时显示"生成中..."骨架）：
    - 折叠头含平台图标/标题文字"备选标题"和展开/收起按钮（chevron icon）
    - 展开内容：3 条标题，各独立排列
  - [x] 推荐标签折叠区（`tags` 存在时展示，不存在时显示"生成中..."骨架）：
    - 展开内容：标签以 pill 样式逐个展示
  - [x] 互动引导语折叠区（`hook` 存在时展示，不存在时显示"生成中..."骨架）：
    - 展开内容：引导语全文
  - [x] 使用本地 `useState` 管理各区块展开状态（默认折叠）
  - [x] 所有 UI 使用纯 Tailwind CSS 4.x，颜色 token 遵循现有约定（见下方 UI 设计规范）

- [x] **修改 `src/features/rewrite/rewrite-workspace.tsx`：替换结果展示区** (AC: #1, #4)
  - [x] import `ContentPackage`、从 store 读取 `platformPackages`
  - [x] 在已有结果区（`hasResults && ...`）中，将 `<StreamingText>` 替换为 `<ContentPackage>`
  - [x] ContentPackage 接收：`body={streamingTexts[activeTab] ?? ''}`, `isStreaming={isRewriting && streamingPlatform === activeTab}`, `titles={platformPackages[activeTab]?.titles}`, `tags={platformPackages[activeTab]?.tags}`, `hook={platformPackages[activeTab]?.hook}`
  - [x] **不要删除 `<StreamingText>` 组件本身**（其他地方可能用到，且测试依赖它）

- [x] **更新 `src/features/rewrite/__tests__/rewrite-store.test.ts`** (AC: #5)
  - [x] 在 `resetStore()` 中追加：`platformPackages: {}`, `recordId: null`
  - [x] 新增 describe 块 `platformPackages 和 recordId`：
    - 测试 `setTitles` 写入对应平台
    - 测试 `setTags` 写入对应平台
    - 测试 `setHook` 写入对应平台
    - 测试 `setRecordId` 写入 `recordId`
    - 测试 `startRewrite` 清空 `platformPackages` 和 `recordId`

- [x] **新建 `src/features/rewrite/__tests__/content-package.test.tsx`** (AC: #2, #3)
  - [x] 测试：`titles`/`tags`/`hook` 均未传入时，各区域显示"生成中..."占位符，不崩溃
  - [x] 测试：`titles` 传入时，展开后显示 3 条标题文本
  - [x] 测试：`tags` 传入时，展开后显示标签
  - [x] 测试：`hook` 传入时，展开后显示引导语全文
  - [x] 测试：折叠/展开按钮交互（点击后展开，再点击收起）
  - [x] 测试：`isStreaming=true` 时文案区域显示光标效果（复用 StreamingText 逻辑，无需重复测试 StreamingText 内部）

- [x] **更新 `src/features/rewrite/__tests__/use-rewrite-stream.test.ts`** (新 SSE 事件处理) (AC: #2)
  - [x] 新增测试：收到 `titles` SSE 事件时，`setTitles` 被调用，参数为当前 streamingPlatform 和 titles 数组
  - [x] 新增测试：收到 `tags` SSE 事件时，`setTags` 被调用
  - [x] 新增测试：收到 `hook` SSE 事件时，`setHook` 被调用
  - [x] 新增测试：收到 `done` 事件携带 `record_id` 时，`setRecordId` 被调用且 `completeRewrite` 被调用
  - [x] **现有测试不得修改**（确保向后兼容）

## Dev Notes

### 关键约束（必须遵守）

**文件路径：**
- 新建：`src/features/rewrite/content-package.tsx`
- 新建：`src/features/rewrite/__tests__/content-package.test.tsx`
- 修改：`src/features/rewrite/rewrite-store.ts`（追加字段和 action）
- 修改：`src/features/rewrite/use-rewrite-stream.ts`（新增 SSE 事件分支）
- 修改：`src/features/rewrite/rewrite-workspace.tsx`（替换展示组件）
- 修改：`src/features/rewrite/__tests__/rewrite-store.test.ts`（扩展 resetStore + 新增测试）
- 修改：`src/features/rewrite/__tests__/use-rewrite-stream.test.ts`（新增测试）

**禁止修改的文件：**
- `src/features/rewrite/streaming-text.tsx` — 复用即可，不修改
- `src/features/rewrite/platform-selector.tsx` — 不涉及
- `src/features/rewrite/tone-selector.tsx` — 不涉及
- `src/lib/llm/` — 绝对禁止修改

**Prisma 路径：** `src/generated/prisma/`（非默认路径，如涉及 DB 查询需注意）

### Store 扩展精确设计

```typescript
// src/features/rewrite/rewrite-store.ts — 追加以下内容（不修改已有代码）

// 新增类型（在文件顶部，现有 import 之后）
export interface ContentPackage {
  titles?: string[]
  tags?: string[]
  hook?: string
}

// 在 RewriteState 接口中追加：
interface RewriteState {
  // ... 现有字段保持不变
  platformPackages: Partial<Record<Platform, ContentPackage>>
  recordId: string | null
}

// 在 RewriteActions 接口中追加：
interface RewriteActions {
  // ... 现有 action 保持不变
  setTitles: (platform: Platform, titles: string[]) => void
  setTags: (platform: Platform, tags: string[]) => void
  setHook: (platform: Platform, hook: string) => void
  setRecordId: (recordId: string) => void
}

// initialStreamState 中追加：
const initialStreamState = {
  // ... 现有字段
  platformPackages: {} as Partial<Record<Platform, ContentPackage>>,
  recordId: null as string | null,
}

// startRewrite action 中追加清空：
startRewrite: () =>
  set({
    status: 'rewriting',
    streamingTexts: {},
    activeTab: null,
    streamingPlatform: null,
    streamError: null,
    platformPackages: {},   // 新增
    recordId: null,          // 新增
  }),

// 新增 action 实现：
setTitles: (platform, titles) =>
  set((state) => ({
    platformPackages: {
      ...state.platformPackages,
      [platform]: { ...state.platformPackages[platform], titles },
    },
  })),

setTags: (platform, tags) =>
  set((state) => ({
    platformPackages: {
      ...state.platformPackages,
      [platform]: { ...state.platformPackages[platform], tags },
    },
  })),

setHook: (platform, hook) =>
  set((state) => ({
    platformPackages: {
      ...state.platformPackages,
      [platform]: { ...state.platformPackages[platform], hook },
    },
  })),

setRecordId: (recordId) => set({ recordId }),
```

### SSE Hook 扩展精确设计

```typescript
// src/features/rewrite/use-rewrite-stream.ts — 在现有代码中追加

// 1. 在 hook 顶部追加对新 action 的引用：
const setTitles = useRewriteStore((s) => s.setTitles)
const setTags = useRewriteStore((s) => s.setTags)
const setHook = useRewriteStore((s) => s.setHook)
const setRecordId = useRewriteStore((s) => s.setRecordId)

// 2. 在 SSE 事件 switch/if-else 中追加（在 'chunk' 之后、'done' 之前）：
} else if (eventType === 'titles') {
  const currentPlatform = useRewriteStore.getState().streamingPlatform
  if (currentPlatform && Array.isArray(data.titles)) {
    setTitles(currentPlatform, data.titles as string[])
  }
} else if (eventType === 'tags') {
  const currentPlatform = useRewriteStore.getState().streamingPlatform
  if (currentPlatform && Array.isArray(data.tags)) {
    setTags(currentPlatform, data.tags as string[])
  }
} else if (eventType === 'hook') {
  const currentPlatform = useRewriteStore.getState().streamingPlatform
  if (currentPlatform && typeof data.hook === 'string') {
    setHook(currentPlatform, data.hook)
  }
}

// 3. 修改 'done' 事件处理：
} else if (eventType === 'done') {
  if (typeof data.record_id === 'string') {
    setRecordId(data.record_id)  // 提取 record_id（供 4b-4 feedback 使用）
  }
  completeRewrite()
  streamDone = true
  break
}

// 4. 在末尾 buffer flush 处的 done 分支中同样处理 record_id：
if (eventType === 'done') {
  if (typeof data.record_id === 'string') {
    setRecordId(data.record_id)
  }
  completeRewrite()
}
```

### ContentPackage 组件设计

```tsx
// src/features/rewrite/content-package.tsx
'use client'

import { useState } from 'react'
import { StreamingText } from './streaming-text'

interface ContentPackageProps {
  body: string
  isStreaming?: boolean
  titles?: string[]
  tags?: string[]
  hook?: string
}

export function ContentPackage({ body, isStreaming = false, titles, tags, hook }: ContentPackageProps) {
  const [titlesOpen, setTitlesOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [hookOpen, setHookOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {/* 文案主体：复用现有 StreamingText */}
      <StreamingText text={body} isStreaming={isStreaming} />

      {/* 备选标题 */}
      <CollapsibleSection
        label="备选标题"
        isOpen={titlesOpen}
        onToggle={() => setTitlesOpen((v) => !v)}
        isEmpty={!titles}
      >
        {titles?.map((title, i) => (
          <div key={i} className="text-[13.5px] text-gray-800 py-1 border-b border-border-default last:border-0">
            {i + 1}. {title}
          </div>
        ))}
      </CollapsibleSection>

      {/* 推荐标签 */}
      <CollapsibleSection
        label="推荐标签"
        isOpen={tagsOpen}
        onToggle={() => setTagsOpen((v) => !v)}
        isEmpty={!tags}
      >
        <div className="flex flex-wrap gap-1.5">
          {tags?.map((tag, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-accent-light text-accent text-xs font-medium">
              #{tag}
            </span>
          ))}
        </div>
      </CollapsibleSection>

      {/* 互动引导语 */}
      <CollapsibleSection
        label="互动引导语"
        isOpen={hookOpen}
        onToggle={() => setHookOpen((v) => !v)}
        isEmpty={!hook}
      >
        <p className="text-[13.5px] text-gray-800 leading-[1.7]">{hook}</p>
      </CollapsibleSection>
    </div>
  )
}

// 内部折叠区组件
interface CollapsibleSectionProps {
  label: string
  isOpen: boolean
  onToggle: () => void
  isEmpty: boolean  // true = 数据尚未到达，显示"生成中..."
  children: React.ReactNode
}

function CollapsibleSection({ label, isOpen, onToggle, isEmpty, children }: CollapsibleSectionProps) {
  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        disabled={isEmpty}
        className={[
          'w-full flex items-center justify-between px-3 py-2',
          'text-xs font-medium text-text-secondary bg-surface-2',
          isEmpty ? 'cursor-default' : 'hover:bg-accent-light transition-colors cursor-pointer',
        ].join(' ')}
      >
        <span>{label}</span>
        {isEmpty ? (
          <span className="text-text-caption">生成中...</span>
        ) : (
          <span className={['transition-transform duration-150', isOpen ? 'rotate-180' : ''].join(' ')}>
            ▾
          </span>
        )}
      </button>
      {!isEmpty && isOpen && (
        <div className="px-3 py-2 bg-white">
          {children}
        </div>
      )}
    </div>
  )
}
```

### rewrite-workspace.tsx 修改要点

```tsx
// 修改导入（追加）
import { ContentPackage } from './content-package'

// 追加 store 订阅
const platformPackages = useRewriteStore((s) => s.platformPackages)

// 替换结果区域中的 StreamingText（约第 175-179 行）
{activeTab && (
  <ContentPackage
    body={streamingTexts[activeTab] ?? ''}
    isStreaming={isRewriting && streamingPlatform === activeTab}
    titles={platformPackages[activeTab]?.titles}
    tags={platformPackages[activeTab]?.tags}
    hook={platformPackages[activeTab]?.hook}
  />
)}
```

### UI 颜色 Token（来自现有代码）

可用颜色（均已在现有组件中使用，直接复用）：
- `bg-accent` / `hover:bg-accent-hover` — 主色按钮
- `bg-accent-light` / `text-accent` — 浅色强调（tag pill 背景）
- `bg-surface-2` — 输入框/卡片背景
- `border-border-default` / `focus:border-border-focus` — 边框
- `text-secondary` / `text-text-secondary` — 次级文本
- `text-text-caption` — 说明文字

### SSE 协议顺序（改写 API 确保此顺序）

```
platform_start  → { platform: "xiaohongshu" }
chunk           → { text: "..." }（多次）
titles          → { titles: ["标题1", "标题2", "标题3"] }
tags            → { tags: ["标签1", "标签2", "标签3"] }
hook            → { hook: "互动引导语内容" }
platform_complete → { platform: "xiaohongshu", tokens_used: 1200, cost_cents: 8 }
（下一个平台 platform_start ...）
done            → { record_id: "uuid" }
```

`streamingPlatform` 在 `platform_start` 时设为当前平台，直到下一个 `platform_start` 时切换。因此 `titles`/`tags`/`hook` 到达时，`streamingPlatform` 一定是当前正确的平台。

### 本 Story 不涉及的事项（留给后续 Story）

| 功能 | Story |
|---|---|
| 各区块的"一键复制"按钮 | 4b-2 |
| 文案区域可直接编辑 | 4b-3 |
| 有帮助/没帮助反馈按钮 | 4b-4 |
| 重新改写按钮（点击按当前语气重新生成） | 4b-4 |

**不要在本 Story 中添加以上功能**，即使组件结构预留位置也不要实现逻辑。

### 已存在文件（勿重新创建）

| 文件 | 用途 |
|---|---|
| `src/features/rewrite/streaming-text.tsx` | 流式文本渲染，**直接复用**，传入 `body` 和 `isStreaming` |
| `src/features/rewrite/rewrite-store.ts` | Zustand store，**追加扩展**，不重写 |
| `src/features/rewrite/use-rewrite-stream.ts` | SSE hook，**追加分支**，不重写 |
| `src/features/rewrite/rewrite-workspace.tsx` | 工作区，**替换结果展示**，保留其余结构 |

### 环境与技术栈约束

- **Next.js**：版本 **16.2.1**（非 15），与训练数据有 Breaking Changes，编写 Route Handler 前务必阅读 `node_modules/next/dist/docs/`
- **Tailwind CSS 4.x**（非 3.x），颜色 token 用 CSS 变量方式（如 `var(--color-accent)`），类名用法见现有组件
- **TypeScript strict mode**
- **测试框架**：Jest + React Testing Library，测试文件放在 `__tests__/` 子目录
- **shadcn/ui 未安装**，所有 UI 必须用纯 Tailwind CSS 实现（已确认：来自 4a-6 dev notes）
- **Prisma 路径**：`src/generated/prisma/`（非默认路径，如涉及 DB 查询需注意）

### 来自前置 Story 的已知经验

| 来源 | 经验 |
|---|---|
| 4a-6 dev notes | shadcn/ui 未安装，纯 Tailwind CSS |
| 4a-6 dev notes | Tailwind 颜色 token 写法 `bg-accent`、`bg-surface-2` 等 |
| 4a-4 deferred | `VALID_PLATFORMS` 在 `use-rewrite-stream.ts` 和 `rewrite-workspace.tsx` 两处都有定义（DRY 问题），本 Story 不处理，保持现状 |
| rewrite-store tests | `resetStore()` 需在每个测试用例扩展时同步更新，否则测试间状态污染 |
| use-rewrite-stream.ts | 事件处理用 `useRewriteStore.getState()` 读取 `streamingPlatform`（避免 React 闭包陈旧值），本 Story 新增分支沿用此模式 |

### Project Structure Notes

- 新组件放置：`src/features/rewrite/content-package.tsx`（遵循 feature-based 组织）
- 测试放置：`src/features/rewrite/__tests__/content-package.test.tsx`
- 无需新建任何 API Route（本 Story 纯前端）
- 无需修改数据库 schema

### References

- [Source: epics.md#Story 4b.1] — AC 原文、FR15、FR18 覆盖要求
- [Source: epics.md#Epic 4b] — Epic 整体目标，后续 4b-2/3/4 scope 边界
- [Source: architecture.md#API & Communication Patterns] — SSE 协议完整定义（titles/tags/hook 事件格式）
- [Source: architecture.md#Frontend Architecture] — result-display.tsx、content-package.tsx 目标文件定义
- [Source: architecture.md#Structure Patterns] — `features/rewrite/` 目录组织规范
- [Source: architecture.md#Enforcement Guidelines] — "不在客户端组件中直接访问 DB 或 LLM API"
- [Source: _bmad-output/implementation-artifacts/4a-6-url-extraction.md#Dev Notes] — UI token、shadcn/ui 未安装确认、Tailwind 4.x 使用约定
- [Source: src/features/rewrite/rewrite-store.ts] — 现有 store 结构，扩展时保持一致
- [Source: src/features/rewrite/use-rewrite-stream.ts] — 现有 SSE hook，新分支沿用 `getState()` 模式
- [Source: src/features/rewrite/rewrite-workspace.tsx] — 当前展示区代码位置（约第 155-182 行）
- [Source: src/features/rewrite/__tests__/rewrite-store.test.ts] — resetStore 扩展点位置（第 14-20 行）

### Review Findings

- [x] [Review][Patch] `isEmpty={!titles}` / `isEmpty={!tags}` 对空数组判断错误——`![]` 为 `false`，空数组会显示为可点击但内容为空的区域，应改为 `isEmpty={!titles || titles.length === 0}` [content-package.tsx:29, 43]
- [x] [Review][Defer] Array element type validation 缺失——`data.titles as string[]` 仅验证是数组，未校验每个元素为字符串 [use-rewrite-stream.ts:111-112] — deferred, pre-existing pattern
- [x] [Review][Defer] `key={i}` 反模式用于 titles/tags 列表，虽本场景为一次性到达非增量，但不符合 React 最佳实践 [content-package.tsx:32, 50] — deferred, pre-existing pattern
- [x] [Review][Defer] 空字符串或纯空白 tag 会渲染为空的 `#` pill [content-package.tsx:49-56] — deferred, 服务端数据质量问题

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

无需 debug log，所有测试一次通过。

### Completion Notes List

- 所有 7 个任务组全部完成，56 个测试全部通过（rewrite-store: 21 tests, content-package: 14 tests, use-rewrite-stream: 21 tests）
- `use-rewrite-stream.ts` 中 `titles`/`tags`/`hook` 事件处理沿用 `getState().streamingPlatform` 模式，避免 React 闭包陈旧值问题
- `content-package.tsx` 中 `CollapsibleSection` 组件的 `isEmpty=true` 时通过 `disabled` 属性禁用按钮，`onClick` 设为 `undefined`，符合无障碍标准
- 现有 `use-rewrite-stream.test.ts` 测试未被修改，仅追加新 describe 块
- TypeScript 类型检查在 src/features/rewrite/ 下的所有源文件无报错（项目级 @types/jest 缺失为已知预存问题）

### File List

- 新建：`src/features/rewrite/content-package.tsx`
- 新建：`src/features/rewrite/__tests__/content-package.test.tsx`
- 修改：`src/features/rewrite/rewrite-store.ts`
- 修改：`src/features/rewrite/use-rewrite-stream.ts`
- 修改：`src/features/rewrite/rewrite-workspace.tsx`
- 修改：`src/features/rewrite/__tests__/rewrite-store.test.ts`
- 修改：`src/features/rewrite/__tests__/use-rewrite-stream.test.ts`
