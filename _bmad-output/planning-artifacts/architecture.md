---
status: 'complete'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - product-brief-content-repurposer.md
  - product-brief-content-repurposer-distillate.md
completedAt: '2026-03-24'
projectType: full_stack
primaryDomain: web_app
complexity: medium
---

# Architecture Decision Document - Content Repurposer（适文）

**Author:** dadong
**Date:** 2026-03-24

## Project Context Analysis

### Requirements Overview

基于 PRD v2，适文 MVP 的核心架构需求：

**功能需求摘要（31 条 FR）：**
- 文章输入（粘贴 + URL 提取 Best Effort）
- 内容类型自动识别（观点/叙事/教程/评测/其他）
- 3 个平台的语义级 AI 改写（小红书/公众号/知乎），串行生成
- 内容发布包输出（文案 + 3 标题 + 标签 + 引导语）
- 语气三档预设（口语化/标准/正式）
- 流式输出（逐字呈现）
- 改写反馈（有帮助/没帮助）
- 历史记录（保存/查看/复用）
- 用户认证（手机号 + 微信 OAuth）
- 管理后台（仪表盘/用户管理/规则配置）

**非功能需求摘要（13 条 NFR）：**
- 首 token < 2 秒，单平台完整改写 < 15 秒
- LCP < 2 秒（CDN 加速）
- 99.5% 可用性
- 单次改写 API 成本 < 0.3 元
- 支持 100 -> 10,000 并发扩展
- LLM 多提供商切换

### Technical Constraints & Dependencies

| 约束 | 影响 |
|---|---|
| 面向国内用户 | 必须部署在国内云，LLM 选国产模型（无翻墙依赖） |
| 免费优先策略 | API 成本控制是生存前提，单次 < 0.3 元 |
| 流式输出 | 前后端都需要支持 SSE streaming |
| URL 提取 Best Effort | 需要处理各平台反爬，允许优雅失败 |
| 平台规则与 AI 逻辑解耦 | 规则配置需要独立于 prompt 代码，支持热更新 |
| MVP 单人/小团队开发 | 技术栈必须简洁，避免过度工程 |

### Cross-Cutting Concerns Identified

- **成本监控：** 每次 LLM 调用需记录 token 消耗和成本
- **内容安全：** 改写内容不应包含违禁/敏感内容
- **错误恢复：** LLM 调用失败需优雅降级（重试 + 错误提示）
- **反滥用：** 异常高频调用需触发人机验证
- **日志追踪：** 每次改写的完整链路可追溯（调试 + 质量分析）

## Starter Template Evaluation

### Primary Technology Domain

**Full-Stack Web Application** -- 前后端一体，包含 LLM API 集成、流式输出、用户认证、数据持久化。

### Starter Options Considered

| 方案 | 优势 | 劣势 |
|---|---|---|
| **Next.js (App Router)** | SSR 利于 SEO、API Routes 实现后端、React 生态、全栈一体 | 服务端逻辑复杂时 API Routes 不如独立后端灵活 |
| React + Vite（前端）+ FastAPI（后端） | 前后端解耦、Python LLM 生态好 | 两个代码库、两套部署、MVP 阶段维护成本高 |
| React + Vite（前端）+ Express/Fastify（后端） | 全 JS 栈、灵活 | 两个代码库、要自己搭 SSR |

### Selected Starter: Next.js Full-Stack

```bash
npx create-next-app@latest content-repurposer --typescript --tailwind --eslint --app --src-dir
```

**选择理由：**
1. **MVP 效率最高：** 一个代码库搞定前端页面 + API 接口 + SSR，开发维护成本最低
2. **SEO 支持：** PRD 明确了内容 SEO 获客策略（"小红书文章怎么改成公众号"等长尾词），Next.js 的 SSR/SSG 天然支持
3. **流式输出原生支持：** Next.js API Routes 支持 `ReadableStream`，前端 React 消费流式数据成熟
4. **后续可拆：** 如果 API 层变复杂，可以把 API Routes 抽成独立微服务，前端不需要大改

**Starter 已决定的技术选型：**

| 维度 | 决策 | 版本 |
|---|---|---|
| 语言 | TypeScript | 5.x |
| 前端框架 | React + Next.js App Router | React 19 / Next.js 15 |
| 样式方案 | Tailwind CSS | 4.x |
| 构建工具 | Turbopack (Next.js 内置) | -- |
| 代码规范 | ESLint | 9.x |
| 项目结构 | `src/` 目录 + App Router 约定 | -- |

## Core Architectural Decisions

### Decision Priority Analysis

**Critical（阻塞实现）：**
- 数据库选型
- LLM 提供商与调用架构
- 认证方案
- 流式输出实现方式

**Important（塑造架构）：**
- 平台规则配置架构
- 内容类型识别策略
- prompt 组织方式
- 状态管理方案

**Deferred（Post-MVP）：**
- 缓存策略
- 消息队列
- 微服务拆分
- 浏览器插件架构

### Data Architecture

**数据库：PostgreSQL（通过 Supabase 托管）**

| 决策 | 选择 | 理由 |
|---|---|---|
| 数据库 | PostgreSQL 16 | 成熟可靠，JSON 支持好，Supabase 免费额度够 MVP |
| 托管方式 | Supabase | 自带 Auth + 实时订阅 + RESTful API + 管理面板，大幅减少后端开发量 |
| ORM | Prisma | 类型安全、迁移管理、与 TypeScript 深度集成 |
| 数据建模 | 关系型为主 + JSONB 灵活字段 | 用户/改写记录结构化，平台配置和 prompt 模板用 JSONB |

**核心数据模型：**

```
users
├── id (uuid, PK)
├── phone (varchar, unique, nullable)
├── wechat_openid (varchar, unique, nullable)
├── display_name (varchar)
├── created_at (timestamp)
└── updated_at (timestamp)

rewrite_records
├── id (uuid, PK)
├── user_id (uuid, FK -> users)
├── original_text (text)
├── original_url (varchar, nullable)
├── content_type (enum: opinion/narrative/tutorial/review/other)
├── created_at (timestamp)
└── metadata (jsonb) -- 存放字数统计等

rewrite_results
├── id (uuid, PK)
├── record_id (uuid, FK -> rewrite_records)
├── platform (enum: xiaohongshu/wechat/zhihu)
├── tone (enum: casual/standard/formal)
├── body (text) -- 改写文案
├── titles (jsonb) -- 3个备选标题数组
├── tags (jsonb) -- 推荐标签数组
├── hook (text) -- 互动引导语
├── api_model (varchar) -- 使用的LLM模型
├── api_tokens_used (integer)
├── api_cost_cents (integer) -- 成本(分)
├── api_duration_ms (integer)
├── created_at (timestamp)
└── feedback (enum: helpful/not_helpful/null)

platform_configs
├── id (uuid, PK)
├── platform (enum: xiaohongshu/wechat/zhihu)
├── config_version (integer)
├── style_rules (jsonb) -- 平台风格规则
├── prompt_template (text) -- prompt模板
├── few_shot_examples (jsonb) -- few-shot示例
├── is_active (boolean)
├── updated_at (timestamp)
└── updated_by (varchar)
```

### Authentication & Security

**认证：Supabase Auth**

| 决策 | 选择 | 理由 |
|---|---|---|
| 认证服务 | Supabase Auth | 开箱即用，支持手机号 OTP + OAuth，与数据库天然集成 |
| 手机号验证 | Supabase Auth Phone OTP（底层接短信服务商） | 无需自建短信发送逻辑 |
| 微信登录 | 自定义 OAuth Provider via Supabase | Supabase 支持自定义 OAuth，接入微信开放平台 |
| 会话管理 | Supabase Session（JWT） | 前端 SDK 自动管理刷新 |
| API 安全 | Row Level Security（RLS） | 数据库层面强制隔离，用户只能访问自己的数据 |

**安全策略：**
- 所有 API 通信走 HTTPS
- LLM API Key 仅存于服务端环境变量，前端不可见
- Supabase RLS 策略确保用户数据隔离
- API 端限流：每用户每分钟最多 5 次改写请求

### API & Communication Patterns

**改写核心流程 API：**

```
POST /api/rewrite
  Request:
    { text: string, url?: string, platforms: string[], tone: string }
  Response:
    SSE stream -> 逐字输出改写结果

GET /api/rewrite/history
  Response:
    { records: RewriteRecord[] }

GET /api/rewrite/:id
  Response:
    { record: RewriteRecord, results: RewriteResult[] }

POST /api/rewrite/:resultId/feedback
  Request:
    { feedback: 'helpful' | 'not_helpful', comment?: string }

POST /api/extract-url
  Request:
    { url: string }
  Response:
    { text: string, success: boolean, error?: string }
```

**流式输出协议：**

```
SSE Event Format:
  event: platform_start
  data: { platform: "xiaohongshu" }

  event: chunk
  data: { text: "改写内容片段..." }

  event: titles
  data: { titles: ["标题1", "标题2", "标题3"] }

  event: tags
  data: { tags: ["标签1", "标签2", "标签3"] }

  event: hook
  data: { hook: "互动引导语内容" }

  event: platform_complete
  data: { platform: "xiaohongshu", tokens_used: 1200, cost_cents: 8 }

  event: done
  data: { record_id: "uuid" }

  event: error
  data: { message: "错误描述", retryable: true }
```

**串行多平台生成：** 前端发起一次 SSE 请求，后端按平台顺序串行调用 LLM，每完成一个平台发送 `platform_complete` 事件，然后继续下一个平台。前端收到每个平台的 `platform_start` 时切换到对应 tab。

### Frontend Architecture

| 决策 | 选择 | 理由 |
|---|---|---|
| 状态管理 | Zustand | 轻量、无 boilerplate、适合中等复杂度 |
| UI 组件库 | shadcn/ui | 基于 Radix + Tailwind，可定制、不增加包体积 |
| 表单处理 | React Hook Form + Zod | 类型安全的表单验证 |
| SSE 客户端 | 原生 `fetch` + `ReadableStream` | 比 EventSource 更灵活，支持 POST 请求 |
| 路由 | Next.js App Router（文件系统路由） | 无需额外路由库 |

**页面结构：**
- `/` -- 落地页（SSR，SEO 优化）
- `/app` -- 主应用页面（改写工作区）
- `/app/history` -- 历史记录
- `/app/settings` -- 个人设置
- `/admin` -- 管理后台（独立布局）
- `/login` -- 登录/注册

### Infrastructure & Deployment

| 决策 | 选择 | 理由 |
|---|---|---|
| 云服务商 | 阿里云 | 国内访问最稳定，生态完整 |
| 部署方式 | Docker 容器 + 阿里云 ECS | 简单直接，MVP 阶段用单机 + Docker Compose |
| CDN | 阿里云 CDN | 静态资源和 SSR 页面加速 |
| 域名 & SSL | 阿里云域名 + 免费 SSL 证书 | 标配 |
| CI/CD | GitHub Actions -> 阿里云容器 | 代码推送自动部署 |
| 监控 | 阿里云 ARMS（应用监控）+ 自建简易仪表盘 | MVP 阶段够用 |
| 短信服务 | 阿里云 SMS | Supabase Auth Phone OTP 的底层短信通道 |

**部署架构（MVP）：**

```
用户浏览器
    │
    ▼
阿里云 CDN（静态资源 + 页面缓存）
    │
    ▼
阿里云 ECS（单机 Docker）
    ├── Next.js 应用（前端 SSR + API Routes）
    └── Nginx（反向代理 + HTTPS）
    │
    ├──▶ Supabase Cloud（PostgreSQL + Auth）
    ├──▶ DeepSeek API（主 LLM）
    └──▶ 通义千问 API（备选 LLM）
```

**扩展路径（Phase 2+）：**
- 单机 Docker -> 阿里云容器服务 ACK（Kubernetes）
- 添加 Redis 缓存层（热门改写结果缓存）
- API Routes 抽成独立后端服务（如果 API 复杂度增长）

### LLM Integration Architecture

**这是整个产品的核心架构，需要详细说明。**

```
┌─────────────────────────────────────────────┐
│               LLM Service Layer             │
│                                             │
│  ┌─────────────┐   ┌─────────────────────┐  │
│  │  LLM Router │──▶│  Provider Adapters  │  │
│  │             │   │  ├── DeepSeek       │  │
│  │  - 主/备切换 │   │  ├── 通义千问       │  │
│  │  - 重试逻辑  │   │  └── (未来扩展)    │  │
│  │  - 超时处理  │   └─────────────────────┘  │
│  └──────┬──────┘                             │
│         │                                    │
│  ┌──────▼──────┐   ┌─────────────────────┐  │
│  │ Prompt      │──▶│  Platform Configs   │  │
│  │ Assembler   │   │  (DB: JSONB)        │  │
│  │             │   │  ├── style_rules    │  │
│  │ - 内容类型   │   │  ├── prompt_template│  │
│  │ - 平台规则   │   │  ├── few_shot      │  │
│  │ - 语气风格   │   │  └── (热更新)      │  │
│  └──────┬──────┘   └─────────────────────┘  │
│         │                                    │
│  ┌──────▼──────┐                             │
│  │   Cost      │                             │
│  │   Tracker   │  记录每次调用的 token 和成本  │
│  └─────────────┘                             │
└─────────────────────────────────────────────┘
```

**LLM Router：**
- 默认使用 DeepSeek（成本最低，中文质量好）
- DeepSeek 调用失败或超时 -> 自动切换通义千问
- 单次超时阈值 30 秒
- 自动重试 1 次（不同提供商）

**Prompt Assembler：**
- 从数据库读取当前激活的 `platform_configs`（平台规则、prompt 模板、few-shot 示例）
- 组装最终 prompt：系统提示（角色+规则）+ 平台模板 + few-shot 示例 + 用户原文 + 语气指令
- 内容类型识别也在同一次 LLM 调用中完成（prompt 开头要求先输出内容类型标签，再输出改写结果）

**Prompt 结构示例（小红书 + 口语化）：**

```
System: 你是一个专业的内容改写助手。你的任务是将用户提供的文章改写为适合小红书平台的内容。

规则：
{从 platform_configs.style_rules 读取}
- 结论前置，先说结果再说过程
- 使用短句，每段不超过3句
- 适当使用emoji（不超过5个）
- 口语化表达，像和朋友聊天
- 字数控制在200-500字
...

参考优秀案例：
{从 platform_configs.few_shot_examples 读取}
---
案例1: [原文摘要] -> [小红书改写版本]
---

语气风格：口语化（像闺蜜聊天，轻松活泼）

请按以下格式输出：
[CONTENT_TYPE]: {观点分析/体验叙事/教程列表/评测对比/其他}
[BODY]:
{改写正文}
[TITLE_1]: {标题1}
[TITLE_2]: {标题2}
[TITLE_3]: {标题3}
[TAGS]: {标签1}, {标签2}, {标签3}
[HOOK]: {互动引导语}

用户原文：
{用户输入的文章全文}
```

**Cost Tracker：**
- 每次 LLM 调用记录：模型名称、input tokens、output tokens、计算成本（分）、耗时
- 写入 `rewrite_results` 表的对应字段
- 管理后台实时汇总展示

### Decision Impact Analysis

**实现顺序：**

```
1. 项目初始化（Next.js + Supabase + Prisma）
2. 数据库 schema + 迁移
3. 用户认证（手机号 + 微信 OAuth）
4. LLM Service Layer（Router + Prompt Assembler + Cost Tracker）
5. 改写 API（SSE 流式输出）
6. 前端改写工作区
7. 前端历史记录
8. 管理后台
9. URL 提取功能
10. 落地页（SSR + SEO）
```

**跨组件依赖：**
- 认证 -> 所有需要用户身份的功能
- LLM Service Layer -> 改写 API -> 前端改写工作区
- 数据库 schema -> 所有数据读写功能
- Platform Configs 表 -> Prompt Assembler -> 改写质量

## Implementation Patterns & Consistency Rules

### Naming Patterns

**数据库命名：**
- 表名：`snake_case` 复数（`users`, `rewrite_records`, `platform_configs`）
- 列名：`snake_case`（`user_id`, `created_at`, `content_type`）
- 外键：`{referenced_table_singular}_id`（`user_id`, `record_id`）
- 索引：`idx_{table}_{column}`（`idx_rewrite_records_user_id`）
- 枚举值：`snake_case`（`not_helpful`, `xiaohongshu`）

**API 命名：**
- 路径：`/api/{resource}` 复数（`/api/rewrite`, `/api/rewrite/history`）
- 方法：REST 语义（GET 读、POST 写）
- 查询参数：`camelCase`（`pageSize`, `contentType`）
- 请求/响应 body：`camelCase`（`originalText`, `rewriteResults`）

**代码命名：**
- 文件名：`kebab-case`（`rewrite-service.ts`, `platform-config.ts`）
- React 组件文件：`kebab-case`（`rewrite-workspace.tsx`）
- React 组件名：`PascalCase`（`RewriteWorkspace`）
- 函数/变量：`camelCase`（`getRewriteHistory`, `platformConfig`）
- 常量：`SCREAMING_SNAKE_CASE`（`MAX_INPUT_LENGTH`, `DEFAULT_TONE`）
- TypeScript 类型/接口：`PascalCase`（`RewriteRecord`, `PlatformConfig`）
- 环境变量：`SCREAMING_SNAKE_CASE`（`DEEPSEEK_API_KEY`, `SUPABASE_URL`）

### Structure Patterns

**项目组织：按功能模块（Feature-based）**

```
src/
├── app/              -- Next.js App Router 页面
├── components/       -- 共享 UI 组件
├── features/         -- 功能模块（核心业务逻辑）
│   ├── rewrite/     -- 改写相关
│   ├── auth/        -- 认证相关
│   ├── history/     -- 历史记录相关
│   └── admin/       -- 管理后台相关
├── lib/              -- 工具函数和服务
│   ├── llm/         -- LLM Service Layer
│   ├── supabase/    -- Supabase 客户端配置
│   └── utils/       -- 通用工具
└── types/            -- 全局类型定义
```

**测试文件位置：与源文件同目录**
- `rewrite-service.ts` 的测试为 `rewrite-service.test.ts`
- 组件 `rewrite-workspace.tsx` 的测试为 `rewrite-workspace.test.tsx`

### Format Patterns

**API 响应格式（非流式）：**

```typescript
// 成功响应
{
  data: T,
  error: null
}

// 错误响应
{
  data: null,
  error: {
    code: "VALIDATION_ERROR",
    message: "原文字数不能少于50字"
  }
}
```

**SSE 事件格式：**
```
event: {event_type}
data: {JSON string}
```

**日期格式：** ISO 8601（`2026-03-24T09:30:00Z`），前端展示时转为本地时区

### Communication Patterns

**LLM 调用统一接口：**

```typescript
interface LLMProvider {
  streamChat(params: {
    model: string;
    messages: ChatMessage[];
    onChunk: (text: string) => void;
    onComplete: (usage: TokenUsage) => void;
    onError: (error: LLMError) => void;
    signal?: AbortSignal;
  }): Promise<void>;
}
```

所有 LLM 提供商（DeepSeek、通义千问）实现同一接口，Router 层做切换。

### Process Patterns

**错误处理：**
- LLM 调用失败：重试 1 次（切换提供商）-> 仍失败则返回 `error` SSE 事件
- URL 提取失败：返回 `{ success: false, error: "提取失败，请手动粘贴内容" }`
- 认证失败：返回 401，前端跳转登录页
- 限流触发：返回 429，前端展示"请稍后再试"

**改写流程状态机：**

```
idle -> extracting(可选) -> detecting_type -> rewriting_platform_1
  -> rewriting_platform_2 -> rewriting_platform_3 -> complete
                                                  -> error (任意阶段可进入)
```

### Enforcement Guidelines

**All AI Agents MUST：**
- 数据库表名用 `snake_case` 复数
- API 响应 body 用 `camelCase`
- 文件名用 `kebab-case`
- React 组件用 `PascalCase`
- 每个功能模块放在 `src/features/{module}/` 下
- 测试文件与源文件同目录
- LLM 调用通过 `LLMProvider` 接口，不直接调用 HTTP
- 环境变量通过 `src/lib/env.ts` 统一读取和校验
- 错误响应遵循 `{ data: null, error: { code, message } }` 格式
- 不在客户端组件中直接访问数据库或 LLM API

### Pattern Examples

**Good:**
```typescript
// src/features/rewrite/rewrite-service.ts
export async function createRewrite(params: CreateRewriteParams) {
  const config = await getPlatformConfig(params.platform);
  const prompt = assemblePrompt(config, params);
  // ...
}
```

**Anti-Pattern:**
```typescript
// 直接在 API Route 中写全部业务逻辑
// 直接 hardcode prompt 文本而非从配置读取
// 在客户端组件中调用 LLM API
// 用 PascalCase 命名数据库表
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
content-repurposer/
├── .github/
│   └── workflows/
│       └── deploy.yml                    # CI/CD pipeline
├── prisma/
│   ├── schema.prisma                     # 数据库 schema 定义
│   └── migrations/                       # 数据库迁移文件
├── public/
│   ├── favicon.ico
│   └── og-image.png                      # 社交分享图
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # 根布局
│   │   ├── page.tsx                      # 落地页 (SSR)
│   │   ├── login/
│   │   │   └── page.tsx                  # 登录/注册页
│   │   ├── app/
│   │   │   ├── layout.tsx                # 应用布局（含导航）
│   │   │   ├── page.tsx                  # 改写工作区主页
│   │   │   ├── history/
│   │   │   │   └── page.tsx              # 历史记录页
│   │   │   └── settings/
│   │   │       └── page.tsx              # 个人设置页
│   │   ├── admin/
│   │   │   ├── layout.tsx                # 管理后台布局
│   │   │   ├── page.tsx                  # 仪表盘
│   │   │   ├── users/
│   │   │   │   └── page.tsx              # 用户管理
│   │   │   └── platform-configs/
│   │   │       └── page.tsx              # 平台规则配置
│   │   └── api/
│   │       ├── rewrite/
│   │       │   ├── route.ts              # POST /api/rewrite (SSE 流式改写)
│   │       │   ├── history/
│   │       │   │   └── route.ts          # GET /api/rewrite/history
│   │       │   └── [id]/
│   │       │       ├── route.ts          # GET /api/rewrite/:id
│   │       │       └── feedback/
│   │       │           └── route.ts      # POST /api/rewrite/:id/feedback
│   │       ├── extract-url/
│   │       │   └── route.ts              # POST /api/extract-url
│   │       └── admin/
│   │           ├── dashboard/
│   │           │   └── route.ts          # GET /api/admin/dashboard
│   │           ├── users/
│   │           │   └── route.ts          # GET/PATCH /api/admin/users
│   │           └── platform-configs/
│   │               └── route.ts          # GET/PUT /api/admin/platform-configs
│   ├── components/                       # 共享 UI 组件
│   │   ├── ui/                           # shadcn/ui 基础组件
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── card.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   ├── copy-button.tsx               # 一键复制按钮
│   │   ├── feedback-buttons.tsx          # 有帮助/没帮助按钮
│   │   └── loading-skeleton.tsx          # 加载骨架屏
│   ├── features/
│   │   ├── rewrite/
│   │   │   ├── rewrite-workspace.tsx     # 改写工作区主组件
│   │   │   ├── text-input.tsx            # 文章输入区
│   │   │   ├── platform-selector.tsx     # 平台选择器
│   │   │   ├── tone-selector.tsx         # 语气风格选择器
│   │   │   ├── result-display.tsx        # 改写结果展示（含 tab 切换）
│   │   │   ├── content-package.tsx       # 单个平台的内容包展示
│   │   │   ├── streaming-text.tsx        # 流式文本渲染组件
│   │   │   ├── rewrite-service.ts        # 改写业务逻辑
│   │   │   ├── use-rewrite-stream.ts     # SSE 流式数据 hook
│   │   │   └── rewrite-store.ts          # Zustand store
│   │   ├── auth/
│   │   │   ├── login-form.tsx            # 登录表单
│   │   │   ├── phone-otp-form.tsx        # 手机号验证码表单
│   │   │   ├── wechat-login-button.tsx   # 微信登录按钮
│   │   │   └── auth-guard.tsx            # 认证保护组件
│   │   ├── history/
│   │   │   ├── history-list.tsx          # 历史记录列表
│   │   │   ├── history-item.tsx          # 单条历史记录
│   │   │   └── history-service.ts        # 历史记录业务逻辑
│   │   └── admin/
│   │       ├── dashboard-charts.tsx      # 仪表盘图表
│   │       ├── user-table.tsx            # 用户管理表格
│   │       ├── platform-config-editor.tsx # 平台规则编辑器
│   │       └── admin-service.ts          # 管理后台业务逻辑
│   ├── lib/
│   │   ├── llm/
│   │   │   ├── types.ts                  # LLM 相关类型定义
│   │   │   ├── llm-router.ts             # LLM 路由（主备切换+重试）
│   │   │   ├── prompt-assembler.ts       # Prompt 组装器
│   │   │   ├── cost-tracker.ts           # 成本追踪器
│   │   │   ├── providers/
│   │   │   │   ├── deepseek.ts           # DeepSeek 适配器
│   │   │   │   └── qwen.ts              # 通义千问适配器
│   │   │   └── content-type-parser.ts    # 从 LLM 输出中解析内容类型
│   │   ├── url-extractor/
│   │   │   ├── extractor.ts              # URL 正文提取主逻辑
│   │   │   ├── wechat-parser.ts          # 微信公众号文章解析
│   │   │   ├── zhihu-parser.ts           # 知乎文章解析
│   │   │   └── xiaohongshu-parser.ts     # 小红书文章解析
│   │   ├── supabase/
│   │   │   ├── client.ts                 # 浏览器端 Supabase 客户端
│   │   │   └── server.ts                 # 服务端 Supabase 客户端
│   │   ├── env.ts                        # 环境变量统一读取和校验
│   │   └── utils/
│   │       ├── format.ts                 # 格式化工具
│   │       └── validation.ts             # 输入校验
│   └── types/
│       ├── database.ts                   # 数据库表对应的 TypeScript 类型
│       ├── api.ts                        # API 请求/响应类型
│       └── rewrite.ts                    # 改写相关业务类型
├── .env.local                            # 本地环境变量（不提交 git）
├── .env.example                          # 环境变量模板
├── docker-compose.yml                    # 本地开发 + 生产部署
├── Dockerfile                            # 生产镜像
├── next.config.ts                        # Next.js 配置
├── tailwind.config.ts                    # Tailwind 配置
├── tsconfig.json                         # TypeScript 配置
├── prisma/schema.prisma                  # Prisma schema
├── package.json
└── README.md
```

### Architectural Boundaries

**API Boundaries：**
- `/api/rewrite/*` -- 改写相关（需要用户认证）
- `/api/extract-url` -- URL 提取（需要用户认证）
- `/api/admin/*` -- 管理后台（需要管理员权限）
- 所有 API 通过 middleware 统一校验认证

**Component Boundaries：**
- `src/components/ui/` -- 纯展示组件，不包含业务逻辑
- `src/features/` -- 功能组件，包含业务逻辑和状态
- 功能组件只能引用自己模块内的 service 和 `src/lib/` 下的工具

**Service Boundaries：**
- `src/lib/llm/` -- LLM 调用封装，唯一与 LLM API 通信的模块
- `src/lib/url-extractor/` -- URL 正文提取，唯一负责网页抓取的模块
- `src/lib/supabase/` -- 数据库访问，所有数据读写通过此模块

**Data Boundaries：**
- Supabase RLS 保证用户只能访问自己的 `rewrite_records` 和 `rewrite_results`
- `platform_configs` 表对所有用户只读，管理员可写
- 管理后台可读所有用户数据（仪表盘聚合查询）

### Requirements to Structure Mapping

| FR 分组 | 主要文件/目录 |
|---|---|
| FR1-4 内容输入 | `features/rewrite/text-input.tsx`, `lib/url-extractor/` |
| FR5-7 内容类型识别 | `lib/llm/prompt-assembler.ts`, `lib/llm/content-type-parser.ts` |
| FR8-10 平台选择与语气 | `features/rewrite/platform-selector.tsx`, `features/rewrite/tone-selector.tsx` |
| FR11-14 AI 改写引擎 | `lib/llm/llm-router.ts`, `lib/llm/providers/`, `app/api/rewrite/route.ts` |
| FR15-18 内容包输出 | `features/rewrite/result-display.tsx`, `features/rewrite/content-package.tsx` |
| FR19-20 反馈 | `components/feedback-buttons.tsx`, `app/api/rewrite/[id]/feedback/route.ts` |
| FR21-23 历史记录 | `features/history/`, `app/api/rewrite/history/route.ts` |
| FR24-27 认证 | `features/auth/`, `lib/supabase/` |
| FR28-31 管理后台 | `features/admin/`, `app/admin/`, `app/api/admin/` |

## Architecture Validation Results

### Coherence Validation

- **Decision Compatibility:** Next.js + Supabase + Prisma 是成熟的全栈组合，三者集成文档完善
- **Pattern Consistency:** 命名规范、文件组织、错误处理格式在所有模块间一致
- **Structure Alignment:** 目录结构与功能模块一一对应，边界清晰

### Requirements Coverage Validation

| 需求类别 | 覆盖状态 | 说明 |
|---|---|---|
| FR1-4 内容输入 | Covered | text-input + url-extractor |
| FR5-7 内容类型识别 | Covered | prompt-assembler + content-type-parser |
| FR8-10 平台/语气选择 | Covered | platform-selector + tone-selector |
| FR11-14 AI 改写 | Covered | llm-router + providers + SSE route |
| FR15-18 内容包输出 | Covered | result-display + content-package |
| FR19-20 反馈 | Covered | feedback-buttons + feedback API |
| FR21-23 历史记录 | Covered | history feature module |
| FR24-27 认证 | Covered | Supabase Auth + auth feature |
| FR28-31 管理后台 | Covered | admin feature + admin API |
| NFR1-3 性能 | Covered | SSE streaming + CDN + SSR |
| NFR4-7 安全 | Covered | Supabase RLS + HTTPS + env isolation |
| NFR8-9 可扩展性 | Covered | Docker + 多 LLM 提供商 |
| NFR10-12 可靠性 | Covered | LLM Router 重试 + 自动备份 |
| NFR13 集成 | Covered | url-extractor (Best Effort) |

### Implementation Readiness Validation

- **Decision Completeness:** 所有关键技术选型已确定，无阻塞未决项
- **Structure Completeness:** 完整文件树已定义，每个 FR 有明确的实现位置
- **Pattern Completeness:** 命名/结构/格式/错误处理模式已定义，包含正反示例

### Architecture Completeness Checklist

- [x] 技术栈选型完成（Next.js + Supabase + Prisma + DeepSeek）
- [x] 数据模型定义完成（4 张核心表）
- [x] API 接口设计完成（改写/历史/反馈/提取/管理）
- [x] 流式输出协议定义完成（SSE 事件格式）
- [x] LLM 集成架构完成（Router + Assembler + Tracker）
- [x] 认证方案确定（Supabase Auth）
- [x] 前端架构确定（Zustand + shadcn/ui）
- [x] 部署方案确定（阿里云 ECS + Docker）
- [x] 命名规范完成
- [x] 文件组织规范完成
- [x] 错误处理模式完成
- [x] 所有 FR/NFR 已映射到架构组件
- [x] 实现顺序已定义

### Architecture Readiness Assessment

- **Overall Status:** READY FOR IMPLEMENTATION
- **Confidence Level:** High
- **Key Strengths:** 单体全栈架构极简高效，LLM 层抽象清晰支持扩展，Supabase 大幅减少基础设施开发量
- **Areas for Future Enhancement:** 缓存层（Phase 2）、消息队列（高并发时）、微服务拆分（API 复杂度增长时）

### Implementation Handoff

**AI Agent Guidelines：**
- 所有 LLM 调用必须通过 `src/lib/llm/llm-router.ts`，不直接 HTTP 调用
- 所有数据库操作通过 Prisma Client，不写原生 SQL
- 平台规则从 `platform_configs` 表读取，不 hardcode 在代码中
- 环境变量通过 `src/lib/env.ts` 统一管理
- 严格遵循 Implementation Patterns 中的命名和结构规范

**First Implementation Priority：**
1. 项目初始化（`create-next-app` + 依赖安装 + 环境配置）
2. 数据库 schema 创建 + Prisma 迁移
3. LLM Service Layer（核心改写能力）
