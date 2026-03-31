-- Migration: add_missing_columns
-- 补充 rewrite_results 表中可能缺失的字段

-- 确保 feedback 枚举类型存在
DO $$ BEGIN
  CREATE TYPE "feedback" AS ENUM ('helpful', 'not_helpful');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 补充 hook 字段（如不存在）
ALTER TABLE rewrite_results ADD COLUMN IF NOT EXISTS hook TEXT NOT NULL DEFAULT '';

-- 补充 feedback 字段（如不存在）
ALTER TABLE rewrite_results ADD COLUMN IF NOT EXISTS feedback "feedback";
