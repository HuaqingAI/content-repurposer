-- ============================================================
-- Row Level Security (RLS) Policies for content-repurposer
-- ============================================================
-- 使用说明：
--   此文件为 RLS 策略参考脚本，与 Prisma 迁移文件
--   prisma/migrations/20260325000001_add_rls_policies/migration.sql 内容保持一致。
--
--   执行方式（二选一）：
--   1. 通过 Prisma 迁移（推荐）：
--      npx prisma migrate deploy
--   2. 在 Supabase Dashboard > SQL Editor 中直接执行此文件
-- ============================================================

-- ============================================================
-- 启用所有核心表的 Row Level Security
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- users 表策略
-- 用户只能读取和修改自己的记录
-- INSERT 通过服务端 service_role 完成（Story 2.1/2.2 实现），不对普通用户开放
-- ============================================================

-- 允许已认证用户读取自己的记录
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 允许已认证用户更新自己的记录（display_name 等可修改字段）
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- rewrite_records 表策略
-- 用户只能访问自己发起的改写记录
-- ============================================================

-- 读取自己的改写记录
CREATE POLICY "rewrite_records_select_own"
  ON rewrite_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 创建改写记录（user_id 必须等于当前用户）
CREATE POLICY "rewrite_records_insert_own"
  ON rewrite_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 更新改写记录（如元数据字段更新）
CREATE POLICY "rewrite_records_update_own"
  ON rewrite_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 删除自己的改写记录
CREATE POLICY "rewrite_records_delete_own"
  ON rewrite_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- rewrite_results 表策略
-- 通过关联 rewrite_records 验证归属
-- INSERT/DELETE 由服务端 service_role 完成，不对用户开放
-- UPDATE 限制为反馈字段（feedback/comment），由用户提交
-- ============================================================

-- 读取属于自己改写记录的结果
CREATE POLICY "rewrite_results_select_own"
  ON rewrite_results
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id
      FROM rewrite_records
      WHERE id = rewrite_results.record_id
    )
  );

-- 更新（反馈字段）：用户可更新属于自己改写记录的结果
CREATE POLICY "rewrite_results_update_own"
  ON rewrite_results
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id
      FROM rewrite_records
      WHERE id = rewrite_results.record_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id
      FROM rewrite_records
      WHERE id = rewrite_results.record_id
    )
  );

-- ============================================================
-- platform_configs 表策略
-- 所有已认证用户可读；写入仅 service_role（管理员操作，Story 6.4 实现）
-- ============================================================

-- 已认证用户可读取所有平台配置（改写引擎需要读取激活配置）
CREATE POLICY "platform_configs_select_authenticated"
  ON platform_configs
  FOR SELECT
  TO authenticated
  USING (true);
