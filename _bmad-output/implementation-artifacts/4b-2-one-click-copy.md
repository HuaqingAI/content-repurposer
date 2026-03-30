# Story 4b.2：一键复制功能

Status: done

## Story

作为内容创作者，
我想一键复制改写结果的任意部分，
以便直接粘贴到各平台发布后台，不需要手动全选。

## Acceptance Criteria

1. **Given** 改写结果已展示（`status === 'complete'`），**When** 用户点击文案主体旁的复制按钮，**Then** 文案全文写入剪贴板，按钮短暂显示"已复制 ✓"（1.5 秒后恢复"复制"）

2. **Given** 备选标题区域已展开，**When** 用户点击某条标题旁的复制按钮，**Then** 该标题文本写入剪贴板，该按钮短暂显示"已复制 ✓"后恢复原状

3. **Given** 推荐标签区域已加载（`tags` 存在），**When** 用户点击标签区域头部的复制按钮，**Then** 所有标签以逗号分隔写入剪贴板（如 `"标签1, 标签2, 标签3"`），按钮短暂显示"已复制 ✓"后恢复

4. **Given** 互动引导语区域已加载（`hook` 存在），**When** 用户点击引导语区域头部的复制按钮，**Then** 引导语全文写入剪贴板，按钮短暂显示"已复制 ✓"后恢复

5. **Given** 数据尚未到达（各区域仍显示"生成中..."），**When** 用户查看相应区域，**Then** 无复制按钮显示，组件不崩溃

## Tasks / Subtasks

- [x] **新建 `src/components/copy-button.tsx`** 共享复制按钮组件 (AC: #1, #2, #3, #4, #5)
  - [x] Props 接口：`{ text: string; className?: string }`
  - [x] 本地 `useState<boolean>(false)` 管理 `copied` 状态
  - [x] 点击事件：`e.stopPropagation()` 阻止冒泡，调用 `navigator.clipboard.writeText(text)`，成功后 `setCopied(true)`，1.5 秒后 `setCopied(false)`（`setTimeout`）
  - [x] clipboard 失败时静默忽略（`try/catch`，不显示 UI 错误）
  - [x] 显示文字：`copied ? '已复制 ✓' : '复制'`
  - [x] 样式：纯 Tailwind CSS 4.x，默认 `text-text-secondary hover:text-accent`，已复制状态 `text-accent`
  - [x] **文件路径：`src/components/copy-button.tsx`**（架构定义的共享组件位置，不在 features/ 下）

- [x] **修改 `src/features/rewrite/content-package.tsx`** 添加复制按钮 (AC: #1, #2, #3, #4, #5)
  - [x] import `CopyButton` from `@/components/copy-button`
  - [x] `CollapsibleSection` 接口新增 `copyText?: string` prop
  - [x] 修改 `CollapsibleSection` 头部结构：将单个 `<button>（w-full）` 改为 `<div>（flex row）` 包裹展开 `<button>（flex-1）` + 可选 `<CopyButton>`（**不得嵌套 button，HTML 规范禁止**）
  - [x] 文案主体区域：在 `<StreamingText>` 外包 `<div>`，`!isStreaming && body` 时在其下方追加 `<div className="flex justify-end mt-1"><CopyButton text={body} /></div>`
  - [x] 备选标题：每条标题 `<div>` 改为 `flex items-center justify-between`，右侧追加 `<CopyButton text={title} />`
  - [x] 推荐标签折叠区：`CollapsibleSection` 传入 `copyText={tags ? tags.join(', ') : undefined}`
  - [x] 互动引导语折叠区：`CollapsibleSection` 传入 `copyText={hook}`
  - [x] 备选标题折叠区：**不传入 `copyText`**（AC 要求单独复制每条，不需要折叠头"复制全部"按钮）
  - [x] **现有 isEmpty 逻辑、展开/收起行为保持不变**

- [x] **新建 `src/components/__tests__/copy-button.test.tsx`** (AC: #1, #2, #3, #4)
  - [x] 在 `beforeEach` 中 mock `navigator.clipboard.writeText` 为 `jest.fn().mockResolvedValue(undefined)`
  - [x] 测试：默认渲染显示"复制"文字
  - [x] 测试：点击后调用 `navigator.clipboard.writeText` 且参数为传入的 `text`
  - [x] 测试：点击后显示"已复制 ✓"
  - [x] 测试：1.5 秒（`jest.advanceTimersByTime(1500)`）后恢复显示"复制"（使用 `jest.useFakeTimers()`）
  - [x] 测试：clipboard 抛出异常时，组件不崩溃，不显示错误信息
  - [x] 测试：点击时 `e.stopPropagation` 被调用

- [x] **更新 `src/features/rewrite/__tests__/content-package.test.tsx`** 测试复制功能 (AC: #1, #2, #3, #4, #5)
  - [x] 在文件顶部追加 `jest.mock('@/components/copy-button', ...)` mock
  - [x] 测试：body 非空且非 streaming 时，存在 `data-testid="copy-button"` 且 `data-copy-text` 为 body 内容
  - [x] 测试：`isStreaming=true` 时，无复制按钮（body 复制按钮）
  - [x] 测试：titles 展开后，每条标题旁有 `data-testid="copy-button"`，`data-copy-text` 为对应标题文本
  - [x] 测试：tags 存在时，标签 `CollapsibleSection` 头部有复制按钮，`data-copy-text` 为 `"tag1, tag2, tag3"` 格式
  - [x] 测试：hook 存在时，引导语 `CollapsibleSection` 头部有复制按钮，`data-copy-text` 为 hook 全文
  - [x] 测试：titles/tags/hook 均未传入（isEmpty）时，相应区域无复制按钮
  - [x] **现有测试不得修改**（仅追加新 describe 块）

## Dev Notes

### 关键约束（必须遵守）

**文件路径：**
- 新建：`src/components/copy-button.tsx`（共享组件，非 features/rewrite/）
- 新建：`src/components/__tests__/copy-button.test.tsx`
- 修改：`src/features/rewrite/content-package.tsx`（追加 CopyButton 集成）
- 修改：`src/features/rewrite/__tests__/content-package.test.tsx`（追加测试）

**禁止修改的文件：**
- `src/features/rewrite/rewrite-store.ts` — 本 Story 无 store 变更
- `src/features/rewrite/use-rewrite-stream.ts` — 本 Story 无 SSE 变更
- `src/features/rewrite/rewrite-workspace.tsx` — 本 Story 无 workspace 变更
- `src/features/rewrite/streaming-text.tsx` — 复用即可，不修改
- `src/lib/llm/` — 绝对禁止修改
- 数据库 schema — 本 Story 无 DB 变更

### CopyButton 精确设计

```tsx
// src/components/copy-button.tsx
'use client'

import { useState, useCallback } from 'react'

interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()  // 阻止冒泡，防止触发 CollapsibleSection 的展开/收起
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        // 静默忽略：用户拒绝 clipboard 权限
      }
    },
    [text]
  )

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        'text-xs px-2 py-0.5 rounded transition-colors',
        copied ? 'text-accent' : 'text-text-secondary hover:text-accent',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={copied ? '已复制' : '复制'}
    >
      {copied ? '已复制 ✓' : '复制'}
    </button>
  )
}
```

### CollapsibleSection 修改精确设计

```tsx
// 修改后的接口（追加 copyText，不改动其他字段）
interface CollapsibleSectionProps {
  label: string
  isOpen: boolean
  onToggle: () => void
  isEmpty: boolean
  copyText?: string  // 新增：若提供且 !isEmpty，在头部显示 CopyButton
  children: React.ReactNode
}

// 修改后的 CollapsibleSection 函数（头部从单 <button> 改为 <div> + 两个独立 button）
function CollapsibleSection({ label, isOpen, onToggle, isEmpty, copyText, children }: CollapsibleSectionProps) {
  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      {/* 头部 flex 行：展开按钮（flex-1）+ 可选复制按钮 */}
      <div className="flex items-center bg-surface-2">
        <button
          type="button"
          onClick={isEmpty ? undefined : onToggle}
          disabled={isEmpty}
          className={[
            'flex-1 flex items-center justify-between px-3 py-2',
            'text-xs font-medium text-text-secondary',
            isEmpty ? 'cursor-default' : 'hover:bg-accent-light transition-colors cursor-pointer',
          ].join(' ')}
        >
          <span>{label}</span>
          {isEmpty ? (
            <span className="text-text-caption">生成中...</span>
          ) : (
            <span
              className={['transition-transform duration-150 inline-block', isOpen ? 'rotate-180' : ''].join(' ')}
              aria-hidden="true"
            >
              ▾
            </span>
          )}
        </button>
        {/* 复制按钮：仅在数据就绪时显示 */}
        {!isEmpty && copyText !== undefined && (
          <CopyButton text={copyText} className="mr-2 shrink-0" />
        )}
      </div>
      {!isEmpty && isOpen && (
        <div className="px-3 py-2 bg-white">
          {children}
        </div>
      )}
    </div>
  )
}
```

### ContentPackage 文案主体区域修改

```tsx
{/* 文案主体：包裹 div，streaming 结束后显示复制按钮 */}
<div>
  <StreamingText text={body} isStreaming={isStreaming} />
  {!isStreaming && body && (
    <div className="flex justify-end mt-1">
      <CopyButton text={body} />
    </div>
  )}
</div>
```

### ContentPackage 备选标题区域修改

```tsx
{/* 每条标题变为 flex 行，右侧追加独立复制按钮 */}
{titles?.map((title, i) => (
  <div
    key={i}
    className="flex items-center justify-between py-1 border-b border-border-default last:border-0"
  >
    <span className="text-[13.5px] text-gray-800 flex-1 mr-2">
      {i + 1}. {title}
    </span>
    <CopyButton text={title} />
  </div>
))}
```

### ContentPackage CollapsibleSection 调用修改

```tsx
{/* 推荐标签：copyText = 所有标签逗号分隔（空格后跟逗号） */}
<CollapsibleSection
  label="推荐标签"
  isOpen={tagsOpen}
  onToggle={() => setTagsOpen((v) => !v)}
  isEmpty={!tags || tags.length === 0}
  copyText={tags ? tags.join(', ') : undefined}
>
  ...
</CollapsibleSection>

{/* 互动引导语：copyText = hook 全文 */}
<CollapsibleSection
  label="互动引导语"
  isOpen={hookOpen}
  onToggle={() => setHookOpen((v) => !v)}
  isEmpty={!hook}
  copyText={hook}
>
  ...
</CollapsibleSection>

{/* 备选标题：不传 copyText（AC 要求单独复制每条，非复制全部） */}
<CollapsibleSection
  label="备选标题"
  isOpen={titlesOpen}
  onToggle={() => setTitlesOpen((v) => !v)}
  isEmpty={!titles || titles.length === 0}
>
  ...
</CollapsibleSection>
```

### 测试 Mock 策略

```typescript
// copy-button.test.tsx：mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
  writable: true,
  configurable: true,
})

// 使用 fake timers 测试 1.5s 恢复
beforeEach(() => {
  jest.useFakeTimers()
  ;(navigator.clipboard.writeText as jest.Mock).mockClear()
})
afterEach(() => {
  jest.useRealTimers()
})

// content-package.test.tsx：mock CopyButton 避免 clipboard 副作用
jest.mock('@/components/copy-button', () => ({
  CopyButton: ({ text, className }: { text: string; className?: string }) => (
    <button data-testid="copy-button" data-copy-text={text} className={className}>
      复制
    </button>
  ),
}))
```

### UI 颜色 Token（来自现有代码，直接复用）

| Token | 用途 |
|---|---|
| `text-text-secondary` | CopyButton 默认颜色 |
| `hover:text-accent` | CopyButton hover 颜色 |
| `text-accent` | CopyButton 已复制状态颜色 |
| `bg-surface-2` | CollapsibleSection 头部背景 |
| `bg-accent-light` | CollapsibleSection hover 背景 |
| `border-border-default` | 边框、标题行分隔线 |

### 环境与技术栈约束

- **Next.js 16.2.1**（非 15），有 Breaking Changes，如需 Route Handler 务必先读 `node_modules/next/dist/docs/`（本 Story 不涉及）
- **Tailwind CSS 4.x**（非 3.x），CSS 变量颜色 token，见现有组件
- **TypeScript strict mode**
- **shadcn/ui 未安装**，所有 UI 必须用纯 Tailwind CSS（来自 4a-6 dev notes）
- **测试框架**：Jest + React Testing Library，测试文件放在对应模块的 `__tests__/` 子目录
- **Clipboard API**：使用 `navigator.clipboard.writeText()`（现代异步 API），jsdom 测试环境中需手动 mock（jsdom 默认不实现 clipboard API）
- **Prisma 路径**：`src/generated/prisma/`（本 Story 不涉及 DB）

### 本 Story 不涉及的事项（留给后续 Story）

| 功能 | Story |
|---|---|
| 文案区域可直接编辑 | 4b-3 |
| 编辑状态下复制按钮复制编辑后内容 | 4b-3（与本 Story 联动，但实现在 4b-3） |
| 有帮助/没帮助反馈按钮 | 4b-4 |
| 重新改写按钮 | 4b-4 |

**不要在本 Story 中添加以上功能**。

### 来自前置 Story 的已知经验

| 来源 | 经验 |
|---|---|
| 4b-1 dev notes | `isEmpty` 检查用 `!titles \|\| titles.length === 0`（非 `!titles`），避免空数组误判 |
| 4b-1 review findings | `isEmpty={!hook}` 对 hook 是字符串，用 `!hook` 即可（空字符串也为 falsy） |
| 4b-1 dev notes | `CopyButton` 点击必须 `e.stopPropagation()` 阻止触发 CollapsibleSection 展开/收起 |
| 4a-6 dev notes | shadcn/ui 未安装，纯 Tailwind CSS |
| 4a-6 dev notes | Tailwind 颜色 token：`bg-accent`、`bg-surface-2`、`text-text-secondary` 等均已验证可用 |
| 4b-1 completion notes | 现有测试（content-package.test.tsx、use-rewrite-stream.test.ts）一次通过，请确保新增测试也一次通过 |

### Project Structure Notes

- `CopyButton` 放置在 `src/components/copy-button.tsx`（架构文档第 631 行明确定义的共享组件路径）
- 测试放置：`src/components/__tests__/copy-button.test.tsx`（与源文件同目录下的 `__tests__/` 子目录）
- `content-package.tsx` 仅追加 CopyButton 集成，不重写组件结构
- 无需新建任何 API Route
- 无需修改数据库 schema

### Review Findings

- [x] [Review][Patch] setTimeout 未清除，组件卸载后内存泄漏 [src/components/copy-button.tsx:19] — 已修复：useRef + useEffect cleanup + clearTimeout
- [x] [Review][Patch] 快速多次点击叠加 setTimeout 导致状态抖动 [src/components/copy-button.tsx:19] — 已修复：每次点击先 clearTimeout 前一个 timer
- [x] [Review][Patch] navigator.clipboard 未做存在性检查 [src/components/copy-button.tsx:17] — 已修复：if (!navigator.clipboard) return
- [x] [Review][Patch] copyText="" 时 CopyButton 仍渲染并复制空字符串 [src/features/rewrite/content-package.tsx:128] — 已修复：`!isEmpty && !!copyText`
- [x] [Review][Defer] 数组下标 key={i} 导致 CopyButton 状态误归属 [src/features/rewrite/content-package.tsx:39,61] — deferred, pre-existing（来自 4b-1，streaming 更新时 key 不稳定）
- [x] [Review][Defer] disabled button + onClick=undefined 逻辑冗余 [src/features/rewrite/content-package.tsx:104] — deferred, pre-existing（disabled 已阻止事件，两者共存但无实际 bug）
- [x] [Review][Defer] titles/tags 数组含空字符串元素时渲染空行并复制格式异常 [src/features/rewrite/content-package.tsx:39,61] — deferred, 数据清洗属上游 API/Story 3.x 职责范畴
- [x] [Review][Defer] fake timers afterEach 恢复时 pending callback 测试间干扰 [src/components/__tests__/copy-button.test.tsx:21-23] — deferred, 当前测试结构稳定运行，低优先级

### References

- [Source: epics.md#Story 4b.2] — 一键复制 AC 原文、FR16 覆盖，标题单独复制/标签逗号复制需求
- [Source: epics.md#Epic 4b] — Epic 整体目标，4b-3 编辑状态与复制的联动（本 Story 不实现）
- [Source: architecture.md#Project Structure] — `src/components/copy-button.tsx` 共享组件路径定义（第 631-632 行）
- [Source: architecture.md#Frontend Architecture] — Feature-based 组织、Tailwind CSS 4.x、Zustand 状态管理
- [Source: architecture.md#Enforcement Guidelines] — 不在客户端组件直接访问 DB/LLM API、文件命名规范
- [Source: _bmad-output/implementation-artifacts/4b-1-content-package-display.md] — ContentPackage 和 CollapsibleSection 完整设计、isEmpty 修复、现有测试结构
- [Source: src/features/rewrite/content-package.tsx] — 现有组件结构（当前实现，修改基础）
- [Source: _bmad-output/implementation-artifacts/4a-6-url-extraction.md#Dev Notes] — shadcn/ui 未安装确认、Tailwind 4.x token 约定

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

无需 debug log，所有测试一次通过。

### Completion Notes List

- 新建 `src/components/copy-button.tsx`：使用 `navigator.clipboard.writeText()`，点击后显示"已复制 ✓"，1.5 秒后自动恢复；`e.stopPropagation()` 防止触发父级展开/收起；clipboard 权限被拒时静默忽略
- 修改 `src/features/rewrite/content-package.tsx`：CollapsibleSection 头部结构从单 `<button w-full>` 改为 `<div> + <button flex-1> + CopyButton`（避免嵌套 button 违反 HTML 规范）；文案主体区域 streaming 结束后显示复制按钮；各标题独立复制；标签区域复制逗号分隔全部标签；引导语区域复制全文
- 新建 `src/components/__tests__/copy-button.test.tsx`：6 个测试（含 fake timers 测试 1.5s 恢复、stopPropagation 验证、异常静默）
- 更新 `src/features/rewrite/__tests__/content-package.test.tsx`：追加 `jest.mock('@/components/copy-button')` + 8 个新测试；原有 20 个测试全部保持通过
- 测试结果：30 个测试全部通过（6 copy-button + 24 content-package）；全套 336 个测试无回归（proxy.test.ts 4 个预存失败与本 Story 无关）

### File List

- 新建：`src/components/copy-button.tsx`
- 新建：`src/components/__tests__/copy-button.test.tsx`
- 修改：`src/features/rewrite/content-package.tsx`
- 修改：`src/features/rewrite/__tests__/content-package.test.tsx`
