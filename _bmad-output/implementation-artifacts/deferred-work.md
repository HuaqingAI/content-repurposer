# Deferred Work

## Deferred from: code review of 7-2-guest-trial-onboarding (2026-03-30)

- **localStorage 在有效性校验前即被删除**：`rewrite-workspace.tsx` 中 `removeItem` 在 JSON.parse 和长度校验之前调用，短文本（< 50 字）或畸形 JSON 数据会静默丢失，无用户提示。
- **错误状态重试时 streamingBody 旧内容短暂闪烁**：`handleStart` 顶部调用 `setStreamingBody('')`，但在首次 render 刷新前 `showResult` 仍为 `true`，导致上一次结果出现短暂闪烁。
- **SSE flush 尾部未按 `\n\n` 重新分割**：`trial-widget.tsx` 中 `decoder.decode()` 的 flush 结果追加到 `buffer` 后，残余块处理只做单行 `split('\n')`，若尾部包含多个 SSE 事件（`\n\n` 分隔）只取最后一个，前序事件被丢弃。
- **字数计数器无无障碍关联**：`<span>` 计数器未设 `id` 或 `aria-live`，屏幕阅读器无法动态感知字数变化，`aria-label` 也未提及长度约束。
- **page.test.tsx 断言弱化**：从 `getByText` 改为 `getAllByText(...).length >= 1`，无法检测平台名因意外重复渲染而出现多次的情况。

## Deferred from: code review of 1-2-database-schema-supabase (2026-03-25)

- **AC4 导入路径更新**：`@/generated/prisma` 在 Prisma 7.x 应为 `@/generated/prisma/client`（无 index.ts）；后续故事中注意使用正确路径。
- **DATABASE_URL 模块加载崩溃**：prisma.ts 在模块加载时访问 DATABASE_URL，env.ts 启动校验可缓解，但 Serverless 冷启动中仍需注意。
- **Prisma 单例在 Serverless 环境**：globalThis 不跨函数调用共享，生产环境需配置 PgBouncer 或 Prisma Accelerate 进行连接池管理。
- **setAll 吞掉所有 cookie 错误**：按 Supabase SSR 官方推荐模式实现，但须注意非 Server Component 场景的调试困难。
- **metadata JSON 默认值 `"{}"`**：Prisma 7 + pg 实际运行正常，但如果遇到类型问题可改为 `@default(dbgenerated("'{}'::jsonb"))`。
- **apiCostCents/apiTokensUsed Int 溢出**：高吞吐场景下可考虑升级为 `BigInt`（`@db.BigInt`）。
- **originalUrl VarChar(2048)**：可能不足以存储含大量参数的现代 URL，如遇问题改为 `Text`。

## Deferred from: code review of 1-3-supabase-rls-config (2026-03-25)

- **`rewrite_results` 策略子查询 N+1 性能隐患**：相关子查询对每行执行一次，高并发下有性能下降风险；标准 RLS 模式，优化属架构迭代范畴，可考虑用 security-barrier view 替代。
- **`users` 无 DELETE 策略（账号注销未覆盖）**：RLS 当前不允许用户删除自己的账号记录，需在后续账号注销相关 Story 中补充。
- **`rewrite_records` 删除级联风险**：`rewrite_results.record_id` FK 若无 `ON DELETE CASCADE`，用户通过 RLS 删除 `rewrite_records` 时将触发 FK 违约。需与 Story 1.2 schema 确认级联设置。
- **`createServiceRoleClient` 与普通 client 同模块**：二者共存于 `src/lib/supabase/server.ts` 增加误用风险，可考虑拆分为 `server-admin.ts` 独立模块。
- **`rewrite_records_update_own` 无列级安全**：UPDATE 策略仅校验 user_id，用户可修改 `original_text` 等不可变字段；需列级安全或应用层保护，超出本 Story 范围。
- **`rewrite_results_update_own` TOCTOU 竞态**：READ COMMITTED 隔离下，并发删除父记录可能导致反馈 UPDATE 被静默丢弃，实际风险极低。
- **`createServiceRoleClient` 使用 `process.env` 而非 `env.ts`**：为规避循环依赖而偏离 Dev Notes 规格，`env.ts` 启动校验提供兜底，但边缘函数/独立测试场景下需注意。

## Deferred from: code review of 1-4-platform-config-seed (2026-03-25)

- Prompt 注入风险：promptTemplate 含 {ORIGINAL_TEXT} 用户输入占位符，无转义/过滤，待 Story 3.3 Prompt Assembler 设计时处理
- configVersion 硬编码为 1，re-run seed 静默覆盖内容：当前阶段设计决策，通过 Story 6.4 管理后台升级版本
- fewShotExamples 无运行时结构校验：超出 seed 脚本职责，可在 Story 3.3 数据消费层加校验

## Deferred from: code review of 1-5-docker-cicd-deploy (2026-03-25)

- 零宕机部署/蓝绿发布架构：每次部署有停机窗口，需 blue/green 或 rolling 策略，MVP 阶段暂缓
- deploy 失败无自动回滚：健康检查失败后旧容器已被替换，需手动介入，生产稳定性提升时处理
- git pull TOCTOU 竞态：CI 验证的 commit 与 ECS 实际构建的 commit 可能不同，建议改为镜像推送模式
- appleboy/ssh-action @v1 未钉：供应链风险，建议钉到特定 SHA，优先级 MEDIUM
- 安全响应头（X-Content-Type-Options、X-Frame-Options、CSP）：nginx 未配置，安全加固阶段处理
- 容器无资源限制（mem_limit/cpus）：OOM 时无隔离边界，生产加固时添加
- CI/CD 无 prisma migrate deploy 步骤：schema 变更需手动 apply，后续流水线完善时补充
- nginx server_name 占位符：用户须在 ECS 服务器手动替换为实际域名（Dev Notes step 4 已文档化）

## Deferred from: code review of 2-1-phone-sms-auth (2026-03-25)

- 登录成功后倒计时 setInterval 可能在组件卸载竞态窗口短暂继续运行 [phone-otp-form.tsx]：影响极小，仅 dev mode 出现 React 告警，正常用户流程不受影响
- display_name 使用 user.phone.slice(-4)，极短 phone 字符串时返回全部内容 [route.ts]：Supabase 保证 E.164 格式，中国号码恒为 13 位以上，无实际风险
- 用户粘贴带 +86 前缀的手机号时正则校验失败但错误提示不明确 [phone-otp-form.tsx]：UX 优化项，可在后续 Sprint 统一处理输入清洗逻辑

## Deferred from: code review of 1-6-database-backup (2026-03-25)

- DATABASE_URL 可能出现在 pg_dump 错误输出中并写入 cron 日志文件（/var/log/supabase-backup.log），建议在敏感环境中限制日志文件权限
- /tmp 空间不足时 gzip 写入失败，可能生成非零大小的损坏文件绕过 -s 检查；建议预检可用磁盘空间
- cron 并发执行时同一秒时间戳导致文件路径冲突（P5 的 mktemp fix 可部分缓解）
- 脚本以 root 身份通过 cron 运行，建议使用低权限专用系统用户执行备份
- 使用前未验证 OSSUTIL_CONFIG 文件是否存在，缺失时 set -e 静默退出无提示
- 未生成备份文件的 SHA256 校验和，无法在恢复前验证 OSS 存储完整性
- 注释掉的 `ossutil rm --older-than` 清理逻辑语法未经验证，批量删除存在风险，不可直接取消注释用于生产

## Deferred from: code review of 2-2-wechat-oauth-login (2026-03-25)

- 微信 email 命名空间碰撞风险：`wechat_{openid}@wechat.internal` 在接入第二个微信应用或 union-id 迁移时可能产生 email 碰撞；MVP 单应用阶段不涉及
- 登录入口缺乏速率限制：`/api/auth/wechat/login` 无频率限制，需在独立故事中统一处理 API 速率限制
- AC6 `/app/settings` 绑定手机号提示横幅：已知依赖 Story 2.4 设置页，届时实现
- 所有错误路径缺乏服务端结构化日志：统一日志方案属运维监控范畴，需独立规划
- 已有用户 `auth.users` 被外部删除后 `generateLink` 失败：`public.users` 孤儿记录场景，极低概率边缘情况，运维层面处理
- WeChat API secret 通过 GET query 参数传递：微信官方接口规范要求，无可替代方案

## Deferred from: code review of 2-3-session-management (2026-03-26)

- 登录重定向未保留原始目标 URL（无 `?next=` 参数）[src/proxy.ts:44]：AC 未要求，建议在 Epic 4a 用户流程完善时统一处理
- /auth/wechat-session 已认证用户一跳重定向产生误导性"微信登录失败"错误提示：Story 2.2 交互问题，不在本 Story 范围
- matcher 未排除 /public 静态资源（png/svg 等）导致每次图片请求触发 getUser() 网络调用 [src/proxy.ts:57-68]：性能优化，MVP 阶段请求量小影响可忽略
- AppPage 缺少 metadata 导出 [src/app/app/page.tsx]：占位页，Epic 4a 填充时一并补充
- useRouter mock 仅含 push，测试 mock 不完整 [auth-guard.test.tsx]：不影响当前测试覆盖，后续迭代时补充
- jest.mock 与 import 顺序依赖 hoisting 行为 [proxy.test.ts]：实际运行正常，低优先级代码质量项
- /app 重定向目标可能形成多跳链（当 /app 本身再重定向时） [src/proxy.ts:49]：当前路由树无此问题，Epic 4a 新增路由时注意
- /auth/* 路由未被 proxy 保护——OAuth 回调流程刻意不保护：设计意图，无需变更
- proxy.test.ts matcher 测试未验证具体排除模式内容：当前验证粒度满足 AC，后续可加正则单测

## Deferred from: code review of 2-4-user-settings-page (2026-03-26)

## Deferred from: code review of 2-5-api-rate-limiting (2026-03-27)

- **并发请求计数器竞态（多实例场景）**：JavaScript 单线程下 checkRateLimit 同步执行无实际竞态，但多 Docker 实例各自持有独立 Map，Post-MVP 迁移 Redis 时一并解决原子性问题 [src/lib/rate-limit.ts]
- **501 桩响应仍消耗限流 token**：每个通过认证的请求消耗一个 token，即便返回 501，属桩阶段设计预期；Story 3.4a 替换实际 LLM 逻辑时评估是否需调整（如失败不计数） [src/app/api/rewrite/route.ts]
- **请求体未校验——_request 参数未读取**：桩实现有意忽略 body，Story 3.4a 实现改写逻辑时须补充 body parse + validation（400 校验失败） [src/app/api/rewrite/route.ts]
- **进程内 Map 不跨 Docker 实例共享**：多实例部署时每实例独立计数，用户可绕过限流；Dev Notes 明确记录为 MVP 单实例约束，多实例扩容时替换为 Redis（Upstash 或自建）[src/lib/rate-limit.ts]

- PATCH /api/user/profile 缺乏 CSRF 防护（仅依赖 session cookie）[route.ts]：需统一决策——在中间件层（proxy.ts）或独立 API 安全层统一添加 Origin 校验，避免单点修复；建议在 Epic 5 安全加固阶段统一处理
- maskPhone 对非 11 位号码（国际格式如 +86 开头 E.164）脱敏强度不足 [page.tsx:12-14]：本 Story 仅处理中国大陆 11 位手机号，Spec 未覆盖国际格式
- 保存成功状态期间（3 秒内）提交按钮未禁用，可触发冗余 PATCH 请求 [settings-form.tsx:88-94]：不影响正确性，属 UX 优化，建议后续 Sprint 统一处理表单防重逻辑
- createdAt 以 UTC 格式化显示，中国用户（UTC+8）午夜附近时段可能显示前一天日期 [settings-form.tsx:48]：Spec 未规定时区，当前 UTC 为全局一致选择，国际化需求出现前不处理

## Deferred from: code review of 3-1-llm-provider-deepseek (2026-03-27)

- **max_tokens: 4096 硬编码不可覆盖** [deepseek.ts:93]：Story 3.3 prompt assembler 负责构建请求参数，届时统一配置 max_tokens
- **SSE event: 类型行未处理** [deepseek.ts:31]：DeepSeek API 不使用 event: 行，非当前场景需求，如接入其他 SSE 服务时处理
- **30s 超时对长文章生成可能不足** [deepseek.ts:74]：DeepSeek 流式约 30-50 tokens/s，5000 tokens 需 100s+；当前 30s 超时覆盖连接+传输全程，可接受 MVP 限制；后续改为 idle 超时（无数据 N 秒触发）
- **单例 deepseekProvider 在 API Key 轮换时需重启服务** [deepseek.ts:129]：架构决策，密钥泄漏紧急轮换场景需重启容器；可接受，多实例部署时注意

## Deferred from: code review of 4a-1-original-text-input (2026-03-27)

- **disabled 按钮无 ARIA 无障碍说明** [src/app/app/page.tsx]：占位页面，Story 4a.4 实现真实改写工作区布局时一并补充 aria-describedby 或 tooltip 说明禁用原因
- **Auto-grow useEffect 每次 keystroke 强制 layout thrash** [src/features/rewrite/text-input.tsx]：先设 height=auto 触发强制回流再测量 scrollHeight，属已知模式；MVP 阶段用户内容量有限，性能影响可忽略；如需优化可改用 ResizeObserver

## Deferred from: code review of 4a-2-platform-tone-selector (2026-03-27)

- **disabled 未从父组件传递给 PlatformSelector/ToneSelector**：提交态下子组件无法禁用交互，属改写 API 集成（Story 3.4a）范畴，届时父组件须将 `isSubmitting` 传入 `disabled` prop
- **isTextValid 未向用户展示，"开始改写"按钮静默禁用无计数反馈**：字符计数显示属 TextInput (Story 4a.1) 或改写工作区状态 (Story 4a.4) 职责范围，届时在按钮旁或输入框下方显示字数提示

## Deferred from: code review of 3-2-qianwen-llm-router (2026-03-27)

- **多行 SSE data 字段未合并** [qwen.ts:parseSSEStream]：SSE spec 允许多行 data 字段，但 OpenAI-compatible API（包括通义千问 DashScope 兼容模式）实际均使用单行 JSON，无实际影响；如接入非标准 SSE 服务时处理

## Deferred from: code review of 3-3-prompt-assembler (2026-03-30)

- **W1: PLATFORM_LABELS/TONE_LABELS 无未知枚举值兜底** [prompt-assembler.ts:45-46]：TypeScript 编译期已通过 `Record<Platform, string>` 保证穷举，仅在运行时绕过类型系统时（如 `as Platform`）有风险；如后续新增平台枚举时须同步更新映射表
- **W2: styleRules 为空数组时产生空"规则："段落** [prompt-assembler.ts:40]：属 DB 数据质量问题，空规则是否合法需业务侧决策；可在管理后台编辑器（Story 6.4）加非空校验
- **W3: styleRules/fewShotExamples 数组元素类型未做元素级校验** [prompt-assembler.ts:42-52]：Array.isArray 满足 spec 要求，但非字符串元素（null、object 等）会静默输出 `[object Object]` 进入 prompt；DB 数据质量问题，管理后台 Story 6.4 加输入校验时处理
- **W4: originalText 无最大长度限制** [prompt-assembler.ts:26-28]：超长输入（兆字节级）直接送 LLM，可能超 token 限制或产生高额费用；调用层（改写 API 路由）应在 Story 3.4a 中统一加请求体校验
- **W5: DB 来源 styleRules/fewShotExamples 内容注入系统提示无净化**：依赖 DB 访问控制和管理员权限，攻击者需先攻破数据库；管理后台 Story 6.4 实现时加内容校验，当前可接受
- **W6: 错误消息含内部平台标识符（如"平台 wechat"）**：内部服务间调用可接受；如该错误透传到公开 API 响应，须在路由层屏蔽
- **W7: CONTENT_TYPE_MAP 无英文枚举兜底**[content-type-parser.ts:3-9]：LLM 偶发输出英文标签（如 "opinion"）时静默归为 `other`；系统提示已指定中文标签，属 LLM 合规性问题；如需强化可添加英文映射
- **W8: prisma.platformConfig.findFirst 无 DB 错误包装** [prompt-assembler.ts:30-36]：DB 超时/连接失败抛出 Prisma 原始错误，无法区分"未配置"与"DB 宕机"；全局错误处理层统一处理
- **W9: Unicode 全角/零宽空格绕过 originalText 空值校验** [prompt-assembler.ts:26]：`\u3000`（全角空格）可通过 `.trim()` 但 JavaScript `.trim()` 不覆盖所有 Unicode 空白；极小概率，MVP 可接受

## Deferred from: code review of 5-1-history-list-page (2026-03-27)

- **page 参数无上界**：极大 page 值（如 page=9999999）触发 `OFFSET 199999980` 全表扫描，低优先级性能优化，可在 API 安全加固阶段统一处理
- **results 为空时 tone 静默降级为 'standard'**：handleReuse 中 `results[0]?.tone ?? 'standard'`，空结果时使用默认值，可接受行为；如需精确还原历史配置，届时改为记录 tone 快照至 rewrite_record
- **originalText 运行时 null 抛错**：DB 非空约束已保证此字段不为 null，实际风险为零；Prisma 迁移脚本出错时的极端兜底场景，无需现在处理
- **展开/收起按钮文案不对称**：`history-detail-modal.tsx` 中 "收起标题/标签" vs "展开标题/标签/引导语"，NITPICK，UX 统一时处理

## Deferred from: code review of 5-2-history-reuse (2026-03-27)

- **`/api/mock-rewrite` stub，request body 未含 text/platforms/tone**：Epic 4a Story 3.4a 替换为真实 SSE API 时须补充 request body 构建逻辑 [src/app/app/page.tsx:startRewrite]
- **SSE stream 未 abort on unmount/重新触发**：用户导航离开或再次点击"开始改写"时旧 while(true) 读循环继续运行；Story 3.4a 实现真实 SSE 时须添加 AbortController + reader.cancel() [src/app/app/page.tsx:startRewrite]
- **`done` SSE event 未 break 读循环**：服务端发送 done 后客户端继续轮询直至 TCP 关闭；3.4a 修复 [src/app/app/page.tsx:119]
- ~~**`activeTab`/`isDone` 重跑间未正确重置**：平台/语气变更后 isDone 仍为 true 显示旧按钮文案~~ **已在 4a-4 修复**：Zustand store `setPlatforms`/`setTone` 在 `status===complete` 时自动重置为 `idle`
- **错误后 streamingTexts 残留旧内容**：重试时旧内容 flash 后消失；3.4a/4a 错误处理重构时处理 [src/app/app/page.tsx]
- **TextDecoder 未调用最终 flush**：`decoder.decode()` 无参调用缺失，尾部多字节边界字节静默丢弃；3.4a 实现时补充 [src/app/app/page.tsx:88]
- **卡片复用截断上限 1500 字 ≠ spec 5000 字**：URL 安全权衡有意为之（5000 CJK 字符编码后约 45KB 远超 URL 安全上限）；长文场景建议改用 `localStorage` 或服务端临时 key 传递原文 [src/features/history/history-record-card.tsx]

## Deferred from: code review of 3-4b-rewrite-record-cost-tracker (2026-03-27)

- **usage.totalTokens 为 NaN/Infinity**：LLM provider 返回畸形 usage 对象时 calculateCostCents 产生 NaN，Prisma 写入 apiCostCents 报错；可在 cost-tracker 入口添加 isFinite 校验
- **VALID_PLATFORMS 与 Prisma Platform 枚举漂移**：route.ts 本地 `readonly string[]` 与 Prisma 生成的枚举无编译期绑定，新增平台时需手动同步
- **x-forwarded-for 可被伪造绕过 IP 限流**：getClientIp 直接信任客户端 header，需在 nginx/ALB 层覆写或仅使用最后一个跳点 IP
- **rawLLMOutput 全量驻留内存**：每个平台的完整 LLM 原始输出保留至请求结束，5000 字上限下影响有限，但多平台并发场景可评估是否只保留 parseContentType 所需的前 N 字节

## Deferred from: code review of 4a-4-rewrite-workspace-state (2026-03-27)

- **chunk 早于 platform_start 到达时内容静默丢弃** [use-rewrite-stream.ts:60-63]：SSE TCP 顺序保证，服务端协议 bug 场景，mock API 不涉及；真实 API 若出现乱序可在此处添加 chunk 缓冲队列
- **prefillDoneRef 与 searchParams 依赖冲突** [rewrite-workspace.tsx:42-59]：一次性预填语义有意为之，防止用户交互后 URL 参数覆盖输入；若需支持 SPA 路由切换时重新预填，可将 prefillDone 移入 store 或改用 key={pathname} 重建组件
- **VALID_PLATFORMS 在两文件中重复定义**：use-rewrite-stream.ts 和 rewrite-workspace.tsx 各自定义常量；后续重构时提取到 src/features/rewrite/constants.ts 共享
- **streamError banner 与 hasResults 区域短暂同时显示** [rewrite-workspace.tsx:85-125]：React 19 批处理后消失，极短 UI 闪烁；如需彻底消除可添加 `!streamError &&` 条件到 hasResults 展示块
- **fetch('/api/mock-rewrite') 未携带 request body** [use-rewrite-stream.ts:17]：mock API 设计如此，接入真实 SSE API（Story 3.4a/后续集成）时须添加 `body: JSON.stringify({ text, platforms, tone })`，并补充 Content-Type 头

## Deferred from: code review of 4a-3-streaming-text-renderer (2026-03-27)

- **Mock 端点无鉴权校验** [src/app/api/mock-rewrite/route.ts]：鉴权在 middleware 层（Story 2.3 已实现），mock 端点通过 proxy 保护；替换为真实 API 时鉴权天然覆盖
- **`streamError` 渲染服务端文字未做内容过滤** [src/app/app/page.tsx]：React 已转义 HTML，当前为内部可控 API，无 XSS 风险；接入用户自定义 SSE 服务时重新评估
- **`StreamingText` text 为纯空白时"生成中..."占位符不显示** [src/features/rewrite/streaming-text.tsx]：当前业务不产生纯空白输入，边界 UX 可后续处理

## Deferred from: code review of 4a-3-streaming-text-renderer Round 3 (2026-03-30)

- **Mock 端点无生产环境隔离守卫** [src/app/api/mock-rewrite/route.ts]：无 `NODE_ENV !== 'production'` 检查，端点在生产环境可访问，返回 mock 数据；auth middleware（Story 2.3）已保护该路径，替换为真实 API 时天然消除
- **服务端 SSE 无 abort 支持 — 客户端断连后 mock 继续执行** [src/app/api/mock-rewrite/route.ts]：`ReadableStream` 无 `cancel` 回调，`generateStream()` 在客户端断开后继续 sleep/enqueue；mock 端点可接受，真实 SSE（Story 3.4a）时须添加 `cancel` 回调并向 generator 传递 AbortSignal

## Deferred from: code review of 7-1-ssr-landing-page-seo (2026-03-27)

- **根 layout `lang="en"` 与全中文内容不符** [src/app/layout.tsx:27]：`<html lang="en">` 导致屏幕阅读器误读中文，Google 语言检测与属性冲突；落地页公开后影响加大，建议改为 `lang="zh-CN"`，属预存在问题
- **`proxy.ts` 未作为 Next.js middleware 生效，`/app/*` 路由无服务端鉴权保护** [src/proxy.ts]：middleware 必须位于 `src/middleware.ts`，当前文件为死代码，`middleware-manifest.json` 确认 `"middleware": {}` 为空；属预存在问题，需独立 Story 修复
- **AC1 LCP < 2s 依赖 CDN 配置无法从代码层验证**：SSR 已正确实现，CDN/缓存头配置属运维范畴，需在部署验证阶段确认
- **`<br />` 硬换行在极窄屏幕（≤320px 或高倍缩放）下布局不稳定** [src/app/page.tsx:33]：`max-w-md` 大多数场景可缓解，极端缩放下视觉异常，低优先级
- **CTA 按钮缺少 `motion-safe:` 前缀** [src/app/page.tsx:38,81]：`transition-colors` 未适配 `prefers-reduced-motion`，无障碍增强项，非功能缺陷

## Deferred from: code review of 4a-6-url-extraction (2026-03-29)

- **正则在嵌套 HTML 中截断内容**：wechat-parser.ts 和 zhihu-parser.ts 的 `([\s\S]*?)<\/div>` lazy 匹配在第一个内层 `</div>` 截断；xiaohongshu-parser.ts 的 `([\s\S]*?)<\/` 更粗糙；需引入 HTML 解析库才能根本解决，与 spec "精简依赖" 约束冲突，暂缓
- **`stripHtml`/`BROWSER_HEADERS` 三个 parser 重复定义**：DRY 问题，建议提取到 `src/lib/url-extractor/utils.ts`，功能无误，低优先级
- **`request.signal` 未传给 `extractUrl`**：`route.ts` 创建独立的 `AbortSignal.timeout`，客户端断连时服务端 upstream fetch 继续运行最多 10 秒；资源浪费但功能正常
- **内存限流在多实例部署下可绕过**：pre-existing 问题，来自 Story 2-5，Redis 迁移时一并解决
- **`res.text()` 无响应体大小限制**：理论上超大响应会占用内存，目标平台文章页面通常在合理范围内

## Deferred from: code review of 4b-1-content-package-display (2026-03-29)

- **Array element type validation 缺失**：`use-rewrite-stream.ts` 中 `data.titles as string[]` / `data.tags as string[]` 仅验证是数组，未验证每个元素为字符串；服务端返回非字符串元素时直接渲染，风险低（API 可控），后续加固时统一处理
- **`key={i}` 反模式**：`content-package.tsx` 中 titles/tags 列表使用数组索引作为 key；本场景为一次性到达非增量流式数据，实际无 reconciliation 问题，DRY 重构时统一改为稳定 key
- **空字符串/纯空白 tag 渲染为空 pill**：`content-package.tsx` 中 `#{tag}` 无内容时会渲染仅含 `#` 的 pill；属服务端数据质量问题，Story 4b-2 实现一键复制时可顺便添加 `tag.trim()` 过滤

## Deferred from: code review of 4b-2-one-click-copy (2026-03-29)

- **数组下标 key={i} 导致 CopyButton 状态误归属** [content-package.tsx:39,61]：streaming 更新时 index key 不稳定，可能将"已复制 ✓"状态归到错误条目；pre-existing（4b-1 已记录），DRY 重构时统一改为稳定 key
- **disabled button + onClick=undefined 逻辑冗余** [content-package.tsx:104]：disabled 已阻止 click 事件，onClick=undefined 叠加无 bug 但语义混淆；维护时注意两者皆需保留或改用单一机制
- **titles/tags 含空字符串元素时渲染空行并产生格式异常 copyText**：服务端应在 Story 3.x 数据清洗层过滤空字符串，客户端可加 tag.trim() 防御
- **fake timers afterEach 恢复时 pending callback 潜在测试间干扰** [copy-button.test.tsx:21-23]：当前运行稳定，如遇 flaky 可在 afterEach 中先 jest.runAllTimers() 再 useRealTimers()

## Deferred from: code review of 4b-3-editable-result (2026-03-30)

- **空字符串 tags/titles 元素渲染空白 pill 和空行**：`isEmpty` 仅检测数组长度，不过滤空字符串元素；服务端数据清洗层（Story 3.x）处理，客户端可加 `.filter(t => t.trim())` 防御 [content-package.tsx:86-101]
- **纯空白 hook 渲染空段落**：`isEmpty={!hook}` 仅检测 falsy，不 trim；`' '` 通过检测并渲染空白段落，服务端数据质量问题 [content-package.tsx:110-113]
- **CollapsibleSection button `disabled` 与 `onClick=undefined` 逻辑冗余**：`disabled` 已阻止 click，叠加 `onClick=undefined` 语义混淆；pre-existing，4b-2 已记录 [content-package.tsx:135-137]
- **`key={i}` 数组索引**：pre-existing，4b-1/4b-2 已记录，DRY 重构时统一改为稳定 key [content-package.tsx:72,94]
- **`isEmpty=true` 时无 `aria-busy` 属性**：屏幕阅读器无法感知内容仍在生成；CollapsibleSection 无障碍完善阶段处理 [content-package.tsx:146]
- **CollapsibleSection 缺少 `aria-expanded`**：辅助技术无法感知展开/折叠状态；无障碍完善阶段处理 [content-package.tsx:135]
- **CollapsibleSection `isOpen` 不随 `isEmpty` 反转重置**：二次改写重置数据后区域可能意外展开；pre-existing，数据生命周期管理阶段处理 [content-package.tsx:165]
- **测试 `toHaveLength(3/2)` 硬编码**：新增可折叠区域时批量失败；pre-existing 测试脆弱性，重构测试时统一处理 [content-package.test.tsx:18,42,73]

## Deferred from: code review of 4a-5-error-recovery (2026-03-27)

- **VALID_PLATFORMS 两文件重复定义** [use-rewrite-stream.ts:5, rewrite-workspace.tsx:12]：平台新增时需同步两处，Story 已注明可选提取到 constants.ts，优先级低
- **buffer 无上限，恶意/故障服务器持续发送无 \n\n 分隔符的数据可致内存耗尽** [use-rewrite-stream.ts:读循环]：安全加固项，超出本 story 范围，建议后续添加 maxBufferSize 熔断
- **retryable:false 时直接透传 SSE data.message 到 UI，建议增加长度截断或前端白名单** [use-rewrite-stream.ts:109-114]：由规范定义，服务端负责提供用户友好文案；若担忧服务端安全可在前端加 slice(0, 200) 防护
- **无流式请求超时机制，服务端挂起可致 UI 永久卡在改写中** [use-rewrite-stream.ts:startStream]：可用 AbortController + setTimeout 实现，超出本 story 范围
- **平台 tab 基于用户选择渲染而非实际数据可用性，无数据 tab 显示空白无提示** [rewrite-workspace.tsx:103-119]：UX 优化项，不影响当前 AC，可在 Epic 4b 输出体验中统一处理

## Deferred from: code review of 4b-4-feedback-rewrite (2026-03-30)

- **getClientIp 信任 x-forwarded-for 最左 IP 可被伪造绕过试用限流** [route.ts: getClientIp]：需在 nginx/ALB 层覆写或仅使用最后一跳 IP，pre-existing 问题（已在 3-4b review 记录）
- **fatalError 时平台 2 的 platform_complete 被跳过，resultId 永久缺失** [route.ts: pendingData && !fatalError]：平台 1 成功后平台 2 触发 fatalError，client 永远收不到平台 2 的 result_id；SSE 错误处理架构限制，复杂修复超出本 story 范围

## Deferred from: code review of 4b-3-editable-result (2026-03-30)

- **两个 `useEffect` 同依赖 `[body]` 可合并**：editing 重置和 feedback 重置可合并为一个 effect，减少运行次数，提升可读性 [content-package.tsx:41-57]
- **快速双击"有帮助"无防抖**：并发提交两次 feedback API，无 isSubmitting 防重入 guard；属 4b-4 scope，建议在 4b-4 review 时处理 [content-package.tsx]
- **评论框 textarea 无 `maxLength` 约束**：用户可提交超大文本；服务端需校验，前端加 maxLength 更佳；属 4b-4 scope [content-package.tsx]
- **`CollapsibleSection` 无 TypeScript 类型注解**：内部函数缺少 interface/type，影响类型安全 [content-package.tsx:~270]
