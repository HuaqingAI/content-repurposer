-- Migration: add_feedback_comment
-- Story 4b.4: 为 rewrite_results 表新增 feedback_comment 字段

ALTER TABLE rewrite_results ADD COLUMN IF NOT EXISTS feedback_comment TEXT;
