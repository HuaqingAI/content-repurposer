# Story 4a.6: URL 输入与正文提取（Best Effort）

Status: done

## Story

作为内容创作者，
我想粘贴文章 URL 后系统自动提取正文，
以便不需要手动复制粘贴全文，直接输入链接即可开始改写。

## Acceptance Criteria

1. **Given** 用户在改写工作区输入区域切换到"URL 提取"tab，输入一篇公众号/知乎/小红书文章的 URL，**When** 用户点击"提取正文"按钮，**Then** 系统调用 `POST /api/extract-url` 发起提取请求，按钮显示加载状态（"提取中..."，禁用）

2. **Given** `/api/extract-url` 返回 `{ success: true, text: "..." }`，**When** 前端收到响应，**Then** 提取到的正文内容自动通过 `setText()` 填入 Zustand store，UI 切换回"粘贴全文" tab 展示填入内容，字数计数实时更新，用户可直接点击"开始改写"

3. **Given** `/api/extract-url` 返回 `{ success: false, error: "..." }` 或网络/超时错误，**When** 前端收到失败响应，**Then** 显示错误提示："无法自动提取该链接的内容，请手动复制文章文本后粘贴"，同时切换到"粘贴全文" tab，输入框获得焦点引导用户手动粘贴

4. **Given** 前端请求已发出，**When** 10 秒内服务端未返回响应，**Then** 前端超时并触发 AC3 的失败提示（客户端侧 AbortSignal.timeout(10_000)）；服务端同样设置 10 秒 fetch 超时熔断

5. **Given** 服务端收到 `{ url }` 请求，**When** 识别到 URL 域名为不支持域名（非 `mp.weixin.qq.com`、`zhuanlan.zhihu.com`、`www.xiaohongshu.com`、`xhslink.com` 等），**Then** 立即返回 `{ success: false, error: "不支持该链接来源，请手动粘贴内容" }`，不发起外部网络请求

## Tasks / Subtasks

- [x] **新建 `src/lib/url-extractor/extractor.ts`：统一提取入口** (AC: #4, #5)
  - [x] 导出 `extractUrl(url: string, signal?: AbortSignal): Promise<{ success: boolean; text?: string; error?: string }>`
  - [x] 根据 URL hostname 分发到对应 parser：`mp.weixin.qq.com` → wechat-parser，`zhuanlan.zhihu.com` / `zhihu.com` → zhihu-parser，`www.xiaohongshu.com` / `xhslink.com` → xiaohongshu-parser
  - [x] 不支持的域名直接返回 `{ success: false, error: "不支持该链接来源，请手动粘贴内容" }`，不发起网络请求
  - [x] 所有 parser 异常统一 catch，返回 `{ success: false, error: "提取失败，请手动粘贴内容" }`

- [x] **新建 `src/lib/url-extractor/wechat-parser.ts`：微信公众号解析** (AC: #2)
  - [x] `fetch(url, { signal, headers: { 'User-Agent': '...' } })` 获取 HTML
  - [x] 从 HTML 提取 `#js_content` 内文本节点（去除 HTML 标签），返回纯文本
  - [x] 若 `#js_content` 不存在（反爬/结构变化）→ 返回 `{ success: false, error: "..." }`

- [x] **新建 `src/lib/url-extractor/zhihu-parser.ts`：知乎文章解析** (AC: #2)
  - [x] `fetch(url, { signal, headers: { 'User-Agent': '...' } })`
  - [x] 从 HTML 提取 `.Post-RichTextContainer` 或 `[itemprop="articleBody"]` 内文本节点
  - [x] 失败 → `{ success: false, error: "..." }`

- [x] **新建 `src/lib/url-extractor/xiaohongshu-parser.ts`：小红书解析（Best Effort）** (AC: #5)
  - [x] `xhslink.com` 短链需先 `fetch` 跟随 redirect 获取真实 URL，再提取
  - [x] 尝试提取 `#detail-desc` 或 `[class*="note-content"]` 文本
  - [x] 小红书反爬强，失败率高属预期行为，直接返回 `{ success: false, error: "..." }` 即可

- [x] **新建 `src/app/api/extract-url/route.ts`：提取 API** (AC: #1, #4, #5)
  - [x] `POST` handler，body 解析 `{ url: string }`
  - [x] 验证 `url` 必填且为合法 URL（`new URL(url)` 不抛异常），否则返回 `{ data: null, error: { code: 'VALIDATION_ERROR', message: 'URL 格式不正确' } }` 400
  - [x] 调用 `extractUrl(url, AbortSignal.timeout(10_000))`，服务端 10 秒熔断
  - [x] 成功 → `{ data: { text, success: true }, error: null }` 200
  - [x] 失败 → `{ data: { success: false, error: "..." }, error: null }` 200（业务失败不用 4xx/5xx）
  - [x] 引入现有 `src/lib/rate-limit.ts` checkRateLimit（与改写 API 同一限流逻辑）
  - [x] 引入现有 `src/lib/supabase/server.ts` 做用户认证校验，未登录返回 401

- [x] **新建 `src/features/rewrite/url-input.tsx`：URL 输入面板组件** (AC: #1, #2, #3, #4)
  - [x] Props: `onExtracted: (text: string) => void`、`onError: () => void`、`disabled?: boolean`
  - [x] 本地 state：`url: string`、`loading: boolean`、`error: string | null`
  - [x] 渲染：URL 文本输入框 + "提取正文"按钮（loading 时显示"提取中..."并禁用）
  - [x] 调用 `POST /api/extract-url` 时使用 `AbortSignal.timeout(10_000)`（客户端熔断）
  - [x] 成功 → 调用 `onExtracted(text)`（父组件切换 tab + 填入文本）
  - [x] 失败/超时 → 设置 `error` 文案，调用 `onError()`（父组件切换到粘贴 tab）
  - [x] 纯 Tailwind CSS 4.x，与现有 `text-input.tsx` 视觉风格一致
  - [x] 错误文案："无法自动提取该链接的内容，请手动复制文章文本后粘贴"

- [x] **修改 `src/features/rewrite/rewrite-workspace.tsx`：添加输入方式 tab** (AC: #1, #2, #3)
  - [x] 新增本地 state `inputTab: 'paste' | 'url'`（默认 `'paste'`）
  - [x] 在 `<TextInput>` 上方渲染两个 tab 按钮："粘贴全文" / "URL 提取"，样式参考 UX mockup（active tab 底部 accent 下划线）
  - [x] `inputTab === 'paste'` → 渲染现有 `<TextInput>`；`inputTab === 'url'` → 渲染 `<UrlInput>`
  - [x] `UrlInput` 的 `onExtracted` 回调：`setText(text); setInputTab('paste')`（切回粘贴 tab，文本已填入）
  - [x] `UrlInput` 的 `onError` 回调：`setInputTab('paste')`（切回粘贴 tab，让用户手动粘贴）
  - [x] 粘贴 tab 中 `<TextInput>` 加 `autoFocus` 或 ref focus，在 onError 回调后聚焦输入框（AC3 要求）
  - [x] `isRewriting` 时两个 tab 按钮均禁用

- [x] **新建 `src/lib/url-extractor/__tests__/extractor.test.ts`** (AC: #5)
  - [x] mock `fetch`，测试支持域名成功路径（返回 success: true）
  - [x] 测试不支持域名直接返回失败，不调用 fetch
  - [x] 测试 fetch 抛出异常时统一捕获返回失败

- [x] **新建 `src/app/api/extract-url/__tests__/route.test.ts`** (AC: #1, #4, #5)
  - [x] mock `extractUrl`，测试成功响应格式
  - [x] 测试 URL 缺失 → 400 VALIDATION_ERROR
  - [x] 测试 URL 非法 → 400 VALIDATION_ERROR
  - [x] 测试 extractUrl 返回 success:false → 200 业务失败响应
  - [x] 测试未登录 → 401

- [x] **新建 `src/features/rewrite/__tests__/url-input.test.tsx`** (AC: #1, #2, #3, #4)
  - [x] mock fetch，测试提取成功 → onExtracted 被调用，传入正文
  - [x] 测试提取失败 → error 文案显示，onError 被调用
  - [x] 测试 loading 状态：按钮文案变为"提取中..."，禁用
  - [x] 测试超时（mock fetch throw AbortError）→ onError 被调用

- [x] **更新 `src/features/rewrite/__tests__/rewrite-workspace.test.tsx`：覆盖 tab 切换** (AC: #1, #2, #3)
  - [x] 默认渲染"粘贴全文" tab active，TextInput 可见，UrlInput 不可见
  - [x] 点击"URL 提取" tab → UrlInput 可见，TextInput 不可见
  - [x] 模拟 UrlInput onExtracted → setText 被调用，切回"粘贴全文" tab
  - [x] 模拟 UrlInput onError → 切回"粘贴全文" tab
  - [x] isRewriting 时两个 tab 按钮禁用

## Dev Notes

### 关键架构约束（必须遵守）

**目录规范：**
- 新建文件（服务端）：`src/lib/url-extractor/extractor.ts`、`src/lib/url-extractor/wechat-parser.ts`、`src/lib/url-extractor/zhihu-parser.ts`、`src/lib/url-extractor/xiaohongshu-parser.ts`
- 新建文件（API）：`src/app/api/extract-url/route.ts`
- 新建文件（前端）：`src/features/rewrite/url-input.tsx`
- 测试目录：`src/lib/url-extractor/__tests__/`、`src/app/api/extract-url/__tests__/`、`src/features/rewrite/__tests__/`
- 文件名：`kebab-case`，组件名：`PascalCase`
- Prisma 路径（如用到）：`src/generated/prisma/`（非默认路径，注意）

**禁止修改的文件：**
- `src/features/rewrite/text-input.tsx` — 只渲染 textarea，保持纯粹
- `src/features/rewrite/rewrite-store.ts` — 无需改动 store，`setText` 已存在
- `src/features/rewrite/use-rewrite-stream.ts` — 不涉及 URL 提取
- `src/lib/llm/` — LLM 服务层，绝对禁止修改
- `src/app/api/rewrite/route.ts` — 改写 API，不修改

**API 响应格式（遵循已有约定）：**
```typescript
// 业务成功
{ data: { text: string; success: true }, error: null }

// 业务失败（提取失败/不支持域名）— 用 200 不用 4xx
{ data: { success: false; error: string }, error: null }

// 参数校验失败
{ data: null, error: { code: 'VALIDATION_ERROR', message: '...' } }  // 400
```

**UI 组件限制：**
- `shadcn/ui` 未安装，所有 UI 必须用纯 Tailwind CSS 4.x 实现
- 可用颜色 token：`accent`、`accent-hover`、`accent-light`、`surface-2`、`border-default`、`border-focus`、`text-secondary`、`text-caption`
- Tab active 样式：参考 UX mockup，底部 2px `accent` 下划线 + 白底，inactive：`surface-2` 背景

**认证方式（与其他 API 一致）：**
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return Response.json({ data: null, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
```

**限流（与改写 API 一致）：**
```typescript
import { checkRateLimit } from '@/lib/rate-limit'
const limitResult = checkRateLimit(user.id)
if (!limitResult.allowed) return Response.json({ data: null, error: { code: 'RATE_LIMIT' } }, { status: 429 })
```

### URL 提取器设计

**支持域名列表（extractor.ts 路由依据）：**
```typescript
const hostname = new URL(url).hostname
if (hostname === 'mp.weixin.qq.com') return wechatParser.extract(url, signal)
if (hostname === 'zhuanlan.zhihu.com' || hostname === 'www.zhihu.com') return zhihuParser.extract(url, signal)
if (hostname === 'www.xiaohongshu.com' || hostname === 'xiaohongshu.com') return xiaohongshuParser.extract(url, signal)
if (hostname === 'xhslink.com') return xiaohongshuParser.extract(url, signal)  // 短链，需跟随 redirect
return { success: false, error: '不支持该链接来源，请手动粘贴内容' }
```

**Fetch 请求头（模拟普通浏览器，减少反爬拒绝）：**
```typescript
const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}
```

**HTML 文本提取（无需安装额外依赖）：**
- 使用 Node.js 内置能力或简单 regex 提取，避免引入 cheerio 等包（架构约束：精简依赖）
- 推荐使用 Next.js 环境已有的 Web API，服务端 fetch 后用正则从 HTML 提取目标节点文本
- 提取文本后去除多余 HTML 标签：`html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()`
- 若项目 package.json 中已有 `node-html-parser` 或 `cheerio`，优先使用

**微信公众号文章结构（`#js_content`）：**
```html
<div id="js_content" class="rich_media_content"> ... </div>
```
提取方式：匹配 `id="js_content"` 后的内容块，strip tags 取纯文本

**知乎专栏文章结构：**
```html
<div class="Post-RichTextContainer"> ... </div>
<!-- 或 -->
<article itemProp="articleBody"> ... </article>
```

**小红书（Best Effort，失败率高属预期）：**
- `xhslink.com` 短链需先 follow redirect（`fetch(url, { redirect: 'follow' })`）得到真实 URL
- 实际内容由 Vue/React 渲染，服务端 fetch 可能得到空壳 HTML
- 尝试提取 `[class*="note-content"]` 或 `[class*="desc"]`，均不中则返回失败
- 失败返回 `{ success: false, error: '无法提取小红书内容，请手动粘贴' }` 即可

### rewrite-workspace.tsx Tab 设计

**本地 state（不进 Zustand store，tab 切换属纯 UI 状态）：**
```typescript
const [inputTab, setInputTab] = useState<'paste' | 'url'>('paste')
const pasteTextareaRef = useRef<HTMLTextAreaElement>(null)  // 用于 onError 后 focus

// UrlInput onExtracted callback
const handleUrlExtracted = (extractedText: string) => {
  setText(extractedText)
  setInputTab('paste')
  // 不需要 focus，用户看到已填入的文本即可
}

// UrlInput onError callback
const handleUrlError = () => {
  setInputTab('paste')
  // focus 输入框，引导手动粘贴（AC3）
  setTimeout(() => pasteTextareaRef.current?.focus(), 50)
}
```

**Tab 按钮样式（参考 UX mockup）：**
```tsx
<div className="flex border border-border-default rounded-md overflow-hidden mb-3">
  {(['paste', 'url'] as const).map((tab) => (
    <button
      key={tab}
      type="button"
      disabled={isRewriting}
      onClick={() => setInputTab(tab)}
      className={[
        'flex-1 py-1.5 text-center text-xs font-medium transition-all duration-150',
        inputTab === tab
          ? 'bg-white text-gray-800 font-semibold shadow-[inset_0_-2px_0_var(--color-accent)]'
          : 'bg-surface-2 text-text-secondary',
        isRewriting ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      {tab === 'paste' ? '粘贴全文' : 'URL 提取'}
    </button>
  ))}
</div>
```

**注意**：`TextInput` 不需要 `autoFocus` prop 改动，focus 通过 ref 手动触发即可。`TextInput` 的 `textarea` 需要暴露 `ref`，但当前 `text-input.tsx` 没有暴露外部 ref。可以用 `document.querySelector` 简单处理，或通过 `TextInput` 的 forwardRef 升级（如改动 `text-input.tsx` 则需评估测试影响）。**推荐最简方案**：`setTimeout(() => { const ta = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="原文输入框"]'); ta?.focus() }, 50)`（利用已有 `aria-label`）。

### url-input.tsx 组件设计

```typescript
'use client'

interface UrlInputProps {
  onExtracted: (text: string) => void
  onError: () => void
  disabled?: boolean
}

export function UrlInput({ onExtracted, onError, disabled = false }: UrlInputProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExtract() {
    if (!url.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: AbortSignal.timeout(10_000),  // 客户端 10s 超时
      })
      const json = await res.json()
      if (json.data?.success && json.data?.text) {
        onExtracted(json.data.text)
      } else {
        setError('无法自动提取该链接的内容，请手动复制文章文本后粘贴')
        onError()
      }
    } catch {
      // 超时 (AbortError) 或网络错误
      setError('无法自动提取该链接的内容，请手动复制文章文本后粘贴')
      onError()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="粘贴公众号/知乎/小红书文章链接..."
          disabled={disabled || loading}
          className="flex-1 rounded-lg border border-border-default bg-surface-2 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-border-focus disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleExtract}
          disabled={!url.trim() || loading || disabled}
          className="shrink-0 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent-hover transition-colors"
        >
          {loading ? '提取中...' : '提取正文'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
      <p className="text-xs text-text-caption">支持微信公众号、知乎、小红书链接（Best Effort）</p>
    </div>
  )
}
```

### 继承自 deferred-work.md 的相关事项

| 来源 | 问题 | 本 Story 处理 |
|---|---|---|
| 2-3 deferred | AppPage 缺少 metadata 导出 [src/app/app/page.tsx] | 本 Story 不涉及 page.tsx，跳过 |
| 4a-4 deferred | VALID_PLATFORMS 两文件重复 | 本 Story 不改动这两个文件，不处理 |

### 本 Story 不涉及的事项

- 改写记录存储 `original_url` 字段（DB schema 已有 `original_url VarChar(2048)`，但本 Story 的 URL 提取后文本填入输入框，按现有改写流程保存，无需额外传递 URL）
- 内容类型识别 / detecting_type 状态（架构文档中的状态机包含此步骤，属后续 Story 范围）
- 限流 token 消耗策略（与其他 API 保持一致即可）

### 已存在文件（勿重新创建）

| 文件 | 用途 |
|---|---|
| `src/features/rewrite/rewrite-store.ts` | Zustand store，`setText` action 已存在，直接使用 |
| `src/features/rewrite/rewrite-workspace.tsx` | 改写工作区，**需修改**（加 tab 状态和 tab UI） |
| `src/features/rewrite/text-input.tsx` | textarea 组件，**不修改** |
| `src/lib/rate-limit.ts` | 限流工具，直接 import |
| `src/lib/supabase/server.ts` | 服务端 Supabase 客户端，直接 import |

### 环境与技术栈约束

- **Next.js**：版本 16.2.1（与训练数据中的 Next.js 15 有 Breaking Changes），**务必在编写 API route 之前阅读 `node_modules/next/dist/docs/` 中的相关指南**（如 Route Handlers 写法可能有差异）
- Tailwind CSS 4.x（非 3.x，颜色 token 用法已见于现有代码）
- TypeScript strict mode
- 测试框架：Jest + React Testing Library（参考现有 `__tests__/` 文件模式）

### References

- [Source: epics.md#Story 4a.6] — AC 原文、NFR13 覆盖要求
- [Source: architecture.md#API & Communication Patterns] — `/api/extract-url` 接口定义
- [Source: architecture.md#Component Structure] — `lib/url-extractor/` 模块结构
- [Source: architecture.md#Error Handling] — API 响应格式规范
- [Source: _bmad-output/implementation-artifacts/4a-5-error-recovery.md] — 认证、限流引用模式、Tailwind 颜色 token
- [Source: src/features/rewrite/rewrite-workspace.tsx] — 现有 workspace 结构，tab 加在 TextInput 上方
- [Source: src/features/rewrite/text-input.tsx] — textarea 现有 aria-label="原文输入框"（供 focus 使用）
- [Source: src/features/rewrite/rewrite-store.ts] — setText action 已存在，无需改动 store
- [Source: outputs/shiwén-ux-preview.html] — `.input-tabs` / `.input-tab.active` 设计规范

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

（无异常）

### Completion Notes List

- 实现了完整的 URL 提取模块 `src/lib/url-extractor/`，支持微信公众号、知乎、小红书三个平台
- API 路由 `POST /api/extract-url` 包含认证、限流、参数校验、10 秒服务端熔断，响应格式遵循已有约定
- 前端 `UrlInput` 组件含 10 秒客户端熔断（AbortSignal.timeout），提取成功后自动填入 store 并切回粘贴 tab，提取失败后聚焦 textarea 引导手动粘贴
- `rewrite-workspace.tsx` 添加"粘贴全文"/"URL 提取"双 tab，改写中时两个 tab 按钮均禁用
- HTML 文本提取使用 regex（无新增依赖），符合架构精简依赖约束
- 全套测试：48 个新测试（extractor×13 + route×8 + url-input×10 + workspace tab×5 + 原有 workspace 回归×22），294/298 通过（4 个预存在失败在 proxy.test.ts，与本 story 无关）

### File List

新建：
- src/lib/url-extractor/extractor.ts
- src/lib/url-extractor/wechat-parser.ts
- src/lib/url-extractor/zhihu-parser.ts
- src/lib/url-extractor/xiaohongshu-parser.ts
- src/lib/url-extractor/__tests__/extractor.test.ts
- src/app/api/extract-url/route.ts
- src/app/api/extract-url/__tests__/route.test.ts
- src/features/rewrite/url-input.tsx
- src/features/rewrite/__tests__/url-input.test.tsx

修改：
- src/features/rewrite/rewrite-workspace.tsx（添加 inputTab state、tab UI、UrlInput 集成）
- src/features/rewrite/__tests__/rewrite-workspace.test.tsx（新增 tab 切换测试 describe 块）

### Review Findings

- [x] [Review][Patch] AC3 违反：URL 提取错误提示被 tab 切换立即掩盖，用户永远看不到 [url-input.tsx:31-33, rewrite-workspace.tsx:48-54] — fixed: 错误状态提升到父组件，粘贴 tab 下展示提取失败提示
- [x] [Review][Defer] 正则在嵌套 HTML 中截断内容（wechat/zhihu `</div>`、xhs `</`）[wechat-parser.ts:12, zhihu-parser.ts:26,34, xiaohongshu-parser.ts:25-39] — deferred, best-effort regex 解析局限性，需引入 HTML 解析库才能根本解决
- [x] [Review][Defer] `stripHtml`/`BROWSER_HEADERS` 三个 parser 重复定义 — deferred, pre-existing DRY 问题，功能无误
- [x] [Review][Defer] `request.signal` 未传给 `extractUrl`，客户端断连时服务端 fetch 不中断 [route.ts:60] — deferred, 10 秒内服务端 AbortSignal 自动超时，功能不受影响
- [x] [Review][Defer] 内存限流在多实例部署下可绕过 — deferred, pre-existing 问题，来自 Story 2-5
- [x] [Review][Defer] `res.text()` 无响应体大小限制 — deferred, 目标平台文章页面通常在合理范围内

## Change Log

| 日期 | 变更 |
|---|---|
| 2026-03-28 | Story 4a.6 实现完成：URL 提取模块（extractor + 3 个 parser）、API 路由、UrlInput 组件、rewrite-workspace Tab UI，所有 AC 满足，测试通过，状态更新为 review |
| 2026-03-29 | Code review 完成：发现 1 个 patch（AC3 错误提示被掩盖）、5 个 defer，状态回退为 in-progress |
| 2026-03-29 | Patch 修复：错误状态提升到 RewriteWorkspace，onError 传递错误信息，粘贴 tab 展示提取失败提示；3 个新测试通过，状态更新为 done |
