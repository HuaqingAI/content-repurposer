# Story 4b.3: 改写结果可编辑

Status: done

## Story

作为内容创作者，
我想直接在结果区域修改改写文案，
以便微调内容后直接复制使用，不需要切换到其他编辑器。

## Acceptance Criteria

1. **AC1：进入编辑状态**
   - Given 改写结果文案区域已展示（streaming 已完成，body 不为空）
   - When 用户点击文案区域或"编辑"按钮
   - Then 文案区域切换为可编辑 textarea，用户可自由修改内容

2. **AC2：退出编辑状态**
   - And 用户点击区域外（onBlur）或按 Esc 键时，退出编辑状态
   - And 修改内容保留在界面上（不自动回存数据库）

3. **AC3：编辑状态下复制正确**
   - And 编辑状态下，复制按钮复制的是用户修改后的内容（而非原始 body）
   - And 退出编辑后，复制按钮仍复制修改后的内容

## Tasks / Subtasks

- [x] Task 1：修改 `content-package.tsx` 为 body 区域增加编辑功能（AC: 1, 2, 3）
  - [x] 1.1 新增本地状态 `isEditing: boolean`、`editedBody: string`（初始值 `''`）
  - [x] 1.2 当 `!isStreaming && body` 时，渲染可点击的 body 展示区域（点击触发进入编辑）
  - [x] 1.3 编辑状态下渲染 `<textarea>`，预填 `editedBody || body`，并 focus
  - [x] 1.4 `onBlur` 和 Esc 键均退出编辑状态（`setIsEditing(false)`），不清除 editedBody
  - [x] 1.5 将 `CopyButton` 的 `text` prop 改为 `editedBody || body`，确保复制编辑后内容

- [x] Task 2：运算"有效展示文本"逻辑（AC: 2, 3）
  - [x] 2.1 提取 `displayText = editedBody || body`，body 展示区域和 CopyButton 统一使用 displayText
  - [x] 2.2 仅 `!isStreaming` 时允许编辑（streaming 期间禁止进入编辑模式）

## Dev Notes

### 关键约束

- **禁止回存数据库**：编辑内容仅存在 React 本地状态，不调用任何 API/store 接口
- **仅 body 区域支持编辑**：备选标题、推荐标签、互动引导语不在本 Story 范围内
- **streaming 期间锁定**：`isStreaming === true` 时不展示编辑入口，不允许进入编辑

### 核心文件

**唯一需要修改的文件：**
- `src/features/rewrite/content-package.tsx`

**依赖（只读，不修改）：**
- `src/components/copy-button.tsx` — Props: `{ text: string; className?: string }`

### 当前 body 区域代码（4b-2 交付的状态）

```tsx
{/* 文案主体 */}
<div>
  <StreamingText text={body} isStreaming={isStreaming} />
  {!isStreaming && body && (
    <div className="flex justify-end mt-1">
      <CopyButton text={body} />
    </div>
  )}
</div>
```

### 目标实现结构（伪代码）

```tsx
const [isEditing, setIsEditing] = useState(false)
const [editedBody, setEditedBody] = useState('')
const displayText = editedBody || body

// body 展示区域
<div>
  {isStreaming ? (
    <StreamingText text={body} isStreaming={isStreaming} />
  ) : isEditing ? (
    <textarea
      value={editedBody || body}           // 首次编辑预填 body
      onChange={(e) => setEditedBody(e.target.value)}
      onBlur={() => setIsEditing(false)}
      onKeyDown={(e) => e.key === 'Escape' && setIsEditing(false)}
      autoFocus
      className="..."  // 与原 body 区域视觉一致，去除边框干扰
    />
  ) : (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-text ..."  // 点击触发编辑
    >
      {displayText}
    </div>
  )}
  {!isStreaming && body && (
    <div className="flex justify-end mt-1">
      <CopyButton text={displayText} />  {/* 关键：使用 displayText */}
    </div>
  )}
</div>
```

### Textarea 样式规范

- 使用 Tailwind：`w-full resize-none outline-none text-[13.5px] text-gray-800 leading-[1.7] bg-transparent`
- 高度：使用 `rows` 属性或动态计算，不固定 `h-`，避免截断长文本
- 不额外引入新 package

### 首次 editedBody 处理细节

- `editedBody` 初始值为 `''`（空字符串）
- 进入编辑：textarea `value={editedBody || body}`，onChange 更新 editedBody
- 若用户未修改直接退出：editedBody 仍为 `''`，displayText = body（正确）
- 若用户改了内容：editedBody 存储用户输入，displayText = editedBody（正确）

### 不要做的事（防止回归）

- 不修改 `CopyButton` 组件本身
- 不修改 Zustand store（`rewrite-store.ts`）
- 不修改 `StreamingText` 组件
- 不修改 `CollapsibleSection` 组件
- 不为备选标题/标签/引导语添加编辑功能

### 来自 4b-2 的颜色 Token 参考

| Token | 含义 |
|---|---|
| `text-text-secondary` | 次级文字色 |
| `hover:text-accent` | 悬停强调色 |
| `text-accent` | 强调色（已复制状态） |
| `border-border-default` | 边框默认色 |
| `bg-surface-2` | 次级背景 |
| `bg-accent-light` | 浅强调背景 |

### 项目结构规范

- 文件名：`kebab-case`（本 Story 不新建文件）
- 组件名：`PascalCase`
- 技术栈：React 19 + Next.js 16.2.1、Tailwind CSS 4.x（无 shadcn/ui）
- `'use client'` 指令：`content-package.tsx` 已有，不需要重复添加

### References

- [Source: epics.md] Epic 4b Story 4b.3 改写结果可编辑 - 验收标准
- [Source: implementation-artifacts/4b-2-one-click-copy.md] 前置交付文件列表、CopyButton Props 规范、颜色 token
- [Source: src/features/rewrite/content-package.tsx] 当前 body 区域实现（4b-2 状态）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 在 `ContentPackage` 组件新增 `isEditing` / `editedBody` 本地状态（不触碰 Zustand store）
- 提取 `displayText = editedBody || body`，统一驱动展示区域和 CopyButton
- Body 区域三态渲染：streaming → `<StreamingText>`，编辑中 → `<textarea autoFocus>`，默认 → 可点击 div
- `onBlur` 和 `Escape` 键均退出编辑，`editedBody` 始终保留（不清除）
- CopyButton `text` 由 `body` 改为 `displayText`，确保复制编辑后内容
- 在 `content-package.test.tsx` 新增 8 个 Story 4b.3 专项测试，全量 32 tests 通过
- 全量回归 346/350 通过，4 个失败为 `proxy.test.ts` 预存问题（与本次无关）

### File List

- `src/features/rewrite/content-package.tsx` — 修改：新增 body 行内编辑功能（isEditing/editedBody 状态、三态渲染、displayText 统一复制）
- `src/features/rewrite/__tests__/content-package.test.tsx` — 修改：新增 Story 4b.3 专项测试 8 条

### Review Findings

> **第一轮已解决项（已确认修复）：**
- [x] [Review][Decision] 用户无法清空文案 — 已修复：改用 `null` 哨兵值，`editedBody !== null ? editedBody : body`
- [x] [Review][Decision] `body` prop 变化时 `editedBody` 不重置 — 已修复：`useEffect([body])` 重置
- [x] [Review][Patch] `isEditing` 在 `isStreaming` 重新变为 `true` 时未重置 — 已修复：JSX 渲染树 isStreaming 分支优先；body 变化时 useEffect 重置
- [x] [Review][Patch] `onBlur` 抢先于复制按钮点击事件触发 — 已确认无问题：blur 后 displayText 不变，复制按钮仍命中正确内容
- [x] [Review][Patch] 测试双重 `render` 污染 DOM — 已修复：测试改为单次 render
- [x] [Review][Patch] `aria-hidden="true"` 选择器与 `CollapsibleSection` 折叠箭头冲突 — 已修复：单次 render，isEmpty=true 时箭头不渲染，无冲突

> **第二轮（2026-03-30）新发现 — 已全部关闭（2026-03-30）：**
- [x] [Review][Decision] AC1 指定"编辑按钮"替代入口 — AC1 使用"或"字，click-on-area 已满足验收条件；Dev Notes 伪代码和 Task 1.2 均未要求独立按钮；决策：不增加独立"编辑"按钮，click-on-area 为 AC1 充分实现 [content-package.tsx]
- [x] [Review][Patch] `textarea value` null 检查 — 实现已正确使用 `editedBody !== null ? editedBody : body`（line 117 和 line 123），`rows` 计算同样使用 null 检查，无 `||` 问题 [content-package.tsx:117,123] ✅ Already Fixed
- [x] [Review][Patch] 可点击 `div` 键盘可访问性 — 实现已包含 `role={body ? 'button' : undefined}`、`tabIndex={body ? 0 : undefined}`、`onKeyDown` Enter/Space 触发编辑 [content-package.tsx:130-132] ✅ Already Fixed
- [x] [Review][Defer] 两个 `useEffect` 依赖相同 `[body]`，可合并为一个 effect [content-package.tsx:41-57] — deferred, code quality, non-blocking
- [x] [Review][Defer] 快速双击"有帮助"无防抖，可能重复提交 feedback [content-package.tsx] — deferred, 4b-4 scope
- [x] [Review][Defer] 评论框 `textarea` 无 `maxLength` 约束，大文本可直接提交 [content-package.tsx] — deferred, 4b-4 scope
- [x] [Review][Defer] `CollapsibleSection` 无 TypeScript 类型注解 [content-package.tsx:~270] — deferred, pre-existing internal function

> **第三轮（2026-03-30）代码审查 findings：**
- [x] [Review][Patch] Space/Enter `onKeyDown` 缺少 `e.preventDefault()`，按 Space 同时触发页面滚动 [content-package.tsx:132] — 已修复
- [x] [Review][Patch] `textarea value`/`rows` 冗余三元表达式，应直接复用 `displayText` [content-package.tsx:117,123] — 已修复
- [x] [Review][Patch] Enter 键触发编辑缺少 `e.isComposing` 检查，中文 IME 确认候选词时可能误进入编辑 [content-package.tsx:132] — 已修复
- [x] [Review][Patch] display div (`role="button"`) 缺少 `aria-label`，屏幕阅读器无法描述用途 [content-package.tsx:128] — 已修复
- [x] [Review][Defer] "有帮助"按钮已提交后仍可重复点击 [content-package.tsx] — deferred, 4b-4 scope
- [x] [Review][Defer] API 失败静默吞错无用户感知 [content-package.tsx] — deferred, 4b-4 scope
- [x] [Review][Defer] streaming 末尾帧竞态（理论性 React 并发问题）— deferred, theoretical
- [x] [Review][Defer] body→"" 时 editedBody 静默丢失 — deferred, design decision beyond scope
- [x] [Review][Defer] editedBody="" 时 CopyButton 复制空字符串 — deferred, aligns with null-sentinel design
- [x] [Review][Defer] `rows` 计算对长单行/CRLF 体验差 [content-package.tsx:123] — deferred, cosmetic

> **原有遗留 Defer 项（继续保留）：**
- [x] [Review][Defer] 空字符串 `tags`/`titles` 元素渲染空白 pill 和空行 [content-package.tsx:86-101] — deferred, pre-existing
- [x] [Review][Defer] 纯空白 `hook`（如 `" "`）通过 `isEmpty` 检测并渲染空段落 [content-package.tsx:110-113] — deferred, pre-existing
- [x] [Review][Defer] `CollapsibleSection` button `disabled` 与 `onClick=undefined` 逻辑冗余 [content-package.tsx:135-137] — deferred, pre-existing（4b-2 已记录）
- [x] [Review][Defer] `key={i}` 数组索引作为列表 key [content-package.tsx:72,94] — deferred, pre-existing（4b-1/4b-2 已记录）
- [x] [Review][Defer] `isEmpty=true` 时 `button` 无 `aria-busy="true"` 提示屏幕阅读器内容生成中 [content-package.tsx:146] — deferred, pre-existing
- [x] [Review][Defer] `CollapsibleSection` button 缺少 `aria-expanded` 属性 [content-package.tsx:135] — deferred, pre-existing
- [x] [Review][Defer] `CollapsibleSection` `isOpen` 状态在 `isEmpty` 反转（如二次生成内容重置）后不自动归零 [content-package.tsx:165] — deferred, pre-existing
- [x] [Review][Defer] 测试中 `getAllByText('生成中...')` 硬编码 `.toHaveLength(3/2)`，新增区域时批量失败 [content-package.test.tsx:18,42,73] — deferred, pre-existing
