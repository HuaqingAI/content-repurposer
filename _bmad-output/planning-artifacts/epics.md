---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - prd.md
  - architecture.md
  - ux-visual-reference: outputs/shiwén-ux-preview.html
---

# content-repurposer - Epic Breakdown

## Overview

本文档提供 content-repurposer（适文）的完整 Epic 和 Story 拆解，将 PRD、Architecture 中的需求分解为可实施的开发故事。UX 视觉参考使用第一版 HTML 设计稿（`outputs/shiwén-ux-preview.html`）。

## Requirements Inventory

### Functional Requirements

**内容输入（Content Input）**

- FR1: 用户可粘贴纯文本内容作为改写原文（支持 50-5000 字）
- FR2: 用户可输入 URL，系统尝试自动提取文章正文内容；提取失败时显示明确提示并引导用户手动粘贴
- FR3: 系统在输入后显示原文预览，供用户确认内容正确
- FR4: 系统对超出字数限制或低于最低字数的内容给出明确提示

**内容类型识别（Content Type Detection）**

- FR5: 系统在改写前自动识别原文内容类型（观点分析类 / 体验叙事类 / 教程列表类 / 评测对比类 / 其他）
- FR6: 系统按识别出的内容类型选择对应的改写策略
- FR7: 对于无法有效改写的内容（如纯代码、纯数据表格、外语内容），系统给出明确提示

**平台选择与配置（Platform Selection & Configuration）**

- FR8: 用户可选择一个或多个目标平台进行改写（小红书 / 微信公众号 / 知乎）
- FR9: 用户可选择语气风格预设（口语化 / 标准 / 正式三档）
- FR10: 用户选择新的语气风格后，可点击"重新改写"以新风格重新生成

**AI 改写引擎（AI Rewriting Engine）**

- FR11: 系统按目标平台的内容结构规范重组内容（小红书：体验+结论前置；公众号：论点递进+深度分析；知乎：问题拆解+数据支撑）
- FR12: 系统用目标平台的语言风格重写表达（用词、句式、emoji 使用规范、互动口吻）
- FR13: 多个目标平台的改写串行生成（完成一个再开始下一个），每个平台以流式方式逐字呈现
- FR14: 用户可在改写完成后点击"重新改写"获取全新版本

**内容发布包输出（Content Package Output）**

- FR15: 每个目标平台的改写结果包含：改写文案全文 + 3 个备选标题 + 推荐标签（3-5 个）+ 互动引导语
- FR16: 用户可一键复制改写结果中的任意组成部分（文案 / 标题 / 标签 / 引导语）
- FR17: 用户可直接在结果区域编辑改写内容
- FR18: 多个目标平台的改写结果在同一页面内以 tab 或卡片形式展示，默认显示文案，标题/标签/引导语可折叠展示

**反馈（Feedback）**

- FR19: 每次改写结果旁展示"有帮助/没帮助"反馈按钮
- FR20: 用户点击"没帮助"时，可选填简短文字说明原因

**历史记录与内容管理（History & Content Management）**

- FR21: 系统自动保存每次改写记录（原文 + 所有平台改写结果 + 使用的配置）
- FR22: 用户可查看改写历史列表，按时间倒序排列
- FR23: 用户可从历史记录中重新加载原文并发起新的改写

**用户认证与账号（User Authentication & Account）**

- FR24: 用户可通过手机号 + 短信验证码注册和登录
- FR25: 用户可通过微信 OAuth 快捷注册和登录
- FR26: 系统维护用户会话状态，支持自动续期
- FR27: 用户可在个人设置中查看和修改基本信息

**管理后台与运营（Admin & Operations）**

- FR28: 管理后台展示系统运行仪表盘（DAU、改写次数、API 调用量、API 成本、反馈满意率）
- FR29: 管理后台可查看和管理用户账号
- FR30: 管理后台可更新平台规则配置（与 AI 改写逻辑解耦）
- FR31: 系统记录每次改写的完整日志（原文类型、目标平台、API 耗时、成本、用户反馈）

### NonFunctional Requirements

**性能（Performance）**

- NFR1: 系统在用户点击"开始改写"后 2 秒内开始流式输出第一个 token
- NFR2: 2000 字以内原文的单平台完整改写在 15 秒内完成
- NFR3: 页面首次加载时间（LCP）< 2 秒（国内 CDN 加速）

**安全（Security）**

- NFR4: 用户手机号、OAuth token 等认证信息使用加密存储
- NFR5: API 通信全程使用 HTTPS
- NFR6: 用户改写内容在不同账户之间完全隔离，不可交叉访问
- NFR7: LLM API Key 等敏感配置不暴露给前端

**可扩展性（Scalability）**

- NFR8: 系统架构支持从 100 并发用户平滑扩展到 10,000 并发用户
- NFR9: LLM API 调用层支持多提供商切换（主提供商不可用时降级到备选）

**可靠性（Reliability）**

- NFR10: 系统月度可用性 > 99.5%
- NFR11: LLM API 调用失败时自动重试一次，仍失败则向用户展示明确错误信息和重试按钮
- NFR12: 用户改写历史数据定期自动备份

**集成（Integration）**

- NFR13: URL 正文提取支持微信公众号、知乎、小红书文章链接（Best Effort，允许失败并优雅降级）

### Additional Requirements

从 Architecture.md 提取的技术实现要求：

**Starter 模板（对 Epic 1 Story 1 至关重要）**

- ARCH1: 使用 `npx create-next-app@latest content-repurposer --typescript --tailwind --eslint --app --src-dir` 初始化项目（已确定，Next.js 15 + React 19 + TypeScript + Tailwind CSS 4.x）

**数据库与基础设施**

- ARCH2: 创建 PostgreSQL 数据库 schema（4 张核心表：`users`, `rewrite_records`, `rewrite_results`, `platform_configs`），通过 Prisma 管理迁移
- ARCH3: 配置 Supabase Auth（手机号 OTP + 微信 OAuth 自定义 Provider）
- ARCH4: 配置 Supabase Row Level Security（RLS）策略，确保用户数据隔离
- ARCH5: 初始化 `platform_configs` 表数据（小红书/公众号/知乎的 style_rules、prompt_template、few_shot_examples）

**LLM 服务层**

- ARCH6: 实现 `LLMProvider` 接口，适配 DeepSeek（主）和通义千问（备）
- ARCH7: 实现 LLM Router（主备切换 + 1 次自动重试 + 30 秒超时）
- ARCH8: 实现 Prompt Assembler（从 platform_configs 读取规则，组装含内容类型识别的 prompt）
- ARCH9: 实现 Cost Tracker（记录每次 LLM 调用的 token 消耗和成本）

**流式输出协议**

- ARCH10: 实现 SSE 流式输出协议（事件类型：platform_start / chunk / titles / tags / hook / platform_complete / done / error）
- ARCH11: 前端实现 SSE 消费（原生 `fetch` + `ReadableStream`，非 EventSource）

**部署与运维**

- ARCH12: 配置 Docker + docker-compose（本地开发 + 生产部署）
- ARCH13: 配置 GitHub Actions CI/CD pipeline（推送自动部署到阿里云 ECS）
- ARCH14: 配置阿里云 CDN（静态资源 + SSR 页面加速）

**安全与限流**

- ARCH15: API 端限流：每用户每分钟最多 5 次改写请求（防滥用）
- ARCH16: 环境变量通过 `src/lib/env.ts` 统一读取和校验

**实现顺序约束（Architecture 明确规定）**

- ARCH17: 实现顺序：① 项目初始化 → ② DB schema → ③ 认证 → ④ LLM Service Layer → ⑤ 改写 API → ⑥ 前端改写工作区 → ⑦ 历史记录 → ⑧ 管理后台 → ⑨ URL 提取 → ⑩ 落地页

### UX Design Requirements

无正式 UX 规范文档。视觉参考使用已确定的第一版 HTML 设计稿：`outputs/shiwén-ux-preview.html`。

开发实现时直接对照该 HTML 还原界面，无需单独 UX-DR 条目。

### FR Coverage Map

| FR | Epic | 说明 |
|---|---|---|
| FR1 | E4a | 粘贴文本输入（50-5000字） |
| FR2 | E4a / Story 4a.6 | URL提取正文（Best Effort），失败时引导粘贴 |
| FR3 | E4a | 原文预览确认 |
| FR4 | E4a | 字数限制提示 |
| FR5 | E3 | 内容类型自动识别 |
| FR6 | E3 | 按内容类型选改写策略 |
| FR7 | E3 | 不可改写内容给出提示 |
| FR8 | E4a | 目标平台多选（小红书/公众号/知乎）|
| FR9 | E4a | 语气风格三档预设 |
| FR10 | E4a | 语气切换+重新改写触发 |
| FR11 | E3 | 按平台内容结构规范改写 |
| FR12 | E3 | 按平台语言风格重写表达 |
| FR13 | E3 | 多平台串行+流式生成 |
| FR14 | E4b | 重新改写按钮（前端交互）|
| FR15 | E4b | 内容发布包输出（文案+标题+标签+引导语）|
| FR16 | E4b | 一键复制各组成部分 |
| FR17 | E4b | 结果区域可直接编辑 |
| FR18 | E4b | 多平台tab展示 |
| FR19 | E4b | 有帮助/没帮助反馈按钮 |
| FR20 | E4b | 没帮助时可选填原因 |
| FR21 | E3 | 改写完成后自动保存记录到DB（E3改写API负责落库）|
| FR22 | E5 | 历史列表（按时间倒序）|
| FR23 | E5 | 历史复用（重新加载原文）|
| FR24 | E2 | 手机号+短信验证码注册/登录 |
| FR25 | E2 | 微信OAuth快捷注册/登录 |
| FR26 | E2 | 会话状态+自动续期 |
| FR27 | E2 | 个人设置查看/修改基本信息 |
| FR28 | E6 | 管理仪表盘（DAU/改写次数/成本/满意率）|
| FR29 | E6 | 用户账号查看与管理 |
| FR30 | E6 | 平台规则配置更新 |
| FR31 | E6 | 改写完整日志记录 |

**FR 覆盖率：** 31/31（全部覆盖，FR2 已通过 Story 4a.6 放回 MVP 范围）

## Epic List

### Epic 1：项目基础与运行环境

开发团队可在本地和生产环境完整运行应用；数据库 schema 就绪，三个平台的初始 prompt 配置数据已入库，后续所有功能均可在此基础上开发交付。

**覆盖需求：** ARCH1、ARCH2、ARCH4、ARCH5、ARCH12、ARCH13、ARCH14、ARCH16
**NFR覆盖：** NFR3（LCP/CDN）、NFR5（HTTPS）

---

### Epic 2：用户注册与登录

用户可通过手机号或微信完成注册和登录，系统维护会话状态自动续期，用户可在个人设置中管理基本信息。

**FRs覆盖：** FR24、FR25、FR26、FR27
**覆盖需求：** ARCH3、ARCH15
**NFR覆盖：** NFR4（认证信息加密存储）、NFR6（用户数据隔离）、NFR7（API Key不暴露前端）

---

### Epic 3：AI 改写引擎

系统可自动识别原文内容类型，调用 LLM 按目标平台规范和语言风格进行语义级改写，以 SSE 流式方式输出内容发布包，改写记录自动落库，成本实时追踪。

> **⚠️ Sprint 排期注意：** Epic 3 全部为后端 API 和 LLM 服务层，单独实施时用户无法感知任何价值。Sprint Planning 时**必须将 Epic 3、Epic 4a、Epic 4b 安排在同一 Sprint 或相邻 Sprint** 中，确保每个 Sprint 结束时有端到端可演示的改写功能。建议：Sprint 1 = E1（基础）+ E2（认证），Sprint 2 = E3 + E4a + E4b（核心改写流程全通），Sprint 3 = E5（历史）+ E6（管理后台），Sprint 4 = E7（落地页）。

**FRs覆盖：** FR5、FR6、FR7、FR11、FR12、FR13、FR21（落库）
**覆盖需求：** ARCH6、ARCH7、ARCH8、ARCH9、ARCH10、ARCH11
**NFR覆盖：** NFR1（首token<2s）、NFR2（完整改写<15s）、NFR9（多提供商切换）、NFR11（自动重试）

---

### Epic 4a：改写输入体验

用户可粘贴原文，选择目标平台和语气风格，点击开始后实时看到流式改写内容逐字出现，整个输入到触发改写的交互流程完整可用。

**FRs覆盖：** FR1、FR2、FR3、FR4、FR8、FR9、FR10
**覆盖需求：** ARCH11（前端SSE消费）
**NFR覆盖：** NFR8（并发扩展架构）、NFR13（URL提取支持公众号/知乎/小红书）

---

### Epic 4b：改写输出体验

用户可查看完整的内容发布包（文案+备选标题+标签+引导语），一键复制任意部分，直接编辑改写结果，切换平台tab查看各版本，并提交有帮助/没帮助反馈。

**FRs覆盖：** FR14、FR15、FR16、FR17、FR18、FR19、FR20

---

### Epic 5：历史记录

用户可查看所有历史改写记录列表（按时间倒序），并从历史记录中重新加载原文发起新的改写。

**FRs覆盖：** FR22、FR23
**NFR覆盖：** NFR12（历史数据定期备份）

---

### Epic 6：管理后台

运营团队可通过专属管理后台（需管理员角色）查看系统运行健康数据，管理用户账号，实时更新三个平台的 prompt 规则配置，并查询改写日志追踪成本和质量。

**FRs覆盖：** FR28、FR29、FR30、FR31
**覆盖需求：** 管理员角色控制（users表role字段）
**NFR覆盖：** NFR10（99.5%可用性监控）

---

### Epic 7：落地页与增长入口

新用户通过落地页了解产品价值，无需注册即可体验改写效果预览（部分遮挡），引导快速注册（< 30秒）完成"Aha时刻"，页面支持 SSR 和 SEO 优化以支撑内容获客策略。

**覆盖：** Journey 3（新用户上手路径）
**NFR覆盖：** NFR3（LCP<2s/CDN）

---

## Epic 1：项目基础与运行环境

开发团队可在本地和生产环境完整运行应用；数据库 schema 就绪，三个平台的初始 prompt 配置数据已入库，后续所有功能均可在此基础上开发交付。

### Story 1.1：Next.js 项目初始化与核心依赖配置

作为开发者，
我想使用标准命令初始化项目并安装所有核心依赖，
以便所有后续开发工作在统一的技术栈基础上进行。

**Acceptance Criteria:**

**Given** 一台干净的开发机器
**When** 执行 `npx create-next-app@latest content-repurposer --typescript --tailwind --eslint --app --src-dir`，并完成所有依赖安装
**Then** 项目可在本地通过 `npm run dev` 启动，访问 `localhost:3000` 返回正常页面
**And** 项目目录结构符合 Architecture 规范（`src/app/`、`src/components/`、`src/features/`、`src/lib/`、`src/types/`）
**And** `src/lib/env.ts` 已创建，统一读取和校验所有环境变量，缺失必要变量时启动报错
**And** `.env.example` 已创建，包含所有必要环境变量的说明模板
**And** `.env.local` 已加入 `.gitignore`

### Story 1.2：数据库 Schema 定义与 Supabase 集成

作为开发者，
我想创建完整的数据库 schema 并配置 Prisma 与 Supabase 集成，
以便应用可以持久化所有业务数据。

**Acceptance Criteria:**

**Given** Supabase 项目已创建，连接配置已写入 `.env.local`
**When** 执行 `npx prisma migrate dev --name init`
**Then** 四张核心表在 Supabase 数据库中创建成功：`users`、`rewrite_records`、`rewrite_results`、`platform_configs`，字段类型和约束与 Architecture 定义完全一致
**And** `src/lib/supabase/client.ts`（浏览器端）和 `src/lib/supabase/server.ts`（服务端）均已创建并可正常初始化
**And** Prisma Client 可在服务端代码中正常查询数据库

### Story 1.3：Supabase Row Level Security 策略配置

作为产品运营团队，
我想确保用户只能访问自己的改写数据，
以便平台满足用户隐私和数据安全要求。

**Acceptance Criteria:**

**Given** Supabase 数据库已完成 Story 1.2 的 schema 创建
**When** RLS 策略配置完成后，用户 A 尝试查询用户 B 的 `rewrite_records`
**Then** 查询返回空结果，不报错也不暴露其他用户数据
**And** `platform_configs` 表对所有已认证用户可读，未认证用户不可访问
**And** RLS 策略已在 Supabase Dashboard 中验证通过，文档中记录各表的策略说明

### Story 1.4：平台配置初始数据入库

作为 AI 改写引擎，
我想在数据库中读取到三个平台的 prompt 模板和风格规则，
以便改写功能开发阶段有真实可用的配置数据驱动。

**Acceptance Criteria:**

**Given** Story 1.2 的数据库 schema 已就绪，且产品团队已提供三个平台的初始 prompt 内容（`style_rules`、`prompt_template`、`few_shot_examples` 由产品团队在开发前提供，开发者负责格式化写入 seed 脚本）
**When** 执行平台配置 seed 脚本（`npx prisma db seed`）
**Then** `platform_configs` 表中存在三条激活记录（`xiaohongshu`、`wechat`、`zhihu`），每条记录均包含非空的 `style_rules`（JSONB）、`prompt_template`（text）、`few_shot_examples`（JSONB）
**And** seed 脚本可幂等执行（重复运行不会创建重复数据）
**And** `package.json` 中已配置 `prisma.seed` 命令

### Story 1.5：Docker 容器化与 CI/CD 部署配置

作为运维团队，
我想通过 Docker 容器化应用并配置自动化部署流水线，
以便代码提交后可自动部署到生产环境。

**Acceptance Criteria:**

**Given** 项目代码已推送到 GitHub 仓库
**When** 向 `main` 分支推送代码
**Then** GitHub Actions 工作流自动触发，构建 Docker 镜像并部署到阿里云 ECS，部署完成后通过健康检查
**And** `Dockerfile` 使用多阶段构建，生产镜像体积经过优化
**And** `docker-compose.yml` 同时支持本地开发模式（含热更新）和生产模式
**And** Nginx 反向代理配置已就绪，HTTPS 证书已配置（满足 NFR5）

### Story 1.6：数据库自动备份配置

作为运营团队，
我想确保用户的改写历史数据定期自动备份，
以便在数据库故障时可以恢复数据，不丢失用户的历史记录。

**Acceptance Criteria:**

**Given** 生产环境 Supabase 数据库已运行
**When** 配置完成后等待第一次备份触发（最多 24 小时）
**Then** Supabase Dashboard > Settings > Database > Backups 中可看到自动备份记录，最近一次备份在 24 小时内
**And** 备份保留周期配置为至少 7 天（Point-in-Time Recovery 或每日快照均可）
**And** 执行一次恢复测试（在测试环境中从备份恢复到指定时间点），验证 `rewrite_records`、`rewrite_results`、`users` 三张核心表的数据可完整恢复
**And** 备份配置说明写入 `docs/ops/backup-recovery.md`，包含：备份频率、保留策略、恢复步骤

**覆盖需求：** NFR12（历史数据定期自动备份）

---

## Epic 2：用户注册与登录

用户可通过手机号或微信完成注册和登录，系统维护会话状态自动续期，用户可在个人设置中管理基本信息。

### Story 2.1：手机号短信验证码注册与登录

作为新用户，
我想通过手机号和短信验证码完成注册，
以便无需记住密码即可快速建立账号并开始使用。

**Acceptance Criteria:**

**Given** 用户访问 `/login` 页面
**When** 用户输入手机号并点击"获取验证码"，收到短信后输入正确验证码
**Then** 首次登录自动完成注册，创建 `users` 表记录，跳转到 `/app`
**And** 再次登录时直接进入会话，跳转到 `/app`
**And** 验证码 60 秒内有效，过期后提示重新获取
**And** 输入错误验证码时显示明确提示，不清空手机号输入框

### Story 2.2：微信 OAuth 快捷登录

作为用户，
我想通过微信扫码或授权完成一键登录，
以便不需要手动输入手机号和验证码。

**Acceptance Criteria:**

**Given** 用户在 `/login` 页面点击"微信登录"
**When** 完成微信 OAuth 授权流程
**Then** 系统通过微信 `openid` 创建独立 `users` 记录（`wechat_openid` 字段），跳转到 `/app`
**And** 再次微信登录时通过 `openid` 匹配已有账号，直接进入会话
**And** 首次微信登录后，设置页提示用户可绑定手机号（可跳过，不强制）；MVP 阶段不做微信账号与手机号账号的合并逻辑

### Story 2.3：会话管理与认证守卫

作为已登录用户，
我想在关闭浏览器后重新打开仍保持登录状态，
以便不必每次都重新登录。

**Acceptance Criteria:**

**Given** 用户已完成登录
**When** 关闭浏览器后重新打开应用
**Then** 会话自动续期，用户无需重新登录，直接进入 `/app`
**And** 未登录用户访问 `/app`、`/app/history`、`/app/settings` 时自动跳转到 `/login`
**And** 已登录用户访问 `/login` 时自动跳转到 `/app`
**And** `AuthGuard` 组件已实现，保护所有需要认证的页面

### Story 2.4：个人设置页

作为已登录用户，
我想在个人设置页查看和修改我的基本信息，
以便保持账号信息的准确性。

**Acceptance Criteria:**

**Given** 用户访问 `/app/settings`
**When** 页面加载完成
**Then** 显示当前用户的 `display_name`、绑定手机号（脱敏展示）、注册时间
**And** 用户可修改 `display_name`，保存后即时生效
**And** 修改成功显示成功提示，失败显示错误信息

### Story 2.5：API 限流中间件

作为系统，
我想对改写 API 实施每用户每分钟最多 5 次的请求限制，
以便防止滥用行为并控制 API 成本。

**Acceptance Criteria:**

**Given** 已登录用户在 1 分钟内发起第 6 次改写请求
**When** 请求到达 `/api/rewrite`
**Then** 返回 HTTP 429，响应体包含 `{ data: null, error: { code: "RATE_LIMIT_EXCEEDED", message: "请求过于频繁，请稍后再试" } }`
**And** 前端收到 429 时展示友好提示，不崩溃
**And** 限流计数基于用户 ID（不是 IP），已登录用户身份识别准确

---

## Epic 3：AI 改写引擎

系统可自动识别原文内容类型，调用 LLM 按目标平台规范和语言风格进行语义级改写，以 SSE 流式方式输出内容发布包，改写记录自动落库，成本实时追踪。

### Story 3.1：LLM Provider 接口与 DeepSeek 适配器

作为开发者，
我想定义统一的 LLM Provider 接口并实现 DeepSeek 适配器，
以便所有 LLM 调用通过统一接口进行，后续切换提供商无需修改上层代码。

**Acceptance Criteria:**

**Given** `LLMProvider` 接口已在 `src/lib/llm/types.ts` 中定义（含 `streamChat` 方法）
**When** 调用 DeepSeek 适配器的 `streamChat` 方法
**Then** 适配器向 DeepSeek API 发送请求，通过 `onChunk` 回调逐步返回文本片段，完成后通过 `onComplete` 返回 token 用量
**And** 请求超时阈值为 30 秒，超时时触发 `onError` 回调
**And** DeepSeek API Key 仅从 `src/lib/env.ts` 读取，不在任何客户端代码中出现（满足 NFR7）

### Story 3.2：通义千问适配器与 LLM Router

作为系统，
我想在 DeepSeek 调用失败时自动切换到通义千问，
以便单个 LLM 提供商故障不影响用户的改写体验。

**Acceptance Criteria:**

**Given** DeepSeek API 返回错误或超时
**When** LLM Router 捕获到错误
**Then** 自动切换到通义千问适配器发起重试，用户侧流式输出不中断
**And** 两个提供商均失败时，Router 触发 `onError` 回调，返回可读错误信息
**And** `src/lib/llm/llm-router.ts` 实现主备切换逻辑，上层业务代码无需感知提供商细节（满足 NFR9、NFR11）

### Story 3.3：Prompt Assembler

作为 AI 改写引擎，
我想从数据库动态读取平台规则配置并组装完整的 prompt，
以便改写质量由平台配置驱动，更新规则无需修改代码。

**Acceptance Criteria:**

**Given** `platform_configs` 表中存在目标平台的激活配置
**When** 调用 `assemblePrompt({ platform, tone, originalText })`
**Then** 返回包含系统提示、平台风格规则、few-shot 示例、语气指令和用户原文的完整 prompt
**And** prompt 中包含内容类型识别指令（要求 LLM 先输出 `[CONTENT_TYPE]` 标签）
**And** 若目标平台无激活配置，抛出明确错误（不静默失败）
**And** `src/lib/llm/content-type-parser.ts` 可从 LLM 输出中解析出内容类型标签

### Story 3.4a：改写 SSE API（串行流式输出）

作为前端改写工作区，
我想调用改写 API 并通过 SSE 实时接收多平台改写结果，
以便用户看到流式逐字输出效果，不需要等待全部完成才显示。

**Acceptance Criteria:**

**Given** 已登录用户发送 `POST /api/rewrite`，body 包含 `{ text, platforms, tone }`
**When** API 处理请求
**Then** 按平台顺序串行调用 LLM，每个平台依次发送 SSE 事件：`platform_start` → `chunk`（多次）→ `titles` → `tags` → `hook` → `platform_complete`，全部完成后发送 `done`
**And** `platform_complete` 事件包含该平台的 `tokens_used` 和 `cost_cents`
**And** LLM 输出中包含 `[UNSUPPORTED_CONTENT]` 标签时（原文为纯代码、纯数据表格或外语内容），发送 `error` SSE 事件，message 为"该内容暂不支持改写，请尝试其他类型的文章"，`retryable: false`（满足 FR7）
**And** 任意平台 LLM 调用失败时，发送 `error` SSE 事件，包含 `{ message, retryable: true }`
**And** 首个 `chunk` 事件在用户点击改写后 2 秒内到达（满足 NFR1）
**And** 2000 字原文的单平台改写 `platform_complete` 在 15 秒内到达（满足 NFR2）

**试用模式（未登录用户，支持 Story 7.2）：**

**Given** 未登录用户发起试用改写请求（请求头中无有效 session token）
**When** API 处理请求
**Then** 请求按 IP 限流（每小时最多 3 次）而非按用户限流，超限返回 HTTP 429，message 为"今日试用次数已达上限，注册后可免费无限使用"
**And** `done` SSE 事件携带 `{ trial: true, record_id: null }`，表示本次改写不落库
**And** 试用改写不写入 `rewrite_records` 表，也不触发 Story 3.4b 的落库逻辑
**And** 试用用户只能选择单个目标平台（多选时 API 返回 400，message 为"试用模式仅支持单平台改写"）

### Story 3.4b：改写记录落库与 Cost Tracker

作为运营团队，
我想每次改写完成后自动记录改写结果和 API 成本，
以便在管理后台分析质量和控制成本。

**Acceptance Criteria:**

**Given** 改写 SSE API（Story 3.4a）完成所有平台的改写
**When** 所有平台的 `platform_complete` 事件均已发送
**Then** `rewrite_records` 表写入一条记录（含原文、内容类型、用户 ID、时间戳）
**And** 每个平台各写入一条 `rewrite_results` 记录（含文案、标题、标签、引导语、api_model、tokens_used、cost_cents、duration_ms）
**And** `done` SSE 事件携带 `record_id`，供前端后续反馈提交使用
**And** 数据库写入失败时不影响 SSE 流式输出（落库错误仅记录服务端日志，不向用户返回错误）

---

## Epic 4a：改写输入体验

用户可粘贴原文，选择目标平台和语气风格，点击开始后实时看到流式改写内容逐字出现，整个输入到触发改写的交互流程完整可用。

### Story 4a.1：原文输入区

作为内容创作者，
我想将文章粘贴到输入框并看到字数提示，
以便确认内容已正确输入且符合字数要求再开始改写。

**Acceptance Criteria:**

**Given** 用户在 `/app` 页面的输入框中粘贴文本
**When** 文本内容发生变化
**Then** 实时显示当前字数（格式：`xxx / 5000 字`）
**And** 字数不足 50 字时，"开始改写"按钮禁用，提示"原文至少需要 50 字"
**And** 字数超过 5000 字时，超出部分高亮显示，提示"原文超出 5000 字限制"，按钮禁用
**And** 输入框支持多行文本，随内容增长自动扩展高度（最大高度后出现滚动条）

### Story 4a.2：平台选择器与语气风格选择器

作为内容创作者，
我想选择目标发布平台和语气风格，
以便改写结果符合我的具体需求。

**Acceptance Criteria:**

**Given** 用户在改写工作区看到平台选择区域
**When** 用户勾选平台选项
**Then** 可多选：小红书、微信公众号、知乎，至少选择 1 个，未选择时"开始改写"按钮禁用
**And** 语气风格显示三个选项（口语化 / 标准 / 正式），默认选中"标准"，单选
**And** 已选平台和语气以视觉高亮方式清晰标示当前选择状态

### Story 4a.3：流式文本渲染组件

作为内容创作者，
我想在点击开始改写后看到文字逐字出现，
以便感受到系统正在实时处理，消除等待焦虑。

**Acceptance Criteria:**

**Given** 用户点击"开始改写"，前端建立 SSE 连接
**When** 收到 `platform_start` 事件
**Then** 对应平台的 tab 激活，显示加载状态
**And** 收到 `chunk` 事件时，文字逐字追加到对应平台的文本区域，视觉上呈现打字机效果
**And** 收到 `error` 事件时，显示错误信息和"重试"按钮，不崩溃
**And** SSE 连接通过原生 `fetch` + `ReadableStream` 实现（非 EventSource），支持 POST 请求

### Story 4a.4：改写工作区状态管理与整合

作为内容创作者，
我想在一个完整的工作区页面中完成从输入到看到流式结果的全流程，
以便整个改写体验流畅无缝。

**交付物：** `src/features/rewrite/rewrite-workspace.tsx`（主页面容器）、`src/features/rewrite/rewrite-store.ts`（Zustand store）、`src/features/rewrite/use-rewrite-stream.ts`（SSE hook）

**Acceptance Criteria:**

**Given** 用户已输入原文、选择平台和语气，点击"开始改写"
**When** 改写进行中
**Then** "开始改写"按钮变为"改写中..."并禁用，防止重复提交
**And** 改写状态机正确流转：`idle → rewriting_platform_1 → rewriting_platform_2 → ... → complete`
**And** 改写完成后按钮恢复，显示"重新改写"
**And** 页面所有状态（输入内容、平台选择、语气、改写结果、当前状态）由 Zustand store 统一管理，组件不使用多余的本地 state
**And** `/app` 页面在浏览器刷新后恢复 idle 状态（不恢复上次的改写结果）

### Story 4a.5：改写失败恢复体验

作为内容创作者，
我想在改写过程中出现错误时能清楚了解发生了什么并一键重试，
以便 LLM 偶发故障不会让我的工作完全中断。

**Acceptance Criteria:**

**Given** 改写进行中某个平台的 LLM 调用失败，SSE 返回 `error` 事件
**When** 前端收到 `error` 事件
**Then** 显示错误提示："改写遇到问题，请重试"，并展示"重试"按钮
**And** 已完成平台的改写结果保留展示，不因错误被清空
**And** 用户点击"重试"时，重新发起完整改写请求（所有已选平台重新生成）
**And** 若错误发生在第一个平台之前（连接失败），显示全局错误提示并提供"重新改写"按钮
**And** 错误提示文案明确可读，不显示技术性错误代码

### Story 4a.6：URL 输入与正文提取（Best Effort）

作为内容创作者，
我想粘贴文章 URL 后系统自动提取正文，
以便不需要手动复制粘贴全文，直接输入链接即可开始改写。

**Acceptance Criteria:**

**Given** 用户在输入区域切换到"URL 提取"tab，输入一篇公众号/知乎/小红书文章的 URL
**When** 用户点击"提取正文"按钮
**Then** 系统调用 `/api/extract-url` 发起提取请求，按钮显示加载状态
**And** 提取成功时：提取到的正文内容自动填入文本输入框（切换回"粘贴全文" tab），字数实时更新，用户可直接点击"开始改写"
**And** 提取失败时（反爬/超时/内容不支持）：显示明确错误提示："无法自动提取该链接的内容，请手动复制文章文本后粘贴"，同时聚焦到"粘贴全文" tab 的输入框，引导用户手动粘贴
**And** 提取超时阈值为 10 秒，超时后触发失败提示
**And** 服务端提取逻辑为 Best Effort（`src/lib/url-extractor.ts`），优先支持微信公众号、知乎、小红书链接（满足 NFR13）；不支持的域名直接返回失败，不重试

**覆盖需求：** FR2、NFR13

---

## Epic 4b：改写输出体验

用户可查看完整的内容发布包，一键复制任意部分，直接编辑改写结果，切换平台 tab 查看各版本，并提交反馈。

### Story 4b.1：内容发布包多平台展示

作为内容创作者，
我想在改写完成后看到每个平台的完整内容发布包，
以便快速了解各平台版本的内容并选择使用。

**Acceptance Criteria:**

**Given** 改写 API 返回 `done` 事件
**When** 用户查看结果区域
**Then** 每个目标平台各有一个 tab，默认激活第一个完成的平台
**And** 每个平台 tab 内展示：改写文案（主体）、3 个备选标题（折叠/展开）、推荐标签 3-5 个（折叠/展开）、互动引导语（折叠/展开）
**And** 切换平台 tab 时，内容区域即时切换，无需重新请求

### Story 4b.2：一键复制功能

作为内容创作者，
我想一键复制改写结果的任意部分，
以便直接粘贴到各平台发布后台，不需要手动全选。

**Acceptance Criteria:**

**Given** 改写结果已展示
**When** 用户点击文案、标题、标签或引导语旁的复制按钮
**Then** 对应内容写入剪贴板，按钮短暂显示"已复制 ✓" 后恢复原状
**And** 标题区域支持单独复制每一个备选标题
**And** 标签区域支持一键复制所有标签（逗号分隔）

### Story 4b.3：改写结果可编辑

作为内容创作者，
我想直接在结果区域修改改写文案，
以便微调内容后直接复制使用，不需要切换到其他编辑器。

**Acceptance Criteria:**

**Given** 改写结果文案区域已展示
**When** 用户点击文案区域或"编辑"按钮
**Then** 文案区域切换为可编辑文本框，用户可自由修改内容
**And** 用户点击区域外或按 Esc 时，退出编辑状态，修改内容保留在界面上（不自动回存数据库）
**And** 编辑状态下复制按钮复制的是用户修改后的内容

### Story 4b.4：反馈按钮与重新改写

作为内容创作者，
我想对改写结果表达有帮助或没帮助，
以便帮助产品团队了解改写质量，同时在不满意时重新生成。

**Acceptance Criteria:**

**Given** 某个平台的改写结果已展示
**When** 用户点击"有帮助"
**Then** 调用 `POST /api/rewrite/:resultId/feedback`，记录 `feedback: 'helpful'`，按钮高亮显示已选状态
**And** 用户点击"没帮助"时，显示可选文字输入框，用户可填写原因后提交，记录 `feedback: 'not_helpful'` 及 `comment`
**And** 用户点击"重新改写"时，以当前语气风格重新发起改写请求，新结果覆盖当前展示
**And** 每个平台的反馈独立，互不影响

---

## Epic 5：历史记录

用户可查看所有历史改写记录列表，并从历史记录中重新加载原文发起新的改写。

### Story 5.1：历史记录列表页

作为内容创作者，
我想查看我所有的历史改写记录，
以便快速找到之前改写过的内容并了解使用情况。

**Acceptance Criteria:**

**Given** 用户访问 `/app/history`
**When** 页面加载完成
**Then** 按时间倒序展示该用户所有改写记录，每条显示：原文前 100 字预览、改写时间、目标平台标签
**And** 记录列表支持分页（每页 20 条）或无限滚动加载
**And** 点击某条历史记录，展开或跳转到详情页，显示该次改写的所有平台完整结果（文案 + 标题 + 标签 + 引导语）
**And** 无历史记录时显示空状态提示："还没有改写记录，去改写第一篇吧"
**And** 仅展示当前登录用户自己的记录，不显示其他用户数据（RLS 保证）

### Story 5.2：历史记录复用

作为内容创作者，
我想从历史记录中重新加载原文并发起新的改写，
以便复用之前的内容选择不同平台或语气重新生成。

**Acceptance Criteria:**

**Given** 用户在历史记录列表点击某条记录
**When** 点击"重新改写"按钮
**Then** 跳转到 `/app`，输入框自动填入该记录的原文内容
**And** 上次使用的平台和语气风格作为默认预选值（用户可修改）
**And** 用户点击"开始改写"后，发起全新的改写请求，生成新的 `rewrite_record`，不覆盖历史记录

---

## Epic 6：管理后台

运营团队通过专属管理后台查看系统健康数据、管理用户、更新平台规则配置，并追踪改写日志。

### Story 6.1：管理员角色与访问控制

作为系统管理员，
我想只有被授权的账号才能访问管理后台，
以便防止普通用户查看敏感运营数据或修改平台配置。

**Acceptance Criteria:**

**Given** `users` 表新增 `role` 字段（枚举：`user` / `admin`，默认 `user`）
**When** 用户访问 `/admin` 路径下的任意页面
**Then** middleware 校验当前用户的 `role` 字段，非 `admin` 用户返回 403 或重定向到 `/app`
**And** 管理员账号通过直接修改数据库 `role` 字段设置，无需管理界面
**And** 管理员权限校验在服务端 middleware 中完成，客户端无法绕过

### Story 6.2：系统运行仪表盘

作为运营团队，
我想在仪表盘上看到关键业务指标，
以便实时了解产品使用情况和 API 成本。

**Acceptance Criteria:**

**Given** 管理员访问 `/admin`
**When** 页面加载完成
**Then** 展示以下指标（默认展示今日数据，支持切换 7 日/30 日）：DAU（日活用户数）、总改写次数、API 总调用量、API 总成本（元）、用户反馈满意率（有帮助 / 总反馈）
**And** 数据每次访问时从数据库实时聚合查询，无需额外缓存
**And** 仪表盘页面响应时间 < 3 秒（管理后台，标准可宽松）
**And** 各指标以数字卡片形式展示，简洁清晰

### Story 6.3：用户管理

作为运营团队，
我想查看所有注册用户并能对异常账号进行处理，
以便应对滥用行为保护平台正常运营。

**Acceptance Criteria:**

**Given** 管理员访问 `/admin/users`
**When** 页面加载完成
**Then** 展示用户列表，包含：注册时间、手机号（脱敏）、改写次数、最后活跃时间、账号状态
**And** 支持按手机号搜索用户
**And** 管理员可将用户账号标记为禁用状态，禁用后该用户无法继续使用改写功能（API 返回 403）

### Story 6.4：平台规则配置编辑器

作为运营团队，
我想在管理后台修改三个平台的 prompt 模板和风格规则，
以便平台规则变化时无需修改代码即可更新改写策略。

**Acceptance Criteria:**

**Given** 管理员访问 `/admin/platform-configs`
**When** 页面加载完成
**Then** 展示三个平台（小红书/公众号/知乎）的当前激活配置，包含 `style_rules`、`prompt_template`、`few_shot_examples` 字段
**And** 管理员可编辑任意字段并保存，保存后新的改写请求立即使用更新后的配置（热更新，满足 ARCH8）
**And** 每次配置更新自动创建新版本记录（`config_version` 递增），保留历史版本可回溯
**And** 保存操作记录 `updated_by` 字段

---

## Epic 7：落地页与增长入口

新用户通过落地页了解产品价值，无需注册即可体验改写预览，引导快速注册完成"Aha 时刻"，支持 SEO 获客。

### Story 7.1：SSR 落地页与 SEO 配置

作为潜在用户，
我想通过搜索引擎找到适文并快速了解产品价值，
以便决定是否尝试使用。

**Acceptance Criteria:**

**Given** 用户通过搜索引擎点击进入适文官网
**When** 落地页加载完成
**Then** 页面 LCP < 2 秒（通过 CDN 加速，满足 NFR3）
**And** 页面 `<title>` 和 `meta description` 包含核心关键词（如"小红书文章改写成公众号"）
**And** 落地页通过 Next.js SSR 渲染，搜索引擎可索引完整内容
**And** 落地页清晰展示产品核心价值主张：一篇文章 → 多平台原生内容

### Story 7.2：未登录试用体验与注册引导

作为访客，
我想不注册就能体验一次改写效果预览，
以便在决定注册前先感受产品价值。

**Acceptance Criteria:**

**Given** 未登录用户在落地页粘贴文章并选择一个平台，点击"免费试用"
**When** 改写完成
**Then** 展示改写结果预览，仅显示前 150 个汉字（含标点），超出部分以渐变模糊遮罩覆盖，遮罩上方展示"注册免费解锁完整内容"的 CTA 按钮
**And** 用户点击"免费注册"后跳转到 `/login`，注册完成后返回结果页展示完整内容（"Aha 时刻"）
**And** 试用改写不保存到数据库，注册后的完整改写创建新的 `rewrite_record`
**And** 试用功能不受每分钟 5 次限流约束（未登录用户按 IP 限制，每小时最多 3 次）
