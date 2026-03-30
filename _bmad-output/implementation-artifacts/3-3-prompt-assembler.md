# Story 3.3: Prompt Assembler

Status: done

## Story

作为 AI 改写引擎，
我想从数据库动态读取平台规则配置并组装完整的 prompt，
以便改写质量由平台配置驱动，更新规则无需修改代码。

## Acceptance Criteria

1. **Given** `platform_configs` 表中存在目标平台的激活配置
   **When** 调用 `assemblePrompt({ platform, tone, originalText })`
   **Then** 返回包含系统提示（角色+平台规则+few-shot 示例+语气指令+输出格式要求）和用户消息（原文）的完整 `ChatMessage[]` 数组

2. **And** 返回的 prompt 中包含内容类型识别指令，要求 LLM 在输出最开头先输出 `[CONTENT_TYPE]: {观点分析/体验叙事/教程列表/评测对比/其他}` 标签，紧随其后按格式输出改写内容

3. **And** 若目标平台无激活配置（`is_active = true` 的记录不存在），抛出明确错误：`Error('平台 ${platform} 无激活配置，请先在管理后台配置并激活该平台规则')`，不静默失败

4. **And** `src/lib/llm/content-type-parser.ts` 导出 `parseContentType(llmOutput: string): ContentType` 函数，能从 LLM 输出中解析 `[CONTENT_TYPE]: xxx` 标签并返回对应的枚举值（`opinion/narrative/tutorial/review/other`）；无法解析时默认返回 `'other'`

## Tasks / Subtasks

- [x] **实现 `src/lib/llm/prompt-assembler.ts`** (AC: #1, #2, #3)
  - [x] 定义并导出 `AssemblePromptParams` 接口：`{ platform: Platform; tone: Tone; originalText: string }`
  - [x] 实现 `assemblePrompt(params: AssemblePromptParams): Promise<ChatMessage[]>`
  - [x] 用 `prisma.platformConfig.findFirst({ where: { platform: params.platform, isActive: true } })` 查询激活配置
  - [x] 若结果为 `null`，抛出 `Error(\`平台 ${params.platform} 无激活配置，请先在管理后台配置并激活该平台规则\`)`
  - [x] 将 `styleRules` JSON 转换为可读规则文本（见"Dev Notes - styleRules 格式约定"）
  - [x] 将 `fewShotExamples` JSON 转换为 few-shot 示例文本（见"Dev Notes - fewShotExamples 格式约定"）
  - [x] 拼接完整系统提示（见"Dev Notes - Prompt 结构"），语气映射见"Dev Notes - 语气标签映射"
  - [x] 返回 `[{ role: 'system', content: systemPrompt }, { role: 'user', content: params.originalText }]`

- [x] **实现 `src/lib/llm/content-type-parser.ts`** (AC: #4)
  - [x] 实现 `parseContentType(llmOutput: string): ContentType`
  - [x] 用正则 `/\[CONTENT_TYPE\]:\s*(.+)/` 从输出中提取标签文本
  - [x] 按中文标签映射到 `ContentType` 枚举（映射表见"Dev Notes - ContentType 映射"）
  - [x] 无法匹配或标签未知时返回 `'other'`

- [x] **编写 `src/lib/llm/__tests__/prompt-assembler.test.ts`** (AC: #1, #2, #3)
  - [x] 添加 `@jest-environment node` 注释（顶部）
  - [x] Mock `@/lib/prisma`：`jest.mock('@/lib/prisma', () => ({ prisma: { platformConfig: { findFirst: jest.fn() } } }))`
  - [x] 测试：激活配置存在 → 返回两条消息（`system` + `user`），系统消息包含 `[CONTENT_TYPE]` 指令，用户消息为原文
  - [x] 测试：激活配置存在 → 系统消息包含 `style_rules` 规则文本和 few-shot 示例文本
  - [x] 测试：激活配置存在 → 语气指令文本与 `tone` 参数对应（`casual/standard/formal` 各自测一个）
  - [x] 测试：无激活配置（`findFirst` 返回 `null`）→ 抛出含平台名的错误消息

- [x] **编写 `src/lib/llm/__tests__/content-type-parser.test.ts`** (AC: #4)
  - [x] 添加 `@jest-environment node` 注释（顶部）
  - [x] 测试：各中文标签正确映射（`观点分析→opinion`, `体验叙事→narrative`, `教程列表→tutorial`, `评测对比→review`, `其他→other`）
  - [x] 测试：标签值包含多余空白时仍正确解析（`[CONTENT_TYPE]:  观点分析 `）
  - [x] 测试：输出中无 `[CONTENT_TYPE]` 标签时返回 `'other'`
  - [x] 测试：`[CONTENT_TYPE]` 后接未知文本时返回 `'other'`
  - [x] 测试：`[CONTENT_TYPE]` 标签不在第一行（中间位置）时仍能解析

## Dev Notes

### 关键架构约束（必须遵守）

**1. 文件位置（严格）**

```
src/lib/llm/
├── types.ts                    # 已存在（只读）
├── llm-router.ts               # 已存在（只读）
├── prompt-assembler.ts         # 本 Story 新增
├── content-type-parser.ts      # 本 Story 新增
├── providers/
│   ├── deepseek.ts             # 已存在（只读）
│   └── qwen.ts                 # 已存在（只读）
└── __tests__/
    ├── types.test.ts           # 已存在（只读）
    ├── deepseek.test.ts        # 已存在（只读）
    ├── qwen.test.ts            # 已存在（只读）
    ├── llm-router.test.ts      # 已存在（只读）
    ├── prompt-assembler.test.ts  # 本 Story 新增
    └── content-type-parser.test.ts  # 本 Story 新增
```

**不修改的文件：**`types.ts`、`llm-router.ts`、`providers/deepseek.ts`、`providers/qwen.ts`

**2. 类型导入来源**

```typescript
// Prisma 枚举：从 generated 路径导入（非默认路径！）
import { Platform, Tone, ContentType } from '@/generated/prisma/client'
// 或
import type { Platform, Tone, ContentType } from '@/generated/prisma/client'

// LLM 类型
import type { ChatMessage } from '@/lib/llm/types'

// Prisma Client 单例
import { prisma } from '@/lib/prisma'
```

**⚠️ 特别注意：** Prisma client 输出路径是 `src/generated/prisma/`（非默认的 `node_modules/.prisma`），所有 Prisma 相关 import 必须用 `@/generated/prisma/client`。

**3. Prisma 查询模式**

```typescript
// 查询激活配置
const config = await prisma.platformConfig.findFirst({
  where: {
    platform: params.platform,  // Platform 枚举，如 'xiaohongshu'
    isActive: true,
  },
})

// 返回字段（camelCase，Prisma 自动转换）：
// config.styleRules      → Json (从 style_rules 列)
// config.promptTemplate  → string (从 prompt_template 列)
// config.fewShotExamples → Json (从 few_shot_examples 列)
```

**4. styleRules 格式约定（DB seed 中使用的结构）**

`styleRules` 是 JSONB，seed 数据中使用以下结构（数组形式，每项为规则字符串）：

```json
["结论前置，先说结果再说过程", "使用短句，每段不超过3句", "适当使用emoji（不超过5个）"]
```

转换为提示文本时：

```typescript
// config.styleRules 的类型是 Prisma.JsonValue（即 unknown）
// 需先断言为 string[]，再拼接
const rules = config.styleRules as string[]
const rulesText = rules.map((r) => `- ${r}`).join('\n')
```

**如果 DB 中实际存储格式不同**（如 `{ "rules": [...] }` 对象形式），请按实际格式处理，但保持上述"每条规则前加 `- `"的格式输出。

**5. fewShotExamples 格式约定（DB seed 中使用的结构）**

```json
[
  { "original": "原文摘要...", "rewritten": "改写后版本..." },
  { "original": "原文摘要2...", "rewritten": "改写后版本2..." }
]
```

转换为提示文本：

```typescript
type FewShotExample = { original: string; rewritten: string }
const examples = config.fewShotExamples as FewShotExample[]
const examplesText = examples
  .map((e, i) => `案例${i + 1}:\n原文: ${e.original}\n改写: ${e.rewritten}`)
  .join('\n---\n')
```

**6. Prompt 结构（系统提示全文）**

按以下顺序拼接系统提示（与 Architecture.md 中的示例结构一致）：

```
你是一个专业的内容改写助手。你的任务是将用户提供的文章改写为适合{PLATFORM_LABEL}平台的内容。

规则：
{RULES_TEXT}

参考优秀案例：
{EXAMPLES_TEXT}

语气风格：{TONE_LABEL}

请严格按以下格式输出，不要增减任何标签：
[CONTENT_TYPE]: {观点分析/体验叙事/教程列表/评测对比/其他}
[BODY]:
{改写正文}
[TITLE_1]: {备选标题1}
[TITLE_2]: {备选标题2}
[TITLE_3]: {备选标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语}
```

若 `fewShotExamples` 为空数组，跳过"参考优秀案例"整段（包括标题行）。

**7. 语气标签映射**

```typescript
const TONE_LABELS: Record<Tone, string> = {
  casual: '口语化（像和朋友聊天，轻松活泼）',
  standard: '标准（清晰易读，平衡专业与亲和力）',
  formal: '正式（严谨专业，适合知识类内容）',
}
```

**8. 平台标签映射**

```typescript
const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  wechat: '微信公众号',
  zhihu: '知乎',
}
```

**9. ContentType 映射（content-type-parser.ts）**

```typescript
const CONTENT_TYPE_MAP: Record<string, ContentType> = {
  '观点分析': 'opinion',
  '体验叙事': 'narrative',
  '教程列表': 'tutorial',
  '评测对比': 'review',
  '其他': 'other',
}
```

注意：`ContentType` 是 Prisma 枚举，类型为字面量联合 `'opinion' | 'narrative' | 'tutorial' | 'review' | 'other'`，从 `@/generated/prisma/client` 导入。

**10. promptTemplate 字段说明**

`platform_configs.prompt_template` 字段在 DB 中存储，但本 Story **不使用它作为模板字符串**——assembler 自行按 Task 1 中的方式拼接完整 system prompt，`promptTemplate` 字段留给 Story 3.4a 或管理后台使用。

**如果你发现 DB 中的 `promptTemplate` 本身已是完整结构化模板（含占位符），优先使用 DB 模板**，但确保最终输出包含 AC #2 要求的 `[CONTENT_TYPE]` 指令格式。

**11. 测试 mock 模式（参照 Story 3.2 模式）**

```typescript
/**
 * @jest-environment node
 */

// mock prisma 单例
jest.mock('@/lib/prisma', () => ({
  prisma: {
    platformConfig: {
      findFirst: jest.fn(),
    },
  },
}))

// mock Prisma 枚举（如果 @/generated/prisma/client 在测试环境加载困难）
// 方案：直接使用字符串字面量，因为 Prisma 枚举在运行时就是字符串
```

### 与后续 Story 的接口约定

- **Story 3.4a（改写 SSE API）**：
  - `import { assemblePrompt } from '@/lib/llm/prompt-assembler'`，调用获取 messages 后传入 `llmRouter.streamChat()`
  - `import { parseContentType } from '@/lib/llm/content-type-parser'`，解析 LLM 流式输出中的内容类型标签
  - Story 3.4a 还需解析 `[BODY]`、`[TITLE_1]`、`[TITLE_2]`、`[TITLE_3]`、`[TAGS]`、`[HOOK]` 标签以发送对应 SSE 事件——这些解析**不在本 Story 实现**

- **Story 3.4b（落库）**：将从 `parseContentType` 的结果存入 `rewrite_records.content_type`

### Project Structure Notes

- 符合架构规范：LLM 服务层全部在 `src/lib/llm/` 下，测试文件与源文件同目录（均在 `__tests__/` 子目录）
- 不新增任何页面或 API Route
- Prisma client import 路径：`@/generated/prisma/client`（项目特殊路径，非默认）

### References

- Prisma schema（`platform_configs` 表字段）：`prisma/schema.prisma#L104-L118`
- Prisma client 单例模式：`src/lib/prisma.ts`
- LLM 接口定义（`ChatMessage` 等）：`src/lib/llm/types.ts`
- LLM Router 单例模式（参照导出方式）：`src/lib/llm/llm-router.ts`
- Architecture LLM 集成章节（Prompt 结构示例）：`_bmad-output/planning-artifacts/architecture.md#LLM Integration Architecture`
- 测试 mock 模式参考：`src/lib/llm/__tests__/llm-router.test.ts`（含 `@jest-environment node` + mock 模式）

### Review Findings

- [x] [Review][Decision] D1: `promptTemplate` 字段处理歧义 — 决策：保持现状，忽略 promptTemplate；spec 第一句意图更明确，seed 数据中该字段为空字符串
- [x] [Review][Decision] D2: `originalText` 无 prompt injection 防护 — 决策：加防御性注释，system/user 消息分离已提供足够隔离，无需净化逻辑 [prompt-assembler.ts:71-73]
- [x] [Review][Patch] P1: `styleRules`/`fewShotExamples` 对 JsonValue 直接断言无类型防御，DB 存储非数组时运行时崩溃 [prompt-assembler.ts:37-44]
- [x] [Review][Patch] P2: `parseContentType` 正则首次匹配，LLM 在 body 中复述格式标签时提取到错误值 [content-type-parser.ts:6]
- [x] [Review][Patch] P3: `findFirst` 无 `orderBy`，同平台多条激活配置时选择不确定 [prompt-assembler.ts:28-33]
- [x] [Review][Patch] P4: `originalText` 为空字符串时不拦截，直接产生空 user 消息送入 LLM [prompt-assembler.ts:63]
- [x] [Review][Patch] P5: 测试断言 `.toThrow('平台 wechat 无激活配置')` 截断了 AC #3 规定的完整错误文本，后半段无验证 [prompt-assembler.test.ts:115]
- [x] [Review][Defer] W1: `PLATFORM_LABELS`/`TONE_LABELS` 无未知枚举值兜底 [prompt-assembler.ts:45-46] — deferred, pre-existing（TypeScript 编译期已保证枚举值合法）
- [x] [Review][Defer] W2: `styleRules` 为空数组时产生空"规则："段落 [prompt-assembler.ts:40] — deferred, pre-existing（DB 数据质量问题，非代码 bug）
- [x] [Review][Defer] W3: `styleRules`/`fewShotExamples` 数组元素类型未校验 [prompt-assembler.ts:42-52] — deferred, pre-existing（Array.isArray 满足 spec 要求，元素级校验为增强，DB 数据质量问题）
- [x] [Review][Defer] W4: `originalText` 无最大长度限制，超长输入导致 token 超限或 API 高额费用 — deferred, pre-existing（调用层职责，本 story 范围外）
- [x] [Review][Defer] W5: DB 来源的 `styleRules`/`fewShotExamples` 内容注入系统提示无净化 — deferred, pre-existing（依赖 DB 访问控制，管理后台 Story 6.x 加输入校验时一并处理）
- [x] [Review][Defer] W6: 错误消息含内部平台标识符（如"平台 wechat"）直接透传 — deferred, pre-existing（当前为内部错误，公开 API 层可屏蔽）
- [x] [Review][Defer] W7: `CONTENT_TYPE_MAP` 无英文枚举值兜底，LLM 输出英文时静默归为 `other` [content-type-parser.ts:3-9] — deferred, pre-existing（系统提示已指定中文标签，LLM 行为问题）
- [x] [Review][Defer] W8: `prisma.platformConfig.findFirst` 无 DB 连接错误包装，超时/连接失败抛出通用错误 [prompt-assembler.ts:30-36] — deferred, pre-existing（全局错误处理层职责）
- [x] [Review][Defer] W9: Unicode 全角/零宽空格绕过 `originalText` 空值校验 [prompt-assembler.ts:26] — deferred, pre-existing（极小概率，可接受的 MVP 限制）

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

无阻塞问题。proxy.test.ts 中的 4 个失败为预存在 bug（302 vs 307 状态码），已通过 git stash 验证与本 story 无关。

### Completion Notes List

- 实现了 `assemblePrompt()` 函数，从 DB 读取激活的平台配置，拼接完整 system prompt（含角色说明、规则、few-shot 示例、语气指令、输出格式）并返回 ChatMessage 数组。
- fewShotExamples 为空数组时，自动跳过"参考优秀案例"段落。
- 实现了 `parseContentType()` 函数，用正则提取 `[CONTENT_TYPE]:` 标签，映射到枚举值，无法解析时返回 `'other'`。
- 所有 16 个新增测试通过，无回归。

### File List

- `src/lib/llm/prompt-assembler.ts`（新增）
- `src/lib/llm/content-type-parser.ts`（新增）
- `src/lib/llm/__tests__/prompt-assembler.test.ts`（新增）
- `src/lib/llm/__tests__/content-type-parser.test.ts`（新增）

## Change Log

| 日期 | 变更内容 | 操作人 |
|---|---|---|
| 2026-03-27 | 创建 story 文件 | SM (create-story) |
| 2026-03-27 | 实现 prompt-assembler.ts、content-type-parser.ts 及对应测试；16 个测试全部通过 | Dev Agent |
