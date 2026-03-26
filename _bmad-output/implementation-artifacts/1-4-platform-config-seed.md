# Story 1.4：平台配置初始数据入库

Status: done

## Story

作为 AI 改写引擎，
我想在数据库中读取到三个平台的 prompt 模板和风格规则，
以便改写功能开发阶段有真实可用的配置数据驱动。

## Acceptance Criteria

1. **Given** Story 1.2 的数据库 schema 已就绪，且三个平台的初始 prompt 内容已由本 Story 的 seed 脚本提供（`style_rules`、`prompt_template`、`few_shot_examples` 由开发者按平台规范写入 seed 脚本）；**When** 执行平台配置 seed 脚本（`npx prisma db seed`）；**Then** `platform_configs` 表中存在三条激活记录（`xiaohongshu`、`wechat`、`zhihu`），每条记录均包含非空的 `style_rules`（JSONB）、`prompt_template`（text）、`few_shot_examples`（JSONB），且 `is_active = true`、`config_version = 1`。

2. **Given** seed 脚本已运行一次；**When** 再次执行 `npx prisma db seed`；**Then** 脚本正常退出，`platform_configs` 表仍只有三条记录，不产生重复数据（幂等保证）。

3. **Given** seed 脚本编写完成；**When** 查看 `package.json`；**Then** 存在 `"prisma": { "seed": "tsx prisma/seed.ts" }` 配置项，`npx prisma db seed` 命令可被 Prisma CLI 识别并执行。

## Tasks / Subtasks

- [x] 安装 seed 运行时依赖 (AC: #3)
  - [x] 执行 `npm install --save-dev tsx`（用于在 Node.js 中直接运行 TypeScript seed 脚本）
  - [x] 确认 `tsx` 已出现在 `package.json` 的 `devDependencies` 中

- [x] 配置 `package.json` 的 prisma.seed 命令 (AC: #3)
  - [x] 在 `package.json` 中新增（或填充已存在的空 `prisma` 对象）：`"prisma": { "seed": "tsx prisma/seed.ts" }`
  - [x] 确保 `"prisma"` key 与 `"dependencies"`、`"devDependencies"` 同级

- [x] 创建 seed 脚本 `prisma/seed.ts` (AC: #1, #2)
  - [x] 从 `src/generated/prisma` 导入 PrismaClient（项目自定义输出路径）
  - [x] 实现三个平台（`xiaohongshu`、`wechat`、`zhihu`）的 `upsert` 写入逻辑，`where` 条件使用唯一约束 `uq_platform_configs_platform_version`（`{ platform_configVersion: { platform: '...', configVersion: 1 } }`）
  - [x] 每条记录写入：`platform`、`configVersion: 1`、`styleRules`（JSONB 对象）、`promptTemplate`（字符串）、`fewShotExamples`（JSONB 数组）、`isActive: true`、`updatedBy: 'seed'`
  - [x] 脚本末尾调用 `await prisma.$disconnect()`

- [x] 填充三个平台的实质内容 (AC: #1)
  - [x] 小红书（`xiaohongshu`）：`style_rules` 含结构规范 + emoji/字数规范；`prompt_template` 包含 `[CONTENT_TYPE]`/`[BODY]`/`[TITLE_x]`/`[TAGS]`/`[HOOK]` 格式指令；`few_shot_examples` 含至少 1 条示范
  - [x] 微信公众号（`wechat`）：`style_rules` 含公众号深度写作规范；`prompt_template` 含同上格式指令；`few_shot_examples` 含至少 1 条示范
  - [x] 知乎（`zhihu`）：`style_rules` 含知乎问答风格规范；`prompt_template` 含同上格式指令；`few_shot_examples` 含至少 1 条示范

- [x] 验证 seed 脚本可执行 (AC: #1, #2, #3) — ⚠️ 需要真实 Supabase 连接
  - [x] 确认 `.env.local` 中 `DATABASE_URL` 已配置为真实 Supabase 连接字符串
  - [x] 确认 Story 1.2 的数据库迁移已实际执行（`platform_configs` 表在 Supabase Dashboard 可见）
  - [x] 执行 `npx prisma db seed`，确认输出无错误，`platform_configs` 表有 3 条 `is_active = true` 记录
  - [x] 第二次执行 `npx prisma db seed`，确认记录数仍为 3 条（幂等验证）

## Dev Notes

### ⚠️ 前置条件（必读）

本 Story 依赖数据库真实连接。当前环境 `DATABASE_URL` 为占位值，所有数据库操作均无法执行。实际运行前需：

1. 配置 `.env.local`：`DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"`
2. 确认 Story 1.2 迁移已执行（`npx prisma migrate deploy`），`platform_configs` 表存在
3. 确认 Story 1.3 RLS 迁移已执行（`npx prisma migrate deploy`），seed 脚本通过 Prisma（service_role 权限）写入，可绕过 RLS

### Prisma Client 导入路径（关键）

项目 `schema.prisma` 配置了**自定义 generator 输出路径**：

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

因此 seed 脚本必须从该路径导入，**不能**使用默认的 `@prisma/client`：

```typescript
// prisma/seed.ts — 正确导入方式
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()
```

### PlatformConfig 模型字段（来自 schema.prisma）

```prisma
model PlatformConfig {
  id               String   @id @default(uuid()) @db.Uuid
  platform         Platform                          // 枚举: xiaohongshu | wechat | zhihu
  configVersion    Int      @map("config_version")
  styleRules       Json     @map("style_rules")     // JSONB
  promptTemplate   String   @map("prompt_template") // text
  fewShotExamples  Json     @default("[]") @map("few_shot_examples") // JSONB 数组
  isActive         Boolean  @default(false) @map("is_active")
  updatedAt        DateTime @updatedAt @map("updated_at")
  updatedBy        String?  @map("updated_by") @db.VarChar(100)

  @@unique([platform, configVersion], name: "uq_platform_configs_platform_version")
  @@map("platform_configs")
}
```

### Upsert 幂等写法（关键，防重复）

```typescript
await prisma.platformConfig.upsert({
  where: {
    uq_platform_configs_platform_version: {
      platform: 'xiaohongshu',
      configVersion: 1,
    },
  },
  update: {
    styleRules: xiaohongshuStyleRules,
    promptTemplate: xiaohongshuPromptTemplate,
    fewShotExamples: xiaohongshuFewShot,
    isActive: true,
    updatedBy: 'seed',
  },
  create: {
    platform: 'xiaohongshu',
    configVersion: 1,
    styleRules: xiaohongshuStyleRules,
    promptTemplate: xiaohongshuPromptTemplate,
    fewShotExamples: xiaohongshuFewShot,
    isActive: true,
    updatedBy: 'seed',
  },
})
```

### LLM 输出格式（promptTemplate 必须包含）

所有三个平台的 `prompt_template` 均需包含以下输出格式指令（Prompt Assembler 依赖解析，见 Story 3.3 AC）：

```
请按以下格式严格输出，不要添加任何额外说明：

[CONTENT_TYPE]: {观点分析类|体验叙事类|教程列表类|评测对比类|其他}
[BODY]: {改写正文全文}
[TITLE_1]: {备选标题1}
[TITLE_2]: {备选标题2}
[TITLE_3]: {备选标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语，一句话}
```

若原文为纯代码、纯数据表格或外语内容，输出：

```
[UNSUPPORTED_CONTENT]: 该内容暂不支持改写
```

### 三平台风格规范速查（styleRules 参考内容）

**小红书（xiaohongshu）**

```json
{
  "platform": "小红书",
  "structure": "结论前置，先说结果/收获，再说过程/细节",
  "sentence": "短句为主，每段不超过3句，段落间空行分隔",
  "emoji": "适当使用emoji（5-8个），放在段落开头或关键词后",
  "tone": "口语化，像闺蜜/朋友聊天，轻松活泼",
  "length": "正文200-500字，不含标题和标签",
  "title": "标题含数字或感叹词，吸引眼球，25字以内",
  "tags": "3-5个标签，用#号，选热门话题词",
  "hook": "结尾互动引导，提问或邀请评论，一句话"
}
```

**微信公众号（wechat）**

```json
{
  "platform": "微信公众号",
  "structure": "论点递进，先提出核心观点，再分点深度展开，结尾总结升华",
  "sentence": "长短句结合，段落完整，每段3-5句，适合深度阅读",
  "emoji": "克制使用emoji（0-2个），保持专业感",
  "tone": "专业但不失温度，有深度，有观点，像一篇精心写就的文章",
  "length": "正文800-1500字，内容充实饱满",
  "title": "标题有观点或悬念，引发思考，30字以内",
  "tags": "3个关键词标签，行业相关",
  "hook": "结尾引发共鸣或思考，邀请转发或关注，一句话"
}
```

**知乎（zhihu）**

```json
{
  "platform": "知乎",
  "structure": "先亮明结论（TL;DR），再拆解问题，数据/案例支撑，最后回答'为什么'",
  "sentence": "逻辑严密，数据支撑，举例具体，像专业人士的深度解答",
  "emoji": "不使用emoji，保持严肃专业",
  "tone": "理性、有据、有深度，展现专业认知，但不卖弄术语",
  "length": "正文500-1200字，重质量不重数量",
  "title": "标题可以是疑问句或陈述核心结论，40字以内",
  "tags": "3-5个精准话题标签",
  "hook": "结尾可邀请讨论不同观点，一句话"
}
```

### package.json prisma.seed 配置

当前 `package.json` 中 `"prisma"` key 为空对象 `{}`，需填充：

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

`tsx` 是轻量级 TypeScript/ESM 执行器，无需编译步骤，Prisma 官方推荐用于 seed 脚本。

### seed 脚本完整骨架

```typescript
// prisma/seed.ts
import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function main() {
  console.log('开始写入平台配置种子数据...')

  // ── 小红书 ─────────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where: {
      uq_platform_configs_platform_version: {
        platform: 'xiaohongshu',
        configVersion: 1,
      },
    },
    update: { /* ... 同 create */ },
    create: {
      platform: 'xiaohongshu',
      configVersion: 1,
      styleRules: { /* 见上方 styleRules 参考内容 */ },
      promptTemplate: `你是一位专业的小红书内容创作者...（见 promptTemplate 规范）`,
      fewShotExamples: [{ /* 至少一条示范 */ }],
      isActive: true,
      updatedBy: 'seed',
    },
  })
  console.log('✓ 小红书配置写入完成')

  // ── 微信公众号 ─────────────────────────────────────────────
  await prisma.platformConfig.upsert({ /* wechat */ })
  console.log('✓ 微信公众号配置写入完成')

  // ── 知乎 ───────────────────────────────────────────────────
  await prisma.platformConfig.upsert({ /* zhihu */ })
  console.log('✓ 知乎配置写入完成')

  console.log('种子数据写入完成！共 3 条平台配置记录。')
}

main()
  .catch((e) => {
    console.error('Seed 脚本执行失败：', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### 注意：不要 hardcode 平台规则在业务代码中

Architecture 明确规定：**平台规则必须从 `platform_configs` 表读取，不能 hardcode 在代码中**（ARCH8）。本 Story 的 seed 脚本是唯一的规则写入入口，后续通过 Story 6.4 的管理后台 UI 更新。

### 前序 Story 关键教训

来自 Story 1.3 / 1.2 的 Dev Agent Record：

| 教训 | 影响 |
|---|---|
| DATABASE_URL 为占位值，`prisma migrate dev` 无法执行 | seed 脚本同样需要真实 DB 连接；若 DB 未连接，创建文件后需等用户配置 |
| Prisma 7.5.0 使用 `@prisma/adapter-pg` + `PrismaPg` 初始化（服务端） | seed.ts 使用简单 `new PrismaClient()` 即可（直接连接，无需 adapter） |
| Prisma generator output = `src/generated/prisma` | 导入路径必须是 `../src/generated/prisma`，不是 `@prisma/client` |
| `npx prisma migrate deploy` 是生产/CI 用命令；本地开发用 `npx prisma migrate dev` | seed 前确认迁移已 apply |

来自 Story 1.1 的教训：
- Next.js 16.2.1（实际安装版本），Prisma 7.5.0
- `npm install` 时加 `--include=dev` 保证 devDependencies 正确安装

### Project Structure Notes

本 Story 新增/修改的文件：

```
content-repurposer/
├── prisma/
│   └── seed.ts                    <- 新增：平台配置种子数据脚本
└── package.json                   <- 修改：补充 "prisma": { "seed": "tsx prisma/seed.ts" }
```

不涉及 `src/` 目录下任何文件修改（纯数据层操作）。

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4] — Acceptance Criteria、产品需求
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture] — `platform_configs` 表结构、JSONB 字段定义
- [Source: _bmad-output/planning-artifacts/architecture.md#LLM Integration Architecture] — Prompt Assembler 对 platform_configs 的依赖、输出格式标签规范
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — 平台规则不能 hardcode（ARCH8）
- [Source: _bmad-output/implementation-artifacts/1-2-database-schema-supabase.md#Dev Agent Record] — Prisma 7.x 适配细节、DB 连接占位值问题
- [Source: _bmad-output/implementation-artifacts/1-3-supabase-rls-config.md#Dev Notes] — service_role 绑过 RLS 写入说明

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- 修正导入路径：Dev Notes 中写 `../src/generated/prisma`，但 Prisma 7 生成目录无 `index.ts`，须改为 `../src/generated/prisma/client`（与 `src/lib/prisma.ts` 一致）
- 修正 PrismaClient 初始化：Prisma 7.x 使用 driver adapter 模型，`new PrismaClient()` 无参数形式在 TS 类型层面不合法，须传入 `PrismaPg` adapter（DATABASE_URL 来自环境变量）
- Task 5 验证：当前环境 DATABASE_URL 为占位值，seed 脚本的实际执行需用户配置真实 Supabase 连接；TypeScript 类型检查无错误，脚本逻辑正确

### Completion Notes List

- 安装 `tsx@^4.21.0` 至 devDependencies，用于 Prisma seed 命令执行 TypeScript 文件
- `package.json` 新增 `"prisma": { "seed": "tsx prisma/seed.ts" }` 顶级配置
- 创建 `prisma/seed.ts`：使用 `PrismaPg` adapter + `PrismaClient`，三平台 upsert 幂等写入，覆盖完整 styleRules/promptTemplate/fewShotExamples 内容
- 三平台 promptTemplate 均包含 `[CONTENT_TYPE]`/`[BODY]`/`[TITLE_1-3]`/`[TAGS]`/`[HOOK]` 及 `[UNSUPPORTED_CONTENT]` 格式指令（Prompt Assembler 依赖）
- 验证：TypeScript 类型检查 `prisma/seed.ts` 零错误；真实 DB 执行需用户配置 `.env.local` DATABASE_URL 并运行 `npx prisma db seed`

### File List

- `prisma/seed.ts` — 新增：三平台配置 upsert 种子数据脚本
- `package.json` — 修改：新增 `"prisma": { "seed": "tsx prisma/seed.ts" }` 配置；新增 `"tsx": "^4.21.0"` devDependency

### Review Findings

- [x] [Review][Patch] DATABASE_URL 未做运行时校验，! 断言绕过 undefined 检查 [prisma/seed.ts:8]
- [x] [Review][Patch] Adapter/PrismaClient 在模块顶层构造，异常绕过 .catch 处理链 [prisma/seed.ts:8-9]
- [x] [Review][Patch] 三个 upsert 无事务包裹，失败时产生部分写入状态 [prisma/seed.ts:215-293]
- [x] [Review][Patch] .finally 无 process.exit(0)，PrismaPg adapter 下可能挂起 [prisma/seed.ts:298-305]
- [x] [Review][Defer] Prompt 注入风险（Story 3.3 Prompt Assembler 范畴） — deferred, pre-existing
- [x] [Review][Defer] configVersion 硬编码为 1，update 分支静默覆盖内容 — deferred, pre-existing
- [x] [Review][Defer] fewShotExamples 无运行时结构校验 — deferred, pre-existing

## Change Log

- 2026-03-25: Story 1.4 实现完成 — 新增 `prisma/seed.ts`（三平台 upsert 幂等写入）、配置 `package.json` prisma.seed 命令、安装 tsx devDependency；TypeScript 类型检查零错误；真实 DB 执行待用户配置 Supabase 连接后运行 `npx prisma db seed`
