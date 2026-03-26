-- ============================================================
-- Migration: add_rls_policies
-- 为四张核心表启用 Row Level Security 并配置访问策略
-- ============================================================

-- 启用 RLS（幂等，重复执行无副作用）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewrite_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;

-- users 表策略（先 DROP 保证幂等，防止手动执行 rls.sql 后再 migrate deploy 报错）
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own"
  ON users FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
  ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- rewrite_records 表策略
DROP POLICY IF EXISTS "rewrite_records_select_own" ON rewrite_records;
CREATE POLICY "rewrite_records_select_own"
  ON rewrite_records FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "rewrite_records_insert_own" ON rewrite_records;
CREATE POLICY "rewrite_records_insert_own"
  ON rewrite_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rewrite_records_update_own" ON rewrite_records;
CREATE POLICY "rewrite_records_update_own"
  ON rewrite_records FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rewrite_records_delete_own" ON rewrite_records;
CREATE POLICY "rewrite_records_delete_own"
  ON rewrite_records FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- rewrite_results 表策略
DROP POLICY IF EXISTS "rewrite_results_select_own" ON rewrite_results;
CREATE POLICY "rewrite_results_select_own"
  ON rewrite_results FOR SELECT TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id FROM rewrite_records WHERE id = rewrite_results.record_id
    )
  );

DROP POLICY IF EXISTS "rewrite_results_update_own" ON rewrite_results;
CREATE POLICY "rewrite_results_update_own"
  ON rewrite_results FOR UPDATE TO authenticated
  USING (
    auth.uid() = (
      SELECT user_id FROM rewrite_records WHERE id = rewrite_results.record_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT user_id FROM rewrite_records WHERE id = rewrite_results.record_id
    )
  );

-- platform_configs 表策略
DROP POLICY IF EXISTS "platform_configs_select_authenticated" ON platform_configs;
CREATE POLICY "platform_configs_select_authenticated"
  ON platform_configs FOR SELECT TO authenticated
  USING (true);
