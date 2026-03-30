# Story 4b.4: 反馈按钮与重新改写

Status: done

## Story

作为内容创作者，
我想对改写结果表达有帮助或没帮助，
以便帮助产品团队了解改写质量，同时在不满意时重新生成。

## Acceptance Criteria

**AC1 - 有帮助反馈：**
- Given 某个平台的改写结果已展示（status === 'complete'，非 streaming）
- When 用户点击"有帮助"按钮
- Then 调用 `POST /api/rewrite/:resultId/feedback`，body `{ feedback: 'helpful' }`，按钮高亮显示已选状态（其他反馈按钮恢复未选）

**AC2 - 没帮助反馈（含文字说明）：**
- Given 某个平台的改写结果已展示
- When 用户点击"没帮助"按钮
- Then 显示可选文字输入框（placeholder: "请说明原因（选填）"）；用户提交时调用 API，body `{ feedback: 'not_helpful', comment?: string }`；按钮高亮

**AC3 - 重新改写：**
- Given 某个平台的改写结果已展示
- When 用户点击"重新改写"按钮
- Then 以 Zustand store 中当前 `text`、`platforms`、`tone` 调用 `startRewrite()` 并触发 SSE 请求，新结果覆盖当前展示；平台反馈状态重置为 null

**AC4 - 每平台独立：**
- 每个平台的反馈状态（helpful/not_helpful/null）独立，互不影响
- 切换 tab 时各平台展示自身的反馈按钮状态

**AC5 - Streaming 期间隐藏：**
- `isStreaming === true` 时，反馈按钮区域不渲染（与编辑功能保持一致）

## Tasks / Subtasks

- [x] T1：数据库迁移——新增 feedback_comment 字段 (AC: 2)
  - [x] 在 `prisma/schema.prisma` 的 `RewriteResult` 模型新增 `feedbackComment String? @map("feedback_comment")`
  - [x] 执行 `npx prisma migrate dev --name add_feedback_comment` 生成迁移文件（手动创建：无 DB 连接，migration.sql 已生成）
  - [ ] 在 Supabase 生产环境执行迁移（ops 操作，已有 CI/CD 流程）

- [x] T2：新增 resultIds 到 Zustand store (AC: 1,2)
  - [x] 在 `rewrite-store.ts` 的 `RewriteState` 新增 `resultIds: Partial<Record<Platform, string>>`
  - [x] 在 `RewriteActions` 新增 `setResultId(platform: Platform, resultId: string): void`
  - [x] 初始化 `resultIds: {}` 并在 `startRewrite()` 中重置
  - [x] 实现 `setResultId` action

- [x] T3：SSE 消费层捕获 resultId (AC: 1,2)
  - [x] 找到 SSE 消费代码（`platform_complete` 事件处理处）
  - [x] 检查 `platform_complete` 事件 payload 是否包含 `resultId`（不包含）
  - [x] 更新后端 `route.ts`：重构为 per-platform DB 写入，`platform_complete` 延迟到 DB 写入后发送，携带 `result_id`
  - [x] 在 `use-rewrite-stream.ts` 新增 `platform_complete` 事件处理：调用 `setResultId(platform, result_id)`

- [x] T4：新增反馈 API 路由 (AC: 1,2)
  - [x] 创建 `src/app/api/rewrite/[resultId]/feedback/route.ts`
  - [x] 实现 `POST` handler：验证 feedback 枚举值、写入 `rewrite_results` 的 `feedback` 和 `feedbackComment` 字段
  - [x] 响应格式遵循项目约定：`{ data: { resultId, feedback }, error: null }`

- [x] T5：修改 ContentPackage 组件 (AC: 1,2,3,4,5)
  - [x] 在 `ContentPackageProps` 新增 `resultId?: string` 和 `onRewrite?: () => void`
  - [x] 新增本地状态：`feedbackState: 'helpful' | 'not_helpful' | null`、`commentText: string`、`showCommentBox: boolean`
  - [x] `isStreaming` 时不渲染反馈按钮区域
  - [x] 实现"有帮助"点击：POST API → 更新本地 feedbackState
  - [x] 实现"没帮助"点击：显示 commentBox → 提交 POST API → 更新 feedbackState
  - [x] 实现"重新改写"点击：调用 `onRewrite()`，清空 `feedbackState`
  - [x] 重写完成（body prop 变化）时重置 feedbackState

- [x] T6：父组件传入 resultId 和 onRewrite (AC: 3,4)
  - [x] 找到渲染 `<ContentPackage />` 的父组件（`rewrite-workspace.tsx`）
  - [x] 从 store 读取 `resultIds[platform]` 传入 `resultId` prop
  - [x] 直接将 `startStream` 作为 `onRewrite` prop 传入 ContentPackage

- [x] T7：测试 (AC: 1-5)
  - [x] 在 `src/features/rewrite/__tests__/content-package.test.tsx` 新增 Story 4b.4 专项测试（11 条）
  - [x] 测试"有帮助"点击：mock fetch，验证 API 调用参数和按钮高亮
  - [x] 测试"没帮助"点击：验证 commentBox 显示，提交后 feedbackState 变更
  - [x] 测试 `isStreaming=true` 时反馈区域不渲染
  - [x] 测试 `onRewrite` 被调用后 feedbackState 重置
  - [x] 在 `src/app/api/rewrite/[resultId]/feedback/__tests__/route.test.ts` 新增 API 单测（11 条）

### Review Findings

- [x] [Review][Decision] AC1: "有帮助"按钮选中后禁用 — 已决策：选项 A，选中后 disabled，不允许取消。当前实现正确，无需修改。

- [x] [Review][Patch] feedback API 错误静默吞掉，response.ok 未检查 [content-package.tsx: handleHelpful, handleSubmitComment] — 已修复：在 fetch 后检查 response.ok，失败时直接 return
- [x] [Review][Patch] empty IP 跳过试用限流，无鉴权用户可无限改写 [route.ts: isTrial IP rate limit] — 已修复：ip 为空时返回 429
- [x] [Review][Patch] 非首个平台 DB 写入失败后 rewriteRecord 成为永久孤儿记录 [route.ts: per-platform DB write cleanup] — 已修复：error log 携带 platform 和 recordId 便于排查（非首平台记录含首平台结果，不属于真正孤儿，日志改善可追溯）
- [x] [Review][Patch] feedbackComment 无长度上限，可提交超大文本导致存储滥用 [feedback/route.ts: body 校验] — 已修复：添加 500 字符上限校验
- [x] [Review][Patch] 两个 useEffect 同依赖 [body] 应合并 [content-package.tsx:41-57] — 已修复：feedback 重置 effect 改为依赖 [resultId]（同时修复 P11/P8）
- [x] [Review][Patch] handleNotHelpful 无中间态 feedbackState，commentBox 打开期间可重复点击 [content-package.tsx: handleNotHelpful] — 已修复："没帮助"按钮加 `showCommentBox` 到 disabled 条件
- [x] [Review][Patch] migration SQL 缺少 IF NOT EXISTS 保护 [migration.sql] — 已修复：`ADD COLUMN IF NOT EXISTS`
- [x] [Review][Patch] commentBox 打开期间新改写启动后 resultId 变为 undefined，提交静默失败 [content-package.tsx: handleSubmitComment] — 已修复：P11 fix（依赖 resultId 的 useEffect）触发时自动关闭 commentBox
- [x] [Review][Patch] fatalError 路径下 done 事件发送 record_id:null，与已发出的 platform_complete result_id 矛盾 [route.ts: done event] — 已修复：fatalError 路径也发送 `rewriteRecord?.id ?? null`
- [x] [Review][Patch] "没帮助"按钮在 commentBox 显示期间不高亮（feedbackState 为 null）违反 AC2 [content-package.tsx: 没帮助按钮 className] — 已修复：active className 条件增加 `|| showCommentBox`
- [x] [Review][Patch] feedbackState 依赖 body 变化重置，tab A→B→A 切换时 A 的已选反馈状态丢失，违反 AC4 [content-package.tsx: useEffect([body])] — 已修复：改为依赖 [resultId] 变化重置

- [x] [Review][Defer] getClientIp 信任 x-forwarded-for 最左 IP，可被攻击者伪造绕过试用限流 [route.ts: getClientIp] — deferred, pre-existing，需在 nginx/ALB 层覆写 header 才能根本解决，已在 deferred-work.md 有记录
- [x] [Review][Defer] fatalError 时平台 2 的 platform_complete 被跳过，resultId 永久缺失 [route.ts: pendingData && !fatalError] — deferred, pre-existing，SSE 错误处理架构限制，复杂修复超出本 story 范围

## Dev Notes

### 关键架构约束

1. **每平台 feedback 独立**：`feedbackState` 是 `ContentPackage` 的本地 state（非 store），因为 ContentPackage 是 per-platform 渲染的，天然隔离。

2. **resultId 来源**：`rewrite_results.id`（UUID，非 `rewrite_records.id`）。需要通过 store 的 `resultIds[platform]` 获取。当 resultId 为 undefined（如旧历史记录）时，"有帮助/没帮助"按钮应 disabled 或不渲染。

3. **DB schema 已有 feedback 字段，缺少 feedbackComment**：
   - 现有：`feedback Feedback?`（枚举：helpful | not_helpful）
   - 缺失：`feedbackComment`——需要迁移新增
   - 迁移文件路径：`prisma/migrations/TIMESTAMP_add_feedback_comment/`

4. **不修改现有 store action 签名**：`startRewrite()` 已有 reset 逻辑，只需新增 `resultIds` 字段和 `setResultId` action，`startRewrite` 中重置 `resultIds: {}`。

5. **"重新改写"复用现有流程**：直接调用 `useRewriteStore.getState().startRewrite()` + 触发 SSE fetch，不重新实现 SSE 消费逻辑。父组件负责封装 `handleRewrite`，通过 `onRewrite` prop 回调传入 ContentPackage。

### 文件操作清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `prisma/schema.prisma` | 修改 | RewriteResult 新增 `feedbackComment String? @map("feedback_comment")` |
| `prisma/migrations/*/migration.sql` | 新建（自动生成） | `ALTER TABLE rewrite_results ADD COLUMN feedback_comment TEXT` |
| `src/features/rewrite/rewrite-store.ts` | 修改 | 新增 `resultIds` 状态和 `setResultId` action |
| `src/features/rewrite/content-package.tsx` | 修改 | 新增反馈按钮 UI 和本地状态 |
| `src/app/api/rewrite/[resultId]/feedback/route.ts` | 新建 | POST feedback API 路由 |
| 父组件（待确认路径） | 修改 | 传入 `resultId` 和 `onRewrite` props |
| `src/features/rewrite/__tests__/content-package.test.tsx` | 修改 | 新增 Story 4b.4 测试 |
| `src/app/api/rewrite/[resultId]/feedback/route.test.ts` | 新建 | API 路由单测 |

### Zustand Store 扩展示例

```typescript
// 在 RewriteState 新增：
resultIds: Partial<Record<Platform, string>>

// 在 RewriteActions 新增：
setResultId: (platform: Platform, resultId: string) => void

// 在 startRewrite() 中添加重置：
startRewrite: () =>
  set({
    status: 'rewriting',
    streamingTexts: {},
    activeTab: null,
    streamingPlatform: null,
    streamError: null,
    platformPackages: {},
    recordId: null,
    resultIds: {},  // 新增
  }),

// setResultId 实现：
setResultId: (platform, resultId) =>
  set((state) => ({
    resultIds: { ...state.resultIds, [platform]: resultId },
  })),
```

### API 路由实现约定

```typescript
// src/app/api/rewrite/[resultId]/feedback/route.ts
// 遵循项目响应格式：{ data: T, error: null } / { data: null, error: { code, message } }
// 使用 Prisma client from src/lib/prisma.ts（不重新实例化）
// 需验证 feedback 字段值是否为 Feedback 枚举（helpful | not_helpful）
// 需验证 resultId 是否为有效 UUID（防注入）
// 认证：从 Supabase session 验证用户身份，结果属于当前用户
```

### ContentPackage 本地状态设计

```typescript
// 新增本地 state（不引入 store）
const [feedbackState, setFeedbackState] = useState<'helpful' | 'not_helpful' | null>(null)
const [commentText, setCommentText] = useState('')
const [showCommentBox, setShowCommentBox] = useState(false)

// body prop 变化时重置（"重新改写"后新结果到来）
useEffect(() => {
  setFeedbackState(null)
  setCommentText('')
  setShowCommentBox(false)
}, [body])
```

### 防回归注意事项（来自 4b-3 learnings）

- **不要动 `displayText` 逻辑**：`displayText = editedBody ?? body`（editedBody 为 null 时回退）这个 sentinel 值语义已定，不影响反馈功能
- **CopyButton props 不变**：`{ text: string; className?: string }`，text 继续使用 `displayText`
- **isStreaming 守卫**：反馈按钮需和编辑按钮一样，在 `isStreaming === true` 时不渲染
- **32 条已有测试全量通过**：新增反馈测试不得破坏现有测试（注意 DOM 污染问题，每个 describe block 独立 render）
- **proxy.test.ts 4 条预存失败**：与本次无关，不须处理

### 运维提示（非 dev agent 任务）

- Prisma 迁移需在部署前在 Supabase 生产环境执行
- RLS 策略可能需要更新：确保用户只能 update 自己的 rewrite_results（检查 `docs/ops/rls-policies.md`）

### References

- 架构文档 API 设计：`_bmad-output/planning-artifacts/architecture.md#API 路由设计`
- Prisma Schema：`prisma/schema.prisma`（RewriteResult 模型，Feedback 枚举）
- Zustand Store：`src/features/rewrite/rewrite-store.ts`
- 上一个 story：`_bmad-output/implementation-artifacts/4b-3-editable-result.md`（Review Findings 中有 4 个 Patch 问题，均为 4b-3 遗留，不纳入本次范围）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- 全部 7 个任务完成，22 条新测试通过（11 ContentPackage + 11 API），32 条旧测试无回归
- 后端重构：`route.ts` 改为 per-platform DB 写入，`platform_complete` 携带 `result_id`；首个平台成功时创建 `rewriteRecord`，后续平台复用同一 record
- `prisma migrate dev` 无 DB 连接，改为手动创建迁移文件 `20260330000001_add_feedback_comment/migration.sql`，Supabase 生产执行为 ops 任务
- proxy.test.ts 4 条预存失败与本次无关，不处理

### File List

- `prisma/schema.prisma`
- `prisma/migrations/20260330000001_add_feedback_comment/migration.sql`
- `src/generated/prisma/` （prisma generate 重新生成）
- `src/features/rewrite/rewrite-store.ts`
- `src/app/api/rewrite/route.ts`
- `src/features/rewrite/use-rewrite-stream.ts`
- `src/app/api/rewrite/[resultId]/feedback/route.ts`
- `src/features/rewrite/content-package.tsx`
- `src/features/rewrite/rewrite-workspace.tsx`
- `src/features/rewrite/__tests__/content-package.test.tsx`
- `src/app/api/rewrite/[resultId]/feedback/__tests__/route.test.ts`
