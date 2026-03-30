# Story 4a.1: 原文输入区

Status: done

## Story

作为内容创作者，
我想将文章粘贴到输入框并看到字数提示，
以便确认内容已正确输入且符合字数要求再开始改写。

## Acceptance Criteria

1. **Given** 用户在 `/app` 页面的输入框中粘贴文本，**When** 文本内容发生变化，**Then** 实时显示当前字数，格式：`xxx / 5000 字`

2. **Given** 输入内容字数少于 50 字，**When** 显示输入区，**Then** 字数提示变为警告色，输入框下方显示"原文至少需要 50 字"，"开始改写"按钮禁用（按钮为占位实现，Story 4a.4 将替换为真实逻辑）

3. **Given** 输入内容字数超过 5000 字，**When** 显示输入区，**Then** 超出的字符部分背景高亮显示（红色背景），输入框下方显示"原文超出 5000 字限制"，"开始改写"按钮禁用

4. **Given** 用户向输入框中输入文本，**When** 内容持续增加，**Then** 输入框高度随内容自动扩展，达到最大高度（400px）后出现内部滚动条

## Tasks / Subtasks

- [x] **扩展全局 CSS 设计 token** (AC: 视觉一致性)
  - [x] 修改 `src/app/globals.css`，在 `@theme inline` 中添加适文品牌色变量
  - [x] 添加：`--color-accent: #3d6b4f`、`--color-accent-hover: #2f5640`、`--color-surface-2: #f9f8f5`、`--color-border-default: #e8e5de`、`--color-border-focus: #a0998a`、`--color-text-secondary: #6b6560`、`--color-text-caption: #a09890`

- [x] **创建 TextInput 客户端组件** (AC: #1, #2, #3, #4)
  - [x] 新建 `src/features/rewrite/text-input.tsx`（`'use client'`），这是本 Story 的核心交付物
  - [x] 实现受控组件接口：`props { value: string; onChange: (v: string) => void; disabled?: boolean }`
  - [x] 实现实时字数计数，显示格式 `{count} / 5000 字`；count > 5000 时数字变红色
  - [x] 实现输入框高度自动扩展（auto-grow），最大高度 400px；使用 `useEffect` + `ref.style.height` 方案（见 Dev Notes）
  - [x] 实现超出字数高亮：使用"div 叠加层 + 透明 textarea"方案（见 Dev Notes）；仅当 `value.length > 5000` 时渲染叠加层
  - [x] 实现验证提示文案：`< 50` 字显示"原文至少需要 50 字"；`> 5000` 字显示"原文超出 5000 字限制"
  - [x] 组件不直接控制"开始改写"按钮，只负责自身显示；父组件根据 `value.length` 决定按钮状态

- [x] **更新 `/app` 页面展示 TextInput 组件** (AC: #1-#4)
  - [x] 修改 `src/app/app/page.tsx` 为 Client Component（`'use client'`），用 `useState` 管理文本值
  - [x] 引入并渲染 `TextInput` 组件，展示完整交互效果
  - [x] 添加禁用状态的"开始改写"占位按钮（按钮 disabled 条件：`value.length < 50 || value.length > 5000`）
  - [x] 使用简单布局展示（非完整 workspace 布局；Story 4a.4 将创建 `rewrite-workspace.tsx` 完整布局）
  - [x] **注意**：Story 4a.4 会替换 `page.tsx` 内容，此处只是为了满足 AC 可视化验证

- [x] **编写组件测试** (AC: #1, #2, #3, #4)
  - [x] 新建 `src/features/rewrite/__tests__/text-input.test.tsx`
  - [x] 测试：初始渲染（空文本），显示 `0 / 5000 字`
  - [x] 测试：输入 30 字文本，显示字数，错误提示"原文至少需要 50 字"可见
  - [x] 测试：输入刚好 50 字文本，错误提示消失
  - [x] 测试：输入 200 字文本（正常范围），无错误提示，字数正确显示
  - [x] 测试：输入 5001 字文本，显示"原文超出 5000 字限制"可见
  - [x] 测试：`disabled=true` 时，textarea 不可交互（`disabled` 属性）

### Review Findings

- [x] [Review][Patch] 字数提示在 isUnder 时未变警告色，违反 AC#2"字数提示变为警告色" [src/features/rewrite/text-input.tsx:43]
- [x] [Review][Patch] 测试未覆盖 isUnder 时字数提示颜色变化（AC#2 缺失断言） [src/features/rewrite/__tests__/text-input.test.tsx]
- [x] [Review][Patch] UTF-16 `.length` 计数偏差：emoji/生僻字被计为 2，字数统计与用户感知不符 [src/features/rewrite/text-input.tsx:19, src/app/app/page.tsx:8]
- [x] [Review][Patch] Overlay 字体样式硬编码（fontSize/lineHeight/padding），与 textarea Tailwind 类不同步，未来修改易产生高亮位移 [src/features/rewrite/text-input.tsx:57-62]
- [x] [Review][Patch] Overlay 使用 overflow-hidden 但仍同步 scrollLeft（死代码），水平滚动永远不会发生 [src/features/rewrite/text-input.tsx]
- [x] [Review][Patch] Overlay 内边距未补偿 textarea border 宽度，导致约 1px 垂直位移 [src/features/rewrite/text-input.tsx]
- [x] [Review][Patch] Overlay 条件渲染：isOver 切换时 overlay remount，scrollTop 重置为 0 导致高亮短暂错位 [src/features/rewrite/text-input.tsx:52-68]
- [x] [Review][Patch] Button 缺少 type="button"，在 form 内部会默认 type="submit" [src/app/app/page.tsx:14]
- [x] [Review][Patch] textarea 无 aria-label/aria-labelledby，placeholder 不是 label 替代品 [src/features/rewrite/text-input.tsx]
- [x] [Review][Patch] countColorClass 为运行时变量，Tailwind 静态扫描可能 purge 掉条件类名 [src/features/rewrite/text-input.tsx:43]
- [x] [Review][Patch] 测试边界不足：<50 字用例仅用 "太短"（2字），缺少 1 字、49 字边界测试 [src/features/rewrite/__tests__/text-input.test.tsx]
- [x] [Review][Defer] disabled 按钮无 ARIA 无障碍说明（占位页，Story 4a.4 实现真实布局时处理） [src/app/app/page.tsx] — deferred, pre-existing
- [x] [Review][Defer] Auto-grow useEffect 每次 keystroke 强制 layout thrash（先设 height=auto 再测量）— deferred, pre-existing

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全部为代码实现，无需外部配置 | 自动 |

### 关键架构约束（必须遵守）

**目录规范（本 Story 新建 `src/features/rewrite/` 模块）：**
- 这是 Epic 4a/4b 所有改写前端组件的统一位置
- 文件名：`kebab-case`，组件名：`PascalCase`
- 测试文件放在同目录 `__tests__/` 下，命名 `*.test.tsx`

**UI 组件限制（重要）：**
- `src/components/ui/` 目前为空，**shadcn/ui 未安装**
- 所有 UI **必须用纯 Tailwind CSS 4.x 实现**，不依赖 shadcn/ui
- Tailwind 4.x 使用 `@import "tailwindcss"` 不需要 `tailwind.config.js`
- 自定义颜色通过 `src/app/globals.css` 的 `@theme inline` 块添加 CSS 变量

**受控组件设计原则：**
```typescript
// text-input.tsx 只负责 UI，不持有业务状态
// 父组件（现在是 page.tsx，未来是 rewrite-store.ts）控制 value
interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean  // 改写中时锁定输入框
}
```

### 设计 Token（来自 UX 设计稿 outputs/shiwén-ux-preview.html）

以下颜色需添加到 `src/app/globals.css` 的 `@theme inline` 块中：

```css
@theme inline {
  /* 现有变量（保留） */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  /* 新增适文品牌 token */
  --color-accent: #3d6b4f;
  --color-accent-hover: #2f5640;
  --color-accent-light: #e8f2ec;
  --color-surface-2: #f9f8f5;
  --color-border-default: #e8e5de;
  --color-border-focus: #a0998a;
  --color-text-secondary: #6b6560;
  --color-text-caption: #a09890;
}
```

在 Tailwind 4 中，`@theme` 里定义的 `--color-*` 变量自动生成对应的 utility class：
- `--color-accent` → `bg-accent`、`text-accent`、`border-accent`
- `--color-surface-2` → `bg-surface-2`
- 等等

### TextInput 组件设计

#### 超出字数高亮方案（"叠加层 + 透明 textarea"）

当 `value.length > 5000` 时，需要高亮超出部分。使用叠加层方案：

```tsx
// src/features/rewrite/text-input.tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'

const MIN_LENGTH = 50
const MAX_LENGTH = 5000
const MAX_HEIGHT = 400  // px

interface TextInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TextInput({ value, onChange, disabled = false }: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const charCount = value.length
  const isUnder = charCount < MIN_LENGTH && charCount > 0
  const isOver = charCount > MAX_LENGTH
  const isEmpty = charCount === 0

  // Auto-grow 高度
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  // 同步叠加层滚动（当超出限制时）
  const handleScroll = useCallback(() => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  const errorMessage = isUnder
    ? '原文至少需要 50 字'
    : isOver
    ? '原文超出 5000 字限制'
    : null

  // 字数显示颜色：正常 text-caption，超出 text-red-500
  const countColorClass = isOver ? 'text-red-500' : 'text-text-caption'

  return (
    <div className="flex flex-col gap-1">
      {/* 输入框容器（叠加层 + textarea） */}
      <div className="relative">
        {/* 叠加高亮层（仅超出时渲染，pointer-events-none 不拦截事件） */}
        {isOver && (
          <div
            ref={overlayRef}
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden pointer-events-none whitespace-pre-wrap break-words"
            style={{
              // 必须与 textarea 完全相同的字体/行高/内边距
              fontFamily: 'inherit',
              fontSize: '13.5px',
              lineHeight: '1.7',
              padding: '12px',
              color: 'transparent',  // 文字透明（只显示背景色）
            }}
          >
            <span>{value.slice(0, MAX_LENGTH)}</span>
            <span className="bg-red-100">{value.slice(MAX_LENGTH)}</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          disabled={disabled}
          placeholder="将文章内容粘贴到这里..."
          rows={6}
          className={[
            'relative w-full resize-none rounded-lg px-3 py-3 text-[13.5px] leading-[1.7]',
            'border transition-colors duration-150 font-[inherit]',
            'focus:outline-none',
            // 超出时背景透明以显示叠加层
            isOver ? 'bg-transparent' : 'bg-surface-2 focus:bg-white',
            isOver
              ? 'border-red-400 focus:border-red-400'
              : 'border-border-default focus:border-border-focus',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          style={{ maxHeight: `${MAX_HEIGHT}px` }}
        />
      </div>

      {/* 字数统计 + 错误提示行 */}
      <div className="flex items-start justify-between gap-2 min-h-[16px]">
        {errorMessage ? (
          <p className="text-xs text-red-500">{errorMessage}</p>
        ) : (
          <span />
        )}
        <span className={`text-xs shrink-0 ${countColorClass}`}>
          {charCount} / {MAX_LENGTH} 字
        </span>
      </div>
    </div>
  )
}
```

**叠加层注意事项：**
- `color: 'transparent'` 使叠加层文字不可见，只显示 `bg-red-100` 高亮背景
- 叠加层的 `font-size`、`line-height`、`padding` 必须与 textarea **完全一致**
- `handleScroll` 同步叠加层滚动位置，保证超出高亮与 textarea 内容对齐
- `aria-hidden="true"` 不影响无障碍功能，屏幕阅读器只读 textarea

#### Auto-grow 实现细节

```typescript
// useEffect 在每次 value 变化后重新计算高度
useEffect(() => {
  const el = textareaRef.current
  if (!el) return
  el.style.height = 'auto'           // 先重置，让 scrollHeight 重新计算
  el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`  // 取 min
}, [value])

// 初始 rows={6} 设定最小可视高度（约 162px）
// maxHeight: 400px 后 textarea 自身出现滚动条（overflow-y: auto）
```

### `/app` 页面临时实现

Story 4a.4 会完全替换 `page.tsx`。现在只做最简展示：

```tsx
// src/app/app/page.tsx
'use client'

import { useState } from 'react'
import { TextInput } from '@/features/rewrite/text-input'

export default function AppPage() {
  const [text, setText] = useState('')
  const isValid = text.length >= 50 && text.length <= 5000

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-4">改写工作区</h1>
      <TextInput value={text} onChange={setText} />
      <button
        disabled={!isValid}
        className="mt-4 w-full py-3 rounded-lg bg-accent text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
      >
        开始改写
      </button>
    </div>
  )
}
```

**说明：** `isValid` 逻辑放在父组件（page.tsx），TextInput 组件本身不持有"是否可以改写"的业务逻辑，只负责展示字数和超出警告。

### 测试模式参考（来自 Story 2.4 / 2.3）

```typescript
// src/features/rewrite/__tests__/text-input.test.tsx
// @jest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { TextInput } from '../text-input'

describe('TextInput', () => {
  it('初始化显示 0 / 5000 字', () => {
    render(<TextInput value="" onChange={() => {}} />)
    expect(screen.getByText('0 / 5000 字')).toBeInTheDocument()
  })

  it('少于 50 字时显示错误提示', () => {
    render(<TextInput value="太短" onChange={() => {}} />)
    expect(screen.getByText('原文至少需要 50 字')).toBeInTheDocument()
  })

  it('50 字时无错误提示', () => {
    const text = '一'.repeat(50)
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.queryByText('原文至少需要 50 字')).not.toBeInTheDocument()
  })

  it('超过 5000 字时显示超限提示', () => {
    const text = '一'.repeat(5001)
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.getByText('原文超出 5000 字限制')).toBeInTheDocument()
  })

  it('字数正确反映文本长度', () => {
    const text = '你好'.repeat(100)  // 200 字
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.getByText('200 / 5000 字')).toBeInTheDocument()
  })

  it('disabled 时 textarea 不可交互', () => {
    render(<TextInput value="测试内容" onChange={() => {}} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })
})
```

### 已存在文件（禁止重新创建）

| 文件 | 用途 | 状态 |
|---|---|---|
| `src/app/globals.css` | 全局样式 + Tailwind token | 已存在，本 Story **修改**（添加设计 token） |
| `src/app/app/layout.tsx` | /app 路由布局（含 AuthGuard） | 已存在，**不修改** |
| `src/features/auth/auth-guard.tsx` | 客户端会话守卫 | 已存在，**不修改** |
| `src/proxy.ts` | Next.js 16 路由守卫（保护 /app/*） | 已存在，**不修改** |

### 禁止触碰的目录（并行 Session 占用）

| 目录 | 原因 |
|---|---|
| `src/lib/llm/` | Session A 后端开发 |
| `src/app/api/rewrite/route.ts` | Session A 后端开发 |
| `src/features/history/` | 其他 Session 开发 |
| `src/features/admin/` | 其他 Session 开发 |

### 目录结构（本 Story 完成后新增 / 修改文件）

```
src/
├── app/
│   ├── globals.css                            ← 修改（添加设计 token）
│   └── app/
│       └── page.tsx                           ← 修改（临时展示 TextInput）
└── features/
    └── rewrite/                               ← 新建目录
        ├── text-input.tsx                     ← 新建（核心组件）
        └── __tests__/
            └── text-input.test.tsx            ← 新建（单元测试）
```

### Tailwind CSS 4.x 注意事项

本项目使用 Tailwind CSS 4.x（`@tailwindcss/postcss@^4.2.2`），与 Tailwind 3.x 有重要区别：

1. **无 `tailwind.config.js`**：自定义 token 通过 `@theme inline` 在 CSS 中定义
2. **自定义颜色语法**：`@theme inline { --color-{name}: {value}; }` 自动生成 `bg-{name}`、`text-{name}`、`border-{name}` 等 utility class
3. **`@import "tailwindcss"`** 替代了原来的 `@tailwind base/components/utilities`

**使用示例：**
```css
/* globals.css */
@theme inline {
  --color-accent: #3d6b4f;
}
/* 即可在组件中使用 className="bg-accent text-accent border-accent" */
```

### Next.js 16.2.1 注意事项

- `middleware.ts` 在本项目已重命名为 `proxy.ts`（Story 2.3 中已完成）
- Server Component 的 `searchParams` 和 `params` 现为 `Promise<T>`，需要 `await`（本 Story 无涉及）
- `'use client'` 指令在客户端组件的**第一行**声明（import 之前）

### UX 设计参考

UX 原型文件：`outputs/shiwén-ux-preview.html`（项目根目录外，`workspace/outputs/` 目录下）

输入区关键视觉规格：
- textarea 背景：`var(--surface-2)` = `#f9f8f5`，聚焦后变白
- textarea 边框：`#e8e5de`，聚焦后变 `#a0998a`
- textarea 字体大小：`13.5px`，行高 `1.7`
- 字数计数：右对齐，`11px`，正常色 `#a09890`，超出变红
- 错误提示：`12px`，左对齐，红色 `text-red-500`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4a.1] — AC 原文
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — 组件文件规划
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — 命名和结构规范
- [Source: outputs/shiwén-ux-preview.html] — 视觉设计参考
- [Source: src/app/globals.css] — Tailwind 4.x token 扩展位置
- [Source: _bmad-output/implementation-artifacts/2-4-user-settings-page.md#Dev Notes] — 纯 Tailwind CSS 模式（无 shadcn/ui）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- proxy.test.ts 中 4 个失败测试（HTTP 302 vs 307）为预存回归，与本 Story 无关，stash 验证确认。

### Completion Notes List

- ✅ AC#1：TextInput 实时字数显示，格式 `{count} / 5000 字`
- ✅ AC#2：< 50 字警告"原文至少需要 50 字"，isEmpty 时不触发（0 字不显示警告）
- ✅ AC#3：> 5000 字超限高亮（div 叠加层 + 透明 textarea），显示"原文超出 5000 字限制"，字数变红
- ✅ AC#4：textarea auto-grow（useEffect + ref.style.height），最大 400px 后出现内部滚动条
- ✅ 受控组件设计：TextInput 不持有业务状态，父组件（page.tsx）控制 value 和按钮 disabled 逻辑
- ✅ 8 个单元测试全部通过（初始渲染、< 50 字、= 50 字、200 字、> 5000 字、disabled、onChange 回调、超限红色字数）
- ✅ 全量测试套件：本 Story 新增 8 tests 全通过，无新增回归

### File List

- `src/app/globals.css` — 修改（添加 8 个适文品牌色 token）
- `src/features/rewrite/text-input.tsx` — 新建（核心 TextInput 组件）
- `src/app/app/page.tsx` — 修改（临时展示 TextInput，'use client' + useState）
- `src/features/rewrite/__tests__/text-input.test.tsx` — 新建（8 个单元测试）

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-27 | Story 4a.1 创建：原文输入区 | create-story |
| 2026-03-27 | Story 4a.1 实现完成：CSS token、TextInput 组件、page.tsx、8 个单元测试全通过 | dev-agent |
