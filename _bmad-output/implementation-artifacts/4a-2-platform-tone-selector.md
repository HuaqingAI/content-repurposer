# Story 4a.2: 平台选择器与语气风格选择器

Status: done

## Story

作为内容创作者，
我想选择目标发布平台和语气风格，
以便改写结果符合我的具体需求。

## Acceptance Criteria

1. **Given** 用户在改写工作区看到平台选择区域，**When** 用户勾选平台选项，**Then** 可多选：小红书、微信公众号、知乎，至少选择 1 个，未选择时"开始改写"按钮禁用

2. **Given** 平台选择区域渲染完毕，**When** 用户看到语气风格选项，**Then** 显示三个选项（口语化 / 标准 / 正式），默认选中"标准"，单选

3. **Given** 用户已选择平台和语气，**When** 查看 UI，**Then** 已选平台和语气以视觉高亮方式清晰标示当前选择状态

## Tasks / Subtasks

- [x] **创建 PlatformSelector 客户端组件** (AC: #1, #3)
  - [x] 新建 `src/features/rewrite/platform-selector.tsx`（`'use client'`）
  - [x] 定义 `Platform` 类型：`'xiaohongshu' | 'wechat' | 'zhihu'`
  - [x] 实现受控接口：`props { value: Platform[]; onChange: (v: Platform[]) => void; disabled?: boolean }`
  - [x] 多选逻辑：点击已选平台则取消，点击未选平台则添加
  - [x] 视觉高亮：选中状态使用 `bg-accent-light border-accent text-accent`，未选中使用 `bg-surface-2 border-border-default text-text-secondary`
  - [x] 平台显示名：小红书、微信公众号、知乎

- [x] **创建 ToneSelector 客户端组件** (AC: #2, #3)
  - [x] 新建 `src/features/rewrite/tone-selector.tsx`（`'use client'`）
  - [x] 定义 `Tone` 类型：`'casual' | 'standard' | 'formal'`
  - [x] 实现受控接口：`props { value: Tone; onChange: (v: Tone) => void; disabled?: boolean }`
  - [x] 单选逻辑：点击选项更新选中值
  - [x] 视觉高亮：选中状态使用 `bg-accent-light border-accent text-accent`，未选中使用 `bg-surface-2 border-border-default text-text-secondary`
  - [x] 语气显示名与描述：口语化 / 标准 / 正式

- [x] **更新 `/app` 页面集成新组件** (AC: #1, #2, #3)
  - [x] 修改 `src/app/app/page.tsx`，引入 `PlatformSelector` 和 `ToneSelector`
  - [x] 用 `useState` 管理 `platforms: Platform[]`（初始值 `[]`）和 `tone: Tone`（初始值 `'standard'`）
  - [x] "开始改写"按钮禁用条件：`!isValid || platforms.length === 0`

- [x] **编写组件测试** (AC: #1, #2, #3)
  - [x] 新建 `src/features/rewrite/__tests__/platform-selector.test.tsx`
  - [x] 测试：初始渲染，三个平台选项均可见
  - [x] 测试：点击平台添加到选中集合
  - [x] 测试：再次点击已选平台从集合移除
  - [x] 测试：disabled 时点击不触发 onChange
  - [x] 新建 `src/features/rewrite/__tests__/tone-selector.test.tsx`
  - [x] 测试：渲染三个语气选项
  - [x] 测试：点击语气选项触发 onChange
  - [x] 测试：disabled 时不可交互

## Dev Notes

### ⚠️ 前置人工操作清单

| 前置项 | 说明 | 状态 |
|---|---|---|
| 无人工操作 | 本 Story 全部为代码实现，无需外部配置 | 自动 |

### 关键架构约束（必须遵守）

**目录规范（沿用 Epic 4a 前端模块）：**
- 新文件在 `src/features/rewrite/` 中
- 文件名：`kebab-case`，组件名：`PascalCase`
- 测试文件：`src/features/rewrite/__tests__/*.test.tsx`

**UI 组件限制（重要）：**
- `shadcn/ui` 未安装，所有 UI **必须用纯 Tailwind CSS 4.x 实现**
- 自定义颜色已在 `src/app/globals.css` 的 `@theme inline` 块中定义（Story 4a.1 完成）

**受控组件设计原则：**
```typescript
// platform-selector.tsx - 只负责 UI，不持有业务状态
type Platform = 'xiaohongshu' | 'wechat' | 'zhihu'
interface PlatformSelectorProps {
  value: Platform[]
  onChange: (platforms: Platform[]) => void
  disabled?: boolean
}

// tone-selector.tsx - 只负责 UI，不持有业务状态
type Tone = 'casual' | 'standard' | 'formal'
interface ToneSelectorProps {
  value: Tone
  onChange: (tone: Tone) => void
  disabled?: boolean
}
```

### 设计规格

**平台选择器：**
- 三个平台并排展示（flex row，wrap 支持小屏）
- 每个平台：圆角按钮，内含图标或平台名
- 选中：`bg-accent-light border-accent text-accent font-medium`
- 未选中：`bg-surface-2 border-border-default text-text-secondary hover:border-border-focus`
- 支持多选（toggle 行为）

**语气风格选择器：**
- 三个选项并排展示
- 单选（RadioGroup 语义，但用按钮实现）
- 选中：`bg-accent-light border-accent text-accent font-medium`
- 未选中：`bg-surface-2 border-border-default text-text-secondary hover:border-border-focus`

**平台名称映射：**
```typescript
const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

const TONE_LABELS: Record<Tone, string> = {
  casual: '口语化',
  standard: '标准',
  formal: '正式',
}
```

### 组件实现示例

```tsx
// src/features/rewrite/platform-selector.tsx
'use client'

type Platform = 'xiaohongshu' | 'wechat' | 'zhihu'

const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}

const PLATFORMS: Platform[] = ['xiaohongshu', 'wechat', 'zhihu']

interface PlatformSelectorProps {
  value: Platform[]
  onChange: (platforms: Platform[]) => void
  disabled?: boolean
}

export type { Platform }

export function PlatformSelector({ value, onChange, disabled = false }: PlatformSelectorProps) {
  const toggle = (platform: Platform) => {
    if (disabled) return
    if (value.includes(platform)) {
      onChange(value.filter(p => p !== platform))
    } else {
      onChange([...value, platform])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">目标平台</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="目标平台选择">
        {PLATFORMS.map(platform => {
          const isSelected = value.includes(platform)
          return (
            <button
              key={platform}
              type="button"
              onClick={() => toggle(platform)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={[
                'px-4 py-2 rounded-lg border text-sm transition-colors duration-150',
                isSelected
                  ? 'bg-accent-light border-accent text-accent font-medium'
                  : 'bg-surface-2 border-border-default text-text-secondary hover:border-border-focus',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

```tsx
// src/features/rewrite/tone-selector.tsx
'use client'

type Tone = 'casual' | 'standard' | 'formal'

const TONE_LABELS: Record<Tone, string> = {
  casual: '口语化',
  standard: '标准',
  formal: '正式',
}

const TONES: Tone[] = ['casual', 'standard', 'formal']

interface ToneSelectorProps {
  value: Tone
  onChange: (tone: Tone) => void
  disabled?: boolean
}

export type { Tone }

export function ToneSelector({ value, onChange, disabled = false }: ToneSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">语气风格</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="语气风格选择">
        {TONES.map(tone => {
          const isSelected = value === tone
          return (
            <button
              key={tone}
              type="button"
              onClick={() => { if (!disabled) onChange(tone) }}
              disabled={disabled}
              role="radio"
              aria-checked={isSelected}
              className={[
                'px-4 py-2 rounded-lg border text-sm transition-colors duration-150',
                isSelected
                  ? 'bg-accent-light border-accent text-accent font-medium'
                  : 'bg-surface-2 border-border-default text-text-secondary hover:border-border-focus',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {TONE_LABELS[tone]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

### Next.js 16.2.1 / Tailwind 4.x 注意事项

- `'use client'` 指令在文件第一行（import 之前）
- 所有品牌色 token 已在 `globals.css` 定义，直接用 Tailwind class 即可（`bg-accent-light`、`border-accent` 等）
- 测试框架：Jest + @testing-library/react（同 Story 4a.1）

### 已存在文件（禁止重新创建）

| 文件 | 用途 | 说明 |
|---|---|---|
| `src/app/globals.css` | 全局样式 + Tailwind token | 已包含所有品牌色，**不需要修改** |
| `src/features/rewrite/text-input.tsx` | 原文输入组件 | Story 4a.1 产出，**不修改** |
| `src/features/rewrite/__tests__/text-input.test.tsx` | TextInput 测试 | Story 4a.1 产出，**不修改** |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4a.2] — AC 原文
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — 组件文件规划
- [Source: _bmad-output/implementation-artifacts/4a-1-original-text-input.md] — 相同模式参考

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- proxy.test.ts 中 4 个失败测试（HTTP 302 vs 307）为预存回归，与本 Story 无关（同 4a-1 记录）

### Completion Notes List

- ✅ AC#1：PlatformSelector 多选平台（小红书/微信公众号/知乎），未选时"开始改写"按钮禁用
- ✅ AC#2：ToneSelector 单选语气（口语化/标准/正式），默认"标准"，page.tsx 初始值 `'standard'`
- ✅ AC#3：选中状态 `bg-accent-light border-accent text-accent`，未选中状态 `bg-surface-2 border-border-default text-text-secondary`，视觉高亮清晰
- ✅ 受控组件设计：PlatformSelector/ToneSelector 均不持有业务状态，父组件 page.tsx 控制
- ✅ 无障碍：PlatformSelector 使用 `role="group"` + `aria-pressed`，ToneSelector 使用 `role="radiogroup"` + `aria-checked`
- ✅ 12 个单元测试全部通过（PlatformSelector 6 个，ToneSelector 6 个）
- ✅ 全量 114 个测试通过，无新增回归（proxy.test.ts 4 个预存失败）

### File List

- `src/features/rewrite/platform-selector.tsx` — 新建（PlatformSelector 组件）
- `src/features/rewrite/tone-selector.tsx` — 新建（ToneSelector 组件）
- `src/app/app/page.tsx` — 修改（集成 PlatformSelector + ToneSelector，更新按钮禁用逻辑）
- `src/features/rewrite/__tests__/platform-selector.test.tsx` — 新建（6 个单元测试）
- `src/features/rewrite/__tests__/tone-selector.test.tsx` — 新建（6 个单元测试）

### Review Findings

- [x] [Review][Decision] "开始改写"按钮无 onClick handler — 选 B：已加 `onClick={() => { /* TODO: Story 3.4a — 调用改写 API */ }}` `src/app/app/page.tsx`
- [x] [Review][Decision] PlatformSelector 允许反选全部平台，无 min-1 组件层守卫 — 选 B：`toggle` 中加 `if (value.length === 1) return` 守卫 `src/features/rewrite/platform-selector.tsx`
- [x] [Review][Patch] ToneSelector `role="radio"` 缺少 roving tabIndex 键盘导航 — 已添加 `tabIndex={isSelected ? 0 : -1}` 和 `onKeyDown` arrow-key 处理 `src/features/rewrite/tone-selector.tsx`
- [x] [Review][Patch] ToneSelector disabled guard 风格与 PlatformSelector 不一致 — 已提取具名 `select` 函数统一守卫逻辑 `src/features/rewrite/tone-selector.tsx`
- [x] [Review][Patch] `charCount` 无 `useMemo`，每次渲染重新展开 spread — 已改为 `useMemo(() => [...text].length, [text])` `src/app/app/page.tsx`
- [x] [Review][Defer] disabled 未从父组件传递给 PlatformSelector/ToneSelector [src/app/app/page.tsx] — deferred, pre-existing：提交态下子组件无法禁用交互，属改写 API 集成（Story 3.4a）范畴，非本 Story 功能
- [x] [Review][Defer] isTextValid 范围未向用户展示，按钮静默禁用无字符计数反馈 [src/app/app/page.tsx] — deferred, pre-existing：字符计数展示已由 TextInput (Story 4a.1) 或改写工作区状态（Story 4a.4）负责

## Change Log

| 日期 | 变更说明 | 操作人 |
|---|---|---|
| 2026-03-27 | Story 4a.2 创建：平台选择器与语气风格选择器 | create-story (inline) |
| 2026-03-27 | Story 4a.2 实现完成：PlatformSelector、ToneSelector、page.tsx 集成、12 个单元测试全通过 | dev-agent |
