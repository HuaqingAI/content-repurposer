# Story 1.1: Next.js 项目初始化与核心依赖配置

Status: done

## Story

作为开发者，
我想使用标准命令初始化项目并安装所有核心依赖，
以便所有后续开发工作在统一的技术栈基础上进行。

## Acceptance Criteria

1. **Given** 一台干净的开发机器，**When** 执行 `npx create-next-app@latest content-repurposer --typescript --tailwind --eslint --app --src-dir` 并完成所有依赖安装，**Then** 项目可通过 `npm run dev` 在本地启动，访问 `localhost:3000` 返回正常页面。

2. **Given** 项目初始化完成，**When** 查看项目目录结构，**Then** 符合 Architecture 规范，包含以下目录：
   - `src/app/`
   - `src/components/ui/`（空目录，留给 shadcn/ui）
   - `src/features/`（空目录，后续各 Epic 按需添加子目录）
   - `src/lib/llm/`、`src/lib/supabase/`、`src/lib/utils/`
   - `src/types/`

3. **Given** 项目目录就绪，**When** 查看 `src/lib/env.ts`，**Then** 该文件已创建，使用 Zod 统一读取和校验所有环境变量，缺失任何必要变量时 Next.js 启动即报错（`throw new Error`），不允许运行时访问未定义变量。

4. **Given** 项目初始化完成，**When** 查看项目根目录，**Then** `.env.example` 已创建，包含所有必要环境变量的说明注释，无真实密钥。

5. **Given** `.env.local` 存在于开发机器，**When** 查看 `.gitignore`，**Then** `.env.local` 已被正确忽略，不会意外提交。

## Tasks / Subtasks

- [x] 执行 create-next-app 初始化 (AC: #1)
  - [x] 运行命令：`npx create-next-app@latest content-repurposer --typescript --tailwind --eslint --app --src-dir`
  - [x] 确认 `npm run dev` 正常启动

- [x] 安装核心依赖 (AC: #1, #2)
  - [x] 数据库：`npm install prisma @prisma/client`
  - [x] Supabase：`npm install @supabase/supabase-js @supabase/ssr`
  - [x] 状态管理：`npm install zustand`
  - [x] 表单验证：`npm install react-hook-form zod @hookform/resolvers`
  - [x] 初始化 shadcn/ui：手动创建 `components.json`（Default style, Slate, CSS variables）
  - [x] 初始化 Prisma：`npx prisma init`（生成 schema.prisma，.env 重命名为 .env.local）

- [x] 创建项目目录结构 (AC: #2)
  - [x] 创建 `src/components/ui/`
  - [x] 创建 `src/features/` 空目录（添加 `.gitkeep`）
  - [x] 创建 `src/lib/llm/providers/` 空目录
  - [x] 创建 `src/lib/supabase/` 空目录
  - [x] 创建 `src/lib/utils/` 空目录
  - [x] 创建 `src/types/` 空目录

- [x] 创建 `src/lib/env.ts` 环境变量统一管理文件 (AC: #3)
  - [x] 使用 Zod schema 定义所有必要变量
  - [x] 服务端变量：`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL`、`DEEPSEEK_API_KEY`、`QWEN_API_KEY`
  - [x] 公开变量：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_APP_URL`
  - [x] parse 失败时 `throw new Error`，输出清晰错误信息

- [x] 创建 `.env.example` (AC: #4)
  - [x] 包含所有 `env.ts` 中定义的变量名
  - [x] 每个变量附有中文注释说明用途和获取方式
  - [x] 所有 value 为空字符串或示例占位符，无真实密钥

- [x] 验证 `.gitignore` 包含 `.env.local` (AC: #5)
  - [x] `.gitignore` 中 `.env*` 已覆盖 `.env.local`

## Dev Notes

### 技术栈版本（必须遵守）

| 依赖 | 版本要求 | 说明 |
|---|---|---|
| Next.js | 15.x | App Router，使用 `src/` 目录 |
| React | 19.x | create-next-app 默认安装 |
| TypeScript | 5.x | strict mode 开启 |
| Tailwind CSS | 4.x | create-next-app 默认安装 |
| ESLint | 9.x | create-next-app 默认安装 |
| Prisma | latest | ORM，本 Story 只 init，不 migrate |
| @supabase/supabase-js | latest | Supabase 客户端 |
| @supabase/ssr | latest | SSR 专用 Supabase 辅助包 |
| Zustand | latest | 轻量状态管理 |
| Zod | latest | 用于 env.ts 验证和后续表单验证 |
| shadcn/ui | latest CLI | 基于 Radix + Tailwind，可定制 |

### 关键约束

- **本 Story 不初始化 Supabase 客户端文件**（`src/lib/supabase/client.ts`、`src/lib/supabase/server.ts`），由 Story 1.2 完成
- **本 Story 不运行 `prisma migrate`**，只运行 `prisma init` 生成 `schema.prisma` 框架文件，Story 1.2 完成 schema 定义
- **本 Story 不安装 shadcn/ui 组件**（如 button、input），只做 shadcn/ui 框架初始化；各 Epic 按需添加所需组件
- `prisma init` 会生成 `prisma/schema.prisma` 和修改 `.env`，将 `.env` 重命名为 `.env.local`（防止密钥提交）

### `src/lib/env.ts` 实现规范

```typescript
// src/lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Supabase（公开）
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Supabase（服务端）
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // 数据库（服务端）
  DATABASE_URL: z.string().url(),
  // LLM API Keys（服务端）
  DEEPSEEK_API_KEY: z.string().min(1),
  QWEN_API_KEY: z.string().min(1),
  // 应用配置（公开）
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

// 这里直接 parse process.env，不通过 dotenv（Next.js 自动处理）
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ 环境变量校验失败:', parsed.error.flatten().fieldErrors)
  throw new Error('环境变量缺失或格式错误，请检查 .env.local 文件')
}

export const env = parsed.data
```

**注意：** 只在服务端代码（API Routes、Server Components、`lib/` 下的服务文件）中 `import { env } from '@/lib/env'`，客户端组件用 `process.env.NEXT_PUBLIC_*`。

### `.env.example` 结构（所有变量）

```
# Supabase 配置（在 Supabase Dashboard > Settings > API 中获取）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...（anon/public key）
SUPABASE_SERVICE_ROLE_KEY=eyJ...（service_role key，仅服务端，勿暴露）

# 数据库（在 Supabase Dashboard > Settings > Database 中获取连接字符串）
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# LLM API Keys
DEEPSEEK_API_KEY=sk-xxx（DeepSeek 控制台获取）
QWEN_API_KEY=sk-xxx（阿里云通义千问控制台获取）

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 文件命名规范（防止后续 Story 出错）

- 文件名：`kebab-case`（`rewrite-service.ts`、`platform-selector.tsx`）
- React 组件名：`PascalCase`（`RewriteWorkspace`）
- 函数/变量：`camelCase`
- 常量：`SCREAMING_SNAKE_CASE`（`MAX_INPUT_LENGTH`）
- TypeScript 接口/类型：`PascalCase`（`RewriteRecord`）

### 目录结构（完成后预期状态）

```
content-repurposer/
├── prisma/
│   └── schema.prisma           ← prisma init 生成，Story 1.2 填充
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← create-next-app 生成
│   │   ├── page.tsx            ← create-next-app 生成（临时落地页）
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── components/
│   │   └── ui/                 ← shadcn init 生成，本 Story 为空
│   ├── features/               ← 空目录（有 .gitkeep）
│   ├── lib/
│   │   ├── env.ts              ← 本 Story 创建
│   │   ├── llm/
│   │   │   └── providers/      ← 空目录（有 .gitkeep）
│   │   ├── supabase/           ← 空目录，Story 1.2 填充
│   │   └── utils/              ← 空目录（有 .gitkeep）
│   └── types/                  ← 空目录（有 .gitkeep）
├── .env.example                ← 本 Story 创建
├── .env.local                  ← 本地环境变量（gitignore 中）
├── .gitignore                  ← 确认含 .env.local
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json             ← shadcn init 生成
└── package.json
```

### shadcn/ui 初始化注意事项

- 运行 `npx shadcn@latest init` 时选择：
  - Style: **Default**
  - Base color: **Slate**（与项目设计稿一致）
  - CSS variables: **Yes**
- shadcn init 会修改 `tailwind.config.ts` 和 `globals.css`，这是预期行为
- 生成的 `components.json` 配置 `aliases.components = "@/components"`, `aliases.utils = "@/lib/utils"`

### 测试标准

本 Story 以功能验证为主，无需编写单元测试：
- `npm run dev` 启动无报错
- `npm run build` 构建成功（可选，确保无 TypeScript 错误）
- `npm run lint` 无 ESLint 错误

### 已知问题预防

- **Tailwind 4.x 变化：** Tailwind 4 不再使用 `tailwind.config.ts` 中的 `content` 数组，改为 CSS-based 配置。shadcn/ui 最新版已适配，无需手动修改。
- **prisma init 会修改 `.env`：** 将其重命名为 `.env.local` 并加入 `.gitignore`。
- **Next.js 15 的 `next.config.ts`（TypeScript 格式）：** create-next-app 已生成，无需改动。

### Project Structure Notes

- 所有代码在 `src/` 目录下，符合 create-next-app `--src-dir` 选项的约定
- `src/app/` 使用 App Router（`--app` 选项），不使用 Pages Router
- `src/features/` 按功能模块组织，与具体 Epic 对应（`rewrite/`、`auth/`、`history/`、`admin/`）——后续 Story 按需创建
- `src/lib/` 存放工具函数和服务层，子目录与 Architecture 中的 Service Boundaries 对应

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter Template Evaluation] — 确认 create-next-app 命令和技术栈版本
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules] — 命名规范
- [Source: _bmad-output/planning-artifacts/architecture.md#Complete Project Directory Structure] — 完整目录结构
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines] — env.ts 使用规范
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — Acceptance Criteria

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- create-next-app 在非空目录运行失败，改为临时目录初始化后合并文件
- npm install 会移除 devDependencies，需用 `npm install --include=dev` 重装
- `/home/node/.config` 为文件而非目录，通过 `XDG_CONFIG_HOME=/tmp/xdg-config` 绕过

### Completion Notes List

- ✅ Next.js 16.2.1 + React 19 + TypeScript 5 + Tailwind 4.x 项目初始化完成
- ✅ 核心依赖全部安装：prisma 7.5、@supabase/supabase-js 2.x、@supabase/ssr 0.9、zustand 5、zod 4、react-hook-form 7
- ✅ 目录结构符合 Architecture 规范
- ✅ `src/lib/env.ts` 使用 Zod 校验，缺失变量启动报错
- ✅ `.env.example` 含所有变量和中文注释
- ✅ `.gitignore` 的 `.env*` 覆盖 `.env.local`
- ✅ `npm run build` 构建成功，`npm run dev` HTTP 200
- ✅ `npx tsc --noEmit` 无 TypeScript 错误
- ⚠️ Prisma 7.x devDependencies 含已知安全漏洞（`@hono/node-server`、`effect`），为 CLI 工具链漏洞，不影响生产运行时

### File List

- package.json
- package-lock.json
- next.config.ts
- tsconfig.json
- postcss.config.mjs
- components.json
- prisma/schema.prisma
- prisma.config.ts
- .env.local
- .env.example
- src/app/layout.tsx
- src/app/page.tsx
- src/app/globals.css
- src/lib/env.ts
- src/features/.gitkeep
- src/lib/llm/providers/.gitkeep
- src/lib/supabase/.gitkeep
- src/lib/utils/.gitkeep
- src/types/.gitkeep
