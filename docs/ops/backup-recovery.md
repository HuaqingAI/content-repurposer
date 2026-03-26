# 数据库备份与恢复操作手册

> 覆盖需求：NFR12（用户改写历史数据定期自动备份）
> 最后更新：2026-03-25

---

## 首次部署清单

> 生产环境上线后，按顺序完成以下操作并逐项打勾。

- [ ] **Step 1：确认 Supabase 计划等级**
  - 登录 Supabase Dashboard → Settings → Database → Backups
  - 查看当前计划（Free / Pro / Team）
  - 根据计划选择下方方案A 或方案B

- [ ] **Step 2：配置自动备份**
  - 方案A（Pro/Team）：在 Dashboard 中启用备份，确认保留期 ≥ 7 天 → [详细步骤](#方案asupabase-pro-plan-原生备份)
  - 方案B（Free）：将 `scripts/backup-supabase.sh` 部署到 ECS，配置 cron job → [详细步骤](#方案becs-外部备份pg_dump--阿里云-oss)
  - 等待或手动触发首次备份，确认备份记录出现

- [ ] **Step 3：执行恢复测试**
  - 从备份恢复到测试数据库（新建临时 Supabase 项目 或 本地 Docker postgres）
  - 执行验证 SQL，确认三张核心表（`users` / `rewrite_records` / `rewrite_results`）数据完整 → [详细步骤](#恢复后数据验证)
  - 将测试结果填入 [恢复测试记录](#恢复测试记录) 表格

---

## 备份方案

### 方案选择依据

根据 Supabase 项目计划等级选择对应方案：

| 计划 | 自动备份 | PITR | 保留期 | 方案 |
|---|---|---|---|---|
| Free | 无 | 无 | — | **方案B**（外部 pg_dump） |
| Pro | 每日快照 | 可选 | 7 天 | **方案A**（Dashboard 原生） |
| Team | 每日快照 | 内置 | 7 天 | **方案A**（Dashboard 原生） |

### 当前采用方案

> **[运维人员填写]** 当前采用方案：方案A / 方案B
> 确认日期：______
> 操作人：______

---

## 方案A：Supabase Pro Plan 原生备份

### 启用步骤

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择 `content-repurposer` 项目
3. 进入 **Settings → Database → Backups**
4. 确认备份状态为 **Enabled**
5. 可选：启用 Point-in-Time Recovery（PITR）获得更细粒度的恢复能力

### 备份频率与保留策略

- **频率：** 每日自动备份（UTC 00:00 触发）
- **保留期：** 7 天（Pro Plan 默认）
- **类型：** 每日快照 + 可选 PITR（秒级精度）

### 验证备份状态

```
Supabase Dashboard → Settings → Database → Backups
→ 查看 "Backups" 列表，确认最新备份时间在 24 小时内
→ 状态显示 "Completed" 表示备份正常
```

---

## 方案B：ECS 外部备份（pg_dump + 阿里云 OSS）

> 适用于 Supabase Free tier 场景

### 前置条件

在 ECS 服务器上安装依赖：

```bash
# 安装 PostgreSQL 客户端
apt-get install -y postgresql-client  # Ubuntu/Debian
# 或
yum install -y postgresql             # CentOS/RHEL

# 安装阿里云 ossutil
wget https://gosspublic.alicdn.com/ossutil/1.7.18/ossutil64 -O /usr/local/bin/ossutil
chmod +x /usr/local/bin/ossutil

# 配置 ossutil（需要阿里云 AccessKey）
ossutil config
# 按提示输入：endpoint / accessKeyId / accessKeySecret
```

### 部署备份脚本

```bash
# 将仓库中的脚本复制到 ECS
cp ~/content-repurposer/scripts/backup-supabase.sh /opt/scripts/
chmod +x /opt/scripts/backup-supabase.sh

# 配置环境变量（脚本默认读取 /root/content-repurposer/.env.production）
# 确认 DATABASE_URL 已正确配置（Supabase 直连字符串，非 pooler）
# 在 Supabase Dashboard → Settings → Database → Connection string → Direct 获取
```

### 配置 Cron 定时任务

```bash
# 编辑 cron 配置
cat > /etc/cron.d/supabase-backup << 'EOF'
# 每日凌晨 2:00 执行备份（ECS 服务器本地时间）
0 2 * * * root /opt/scripts/backup-supabase.sh >> /var/log/supabase-backup.log 2>&1
EOF

# 确认 cron 服务运行
systemctl status cron  # 或 crond
```

### 备份频率与保留策略

- **频率：** 每日凌晨 2:00（可在 cron 中调整）
- **本地保留：** 不保留（备份后立即上传 OSS 并清理本地文件）
- **OSS 保留期：** 30 天（通过 OSS 生命周期策略配置）

#### 配置 OSS 生命周期策略（推荐）

```
阿里云控制台 → OSS → your-bucket → 生命周期
→ 新建规则：前缀 "backups/content-repurposer/"
→ 文件过期：30 天后自动删除
```

### 验证备份状态

```bash
# 查看最近备份日志
tail -50 /var/log/supabase-backup.log

# 检查 OSS 上的备份文件
ossutil ls "oss://your-bucket/backups/content-repurposer/" --config-file /root/.ossutilconfig

# 手动触发一次备份验证
/opt/scripts/backup-supabase.sh
```

---

## 恢复操作步骤

### 方案A 恢复（Supabase Dashboard）

1. 进入 **Supabase Dashboard → Settings → Database → Backups**
2. 选择目标备份时间点
3. 点击 **Restore**
4. 选择恢复目标：
   - **New project**（推荐：先恢复到新实例验证，再决定是否覆盖生产）
   - **Current project**（直接覆盖，不可逆）
5. 确认恢复，等待完成（通常需要 5-30 分钟）
6. 验证数据完整性（见下方验证命令）

### 方案B 恢复（pg_dump SQL 文件）

```bash
# 1. 从 OSS 下载目标备份文件
ossutil cp "oss://your-bucket/backups/content-repurposer/content-repurposer-YYYYMMDD_HHMMSS.sql.gz" \
  /tmp/ --config-file /root/.ossutilconfig

# 2. 解压
gunzip /tmp/content-repurposer-YYYYMMDD_HHMMSS.sql.gz

# 3. 恢复到目标数据库
# 建议先恢复到测试数据库，验证后再决定是否覆盖生产
psql "$TARGET_DATABASE_URL" -f /tmp/content-repurposer-YYYYMMDD_HHMMSS.sql

# 4. 清理临时文件
rm /tmp/content-repurposer-YYYYMMDD_HHMMSS.sql
```

### 恢复后数据验证

```sql
-- 连接目标数据库后执行：
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM public.users
UNION ALL
SELECT 'rewrite_records', COUNT(*) FROM public.rewrite_records
UNION ALL
SELECT 'rewrite_results', COUNT(*) FROM public.rewrite_results
UNION ALL
SELECT 'platform_configs', COUNT(*) FROM public.platform_configs;

-- 验证最新数据时间戳（确认数据时效性）
SELECT MAX(created_at) AS latest_record FROM public.rewrite_records;
SELECT MAX(created_at) AS latest_record FROM public.users;
```

---

## 恢复测试记录

> 每次执行恢复测试后，在此记录结果。建议每季度至少测试一次。

| 日期 | 测试人 | 采用方案 | 恢复目标时间点 | users 行数 | rewrite_records 行数 | rewrite_results 行数 | platform_configs 行数 | 结果 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| （首次测试待填写） | | | | | | | | | |

### 测试步骤记录

1. 确认当前生产数据库行数（备份前快照）
2. 选取 24 小时内的备份
3. 恢复到测试数据库（不影响生产）
4. 执行上方验证 SQL
5. 对比行数与生产环境一致
6. 记录测试结果到上表

---

## 紧急恢复联系方式

> **[运维人员填写]**
> - 负责人：______
> - 联系方式：______
> - Supabase 项目 ID：______
> - 阿里云 OSS Bucket：______

---

## 变更记录

| 日期 | 变更内容 | 操作人 |
|---|---|---|
| 2026-03-25 | 初始文档创建，包含方案A/B说明及恢复步骤 | claude-sonnet-4-6 |
