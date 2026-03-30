-- Migration: add_user_is_banned
-- Story 6.3: 为 users 表新增 is_banned 字段，支持管理员禁用账号

-- 为 users 表添加 is_banned 字段，默认值为 false（未禁用）
ALTER TABLE "users" ADD COLUMN "is_banned" BOOLEAN NOT NULL DEFAULT false;
