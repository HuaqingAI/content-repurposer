# Deferred Work

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

## Deferred from: code review of 6-2-system-dashboard (2026-03-30)

- **satisfactionRate 并发查询竞态**：`helpfulCount` 与 `totalFeedback` 来自两次独立 Prisma 查询，并发反馈写入可能导致 `helpfulCount > totalFeedback`（满意率 >100%）；预期写入频率低，MVP 阶段风险可接受；如需修复可改用数据库事务或 `$queryRaw` 单查询
- **proxy.ts roleError 重定向无用户反馈**：DB 查询失败时 admin 被静默重定向到 `/app`，无法区分权限不足与基础设施故障；需独立 UX story 或统一错误页支持
- **DAU groupBy 内存压力**：`prisma.rewriteRecord.groupBy({ by: ['userId'] })` 将所有去重 userId 加载到 Node.js 内存；当前用户规模无影响，百万级用户时建议改用 `COUNT(DISTINCT userId)` raw query

## Deferred from: code review of 6-1-admin-role-access-control (2026-03-30)

- **`feedbackComment` 字段在 schema.prisma 无已提交 migration** [prisma/schema.prisma]：来自 story 4b-3，migration 文件（20260330000001_add_feedback_comment）本地存在但未提交到 story 分支；需确认是否需补提
- **RLS 未显式禁止用户 UPDATE 自身 role** [Supabase Dashboard]：运维配置项，story 任务 3 已标注；部署前需在 Supabase Dashboard 确认 `users` 表无 `UPDATE` 策略或策略已排除 `role` 列
- **proxy.ts 用原始字符串 'admin' 而非 Prisma UserRole 枚举** [src/proxy.ts]：功能正确，类型安全优化；Prisma enum 导入在 proxy.ts 中可行，后续重构时考虑
- **user.id 未做空值独立校验** [src/proxy.ts]：Supabase Auth 保证 user.id 非空，实际风险为零；过度防御，暂缓
- **redirectWithCookies 将含 name/value 的 cookie 对象传入 options 参数** [src/proxy.ts]：pre-existing 模式（Story 2.3），当前运行正常，如遇 cookie 相关问题时排查

## Deferred from: code review of 6-3-user-management (2026-03-30)

- **禁用拦截仅覆盖 /api/rewrite**：其他 API 路由（历史记录、用户设置等）未检查用户禁用状态；本 story AC4 明确范围仅为 /api/rewrite，其余路由需独立 story 覆盖。
- **无防止封禁最后一个 admin 的逻辑**：当系统中仅剩一个 admin 账号时被禁用会导致后台完全锁死，需数据库层面或应用层保护；超出本 story 范围，建议在后续 admin 管理增强 story 中规划。
